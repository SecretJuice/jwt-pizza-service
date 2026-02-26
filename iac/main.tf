terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile
}

resource "aws_default_vpc" "default" {
  tags = {
    Name = "Default VPC"
  }
}

locals {
  selected_vpc_id = var.vpc_id != "" ? var.vpc_id : aws_default_vpc.default.id
}

resource "aws_security_group" "jwt_pizza_service" {
  name        = "jwt-pizza-service"
  description = "JWT Pizza Service"
  vpc_id      = local.selected_vpc_id

  ingress {
    description = "HTTP from anywhere"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS from anywhere"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "jwt_pizza_db" {
  name        = "jwt-pizza-db"
  description = "JWT Pizza Service Database"
  vpc_id      = local.selected_vpc_id

  ingress {
    description     = "MySQL/Aurora from jwt-pizza-service security group"
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    security_groups = [aws_security_group.jwt_pizza_service.id]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
