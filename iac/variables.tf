variable "aws_region" {
  description = "AWS region for resource deployment"
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "AWS cli profile for resource deployment"
  type        = string
  default     = "cs329"
}

variable "vpc_id" {
  description = "VPC ID where the security groups will be created. Leave empty to use the account default VPC."
  type        = string
  default     = ""
}

variable "db_password_ssm_parameter_name" {
  description = "SSM Parameter Store name containing the RDS master password (SecureString)"
  type        = string
  default     = "/jwt-pizza-service/db/password"
}

variable "bucket_name" {
  description = "Name of the private S3 bucket (must be globally unique)."
  type        = string
  default     = "pizza.conrobb.com"
}

variable "custom_domain" {
  description = "Primary hostname for CloudFront (for example, app.example.com)."
  type        = string
  default     = "pizza.conrobb.com"
}

variable "additional_aliases" {
  description = "Optional extra hostnames for the CloudFront distribution."
  type        = list(string)
  default     = []
}

variable "subject_alternative_names" {
  description = "Optional SAN entries for the ACM certificate."
  type        = list(string)
  default     = []
}

variable "cloudflare_zone_id" {
  description = "Cloudflare Zone ID that hosts the custom domain."
  type        = string
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token with DNS edit permissions."
  type        = string
  sensitive   = true
}

variable "manage_custom_domain_dns" {
  description = "Whether Terraform should create the Cloudflare CNAME to CloudFront."
  type        = bool
  default     = true
}

variable "cloudflare_record_name" {
  description = "DNS record name in Cloudflare (for example, @ or app)."
  type        = string
  default     = "pizza"
}

variable "cloudflare_proxied" {
  description = "Whether the Cloudflare DNS record is proxied. Keep false when CloudFront is the CDN."
  type        = bool
  default     = false
}

variable "service_custom_domain" {
  description = "Custom domain name for the backend ALB."
  type        = string
  default     = "pizza-service.conrobb.com"
}

variable "manage_service_custom_domain_dns" {
  description = "Whether Terraform should create the Cloudflare CNAME to the backend ALB."
  type        = bool
  default     = true
}

variable "service_cloudflare_record_name" {
  description = "DNS record name in Cloudflare for the backend ALB CNAME."
  type        = string
  default     = "pizza-service"
}

variable "service_cloudflare_proxied" {
  description = "Whether the backend ALB Cloudflare DNS record is proxied."
  type        = bool
  default     = false
}

variable "deployment_policy_name" {
  description = "Name of IAM policy used for deployment access to S3 and CloudFront invalidation."
  type        = string
  default     = "jwt-pizza-deployment-access"
}

variable "default_root_object" {
  description = "Default root object served by CloudFront."
  type        = string
  default     = "index.html"
}

variable "price_class" {
  description = "CloudFront price class."
  type        = string
  default     = "PriceClass_100"
}

variable "tags" {
  description = "Common tags applied to resources."
  type        = map(string)
  default     = {}
}

variable "attach_policies_to_github_ci_role" {
  description = "Attach backend/frontend deployment policies to an existing GitHub CI role."
  type        = bool
  default     = false
}

variable "github_ci_role_name" {
  description = "Name of existing IAM role used by GitHub CI."
  type        = string
  default     = "github-ci"
}

variable "store_cloudflare_api_token_in_ssm" {
  description = "Whether to store the Cloudflare API token in SSM Parameter Store."
  type        = bool
  default     = true
}

variable "cloudflare_api_token_ssm_parameter_name" {
  description = "SSM parameter name for storing the Cloudflare API token."
  type        = string
  default     = "/jwt-pizza-service/cloudflare/api-token"
}

variable "store_cloudflare_zone_id_in_ssm" {
  description = "Whether to store the Cloudflare zone ID in SSM Parameter Store."
  type        = bool
  default     = true
}

variable "cloudflare_zone_id_ssm_parameter_name" {
  description = "SSM parameter name for storing the Cloudflare zone ID."
  type        = string
  default     = "/jwt-pizza-service/cloudflare/zone-id"
}
