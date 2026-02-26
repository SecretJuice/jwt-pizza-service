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

variable "db_password" {
  description = "Master password for the RDS instance"
  type        = string
  sensitive   = true
}
