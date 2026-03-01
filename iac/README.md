# Terraform Layout

This directory is a single Terraform root module for both backend and frontend infrastructure.

Files are organized by concern:

- `providers.tf`: Terraform and provider configuration
- `variables.tf`: Inputs for the full stack
- `backend.tf`: ECS, ALB, ECR, RDS, and backend IAM resources
- `frontend.tf`: S3, CloudFront, ACM, Cloudflare DNS, and frontend IAM resources
- `shared.tf`: Cross-cutting integrations (GitHub CI role attachments, optional SSM token storage)

## Usage

```sh
cd iac
terraform init
terraform plan
```

## Shared integration toggles

- `attach_policies_to_github_ci_role` (default `false`): attach both deployment IAM policies to an existing role (`github_ci_role_name`).
- `store_cloudflare_api_token_in_ssm` (default `true`): store `cloudflare_api_token` as a SecureString SSM parameter (`cloudflare_api_token_ssm_parameter_name`).
- `store_cloudflare_zone_id_in_ssm` (default `true`): store `cloudflare_zone_id` as a String SSM parameter (`cloudflare_zone_id_ssm_parameter_name`).
- `service_custom_domain` (default `pizza-service.conrobb.com`): hostname used for the backend ALB TLS certificate.
- `manage_service_custom_domain_dns` (default `true`): create a Cloudflare CNAME from `service_cloudflare_record_name` to the ALB DNS name.
