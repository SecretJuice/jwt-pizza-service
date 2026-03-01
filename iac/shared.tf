resource "aws_iam_role_policy_attachment" "github_ci_backend_deploy" {
  count = var.attach_policies_to_github_ci_role ? 1 : 0

  role       = var.github_ci_role_name
  policy_arn = aws_iam_policy.jwt_pizza_service_deploy.arn
}

resource "aws_iam_role_policy_attachment" "github_ci_frontend_deploy" {
  count = var.attach_policies_to_github_ci_role ? 1 : 0

  role       = var.github_ci_role_name
  policy_arn = aws_iam_policy.deployment_access.arn
}

resource "aws_ssm_parameter" "cloudflare_api_token" {
  count = var.store_cloudflare_api_token_in_ssm ? 1 : 0

  name        = var.cloudflare_api_token_ssm_parameter_name
  description = "Cloudflare API token used for DNS automation"
  type        = "SecureString"
  value       = var.cloudflare_api_token
}
