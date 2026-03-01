data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

resource "aws_s3_bucket" "private_site_bucket" {
  bucket = var.bucket_name
  tags   = var.tags
}

resource "aws_s3_bucket_public_access_block" "private_site_bucket" {
  bucket = aws_s3_bucket.private_site_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "private_site_bucket" {
  bucket = aws_s3_bucket.private_site_bucket.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_cloudfront_origin_access_control" "s3_oac" {
  name                              = "${var.bucket_name}-oac"
  description                       = "CloudFront OAC for ${var.bucket_name}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_acm_certificate" "site_cert" {
  provider                  = aws.us_east_1
  domain_name               = var.custom_domain
  subject_alternative_names = var.subject_alternative_names
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "cloudflare_dns_record" "acm_validation" {
  for_each = {
    for dvo in aws_acm_certificate.site_cert.domain_validation_options :
    dvo.domain_name => {
      name    = dvo.resource_record_name
      type    = dvo.resource_record_type
      content = dvo.resource_record_value
    }
  }

  zone_id = var.cloudflare_zone_id
  name    = each.value.name
  type    = each.value.type
  content = each.value.content
  ttl     = 1
  proxied = false
}

resource "aws_acm_certificate_validation" "site_cert" {
  provider        = aws.us_east_1
  certificate_arn = aws_acm_certificate.site_cert.arn

  validation_record_fqdns = [
    for dvo in aws_acm_certificate.site_cert.domain_validation_options : dvo.resource_record_name
  ]

  depends_on = [cloudflare_dns_record.acm_validation]
}

resource "aws_cloudfront_distribution" "s3_distribution" {
  enabled             = true
  comment             = "Distribution for ${var.bucket_name}"
  default_root_object = var.default_root_object
  price_class         = var.price_class
  aliases             = concat([var.custom_domain], var.additional_aliases)

  origin {
    domain_name              = aws_s3_bucket.private_site_bucket.bucket_regional_domain_name
    origin_id                = "s3-${aws_s3_bucket.private_site_bucket.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.s3_oac.id
  }

  default_cache_behavior {
    target_origin_id       = "s3-${aws_s3_bucket.private_site_bucket.id}"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    cache_policy_id        = data.aws_cloudfront_cache_policy.caching_optimized.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.site_cert.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = var.tags
}

resource "cloudflare_dns_record" "custom_domain" {
  count = var.manage_custom_domain_dns ? 1 : 0

  zone_id = var.cloudflare_zone_id
  name    = var.cloudflare_record_name
  type    = "CNAME"
  content = aws_cloudfront_distribution.s3_distribution.domain_name
  ttl     = 1
  proxied = var.cloudflare_proxied
}

data "aws_iam_policy_document" "allow_cloudfront_read" {
  statement {
    sid    = "AllowCloudFrontReadOnlyAccess"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    actions = ["s3:GetObject"]
    resources = [
      "${aws_s3_bucket.private_site_bucket.arn}/*"
    ]

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.s3_distribution.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "allow_cloudfront_read" {
  bucket = aws_s3_bucket.private_site_bucket.id
  policy = data.aws_iam_policy_document.allow_cloudfront_read.json
}

data "aws_iam_policy_document" "deployment_access" {
  statement {
    sid     = "ListObjectsInBucket"
    effect  = "Allow"
    actions = ["s3:ListBucket"]
    resources = [
      aws_s3_bucket.private_site_bucket.arn
    ]
  }

  statement {
    sid    = "UpdateS3Bucket"
    effect = "Allow"
    actions = [
      "s3:*Object"
    ]
    resources = [
      "${aws_s3_bucket.private_site_bucket.arn}/*"
    ]
  }

  statement {
    sid     = "InvalidateCloudFront"
    effect  = "Allow"
    actions = ["cloudfront:CreateInvalidation"]
    resources = [
      aws_cloudfront_distribution.s3_distribution.arn
    ]
  }
}

resource "aws_iam_policy" "deployment_access" {
  name        = var.deployment_policy_name
  description = "Allows listing/updating the site bucket and invalidating the CloudFront distribution."
  policy      = data.aws_iam_policy_document.deployment_access.json
  tags        = var.tags
}
