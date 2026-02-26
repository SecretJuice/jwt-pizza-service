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
  # RDS pricing varies by AZ and time; using the first available AZ as a stable low-cost heuristic.
  selected_availability_zone = sort(data.aws_availability_zones.available.names)[0]
}

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_subnets" "selected_vpc" {
  filter {
    name   = "vpc-id"
    values = [local.selected_vpc_id]
  }
}

data "aws_ssm_parameter" "db_password" {
  name            = var.db_password_ssm_parameter_name
  with_decryption = true
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

resource "aws_db_subnet_group" "jwt_pizza_db" {
  name       = "jwt-pizza-service-db-subnet-group"
  subnet_ids = data.aws_subnets.selected_vpc.ids
}

resource "aws_db_instance" "jwt_pizza_service_db" {
  identifier = "jwt-pizza-service-db"

  engine         = "mysql"
  instance_class = "db.t4g.micro"

  username = "admin"
  password = data.aws_ssm_parameter.db_password.value

  iam_database_authentication_enabled = true

  allocated_storage = 20
  storage_type      = "gp2"
  storage_encrypted = true

  publicly_accessible    = false
  vpc_security_group_ids = [aws_security_group.jwt_pizza_db.id]
  db_subnet_group_name   = aws_db_subnet_group.jwt_pizza_db.name
  availability_zone      = local.selected_availability_zone
  multi_az               = false

  skip_final_snapshot = true
}

resource "aws_ecr_repository" "jwt_pizza_service" {
  name = "jwt-pizza-service"
}
