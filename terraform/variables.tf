variable "namespace_name" {
  description = "The namespace name for all resources (will be used as prefix)"
  type        = string
  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.namespace_name))
    error_message = "Namespace name must only contain lowercase letters, numbers, and hyphens."
  }
}

variable "app_service_name" {
  description = "The name of the backend App Service"
  type        = string
  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.app_service_name))
    error_message = "App Service name must only contain lowercase letters, numbers, and hyphens."
  }
}

variable "location" {
  description = "The Azure region where resources will be created"
  type        = string
  default     = "West Europe"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "enable_key_vault" {
  description = "Enable Azure Key Vault for secrets management"
  type        = bool
  default     = true
}

variable "enable_application_insights" {
  description = "Enable Application Insights for monitoring and telemetry"
  type        = bool
  default     = false
}

variable "openai_api_key" {
  description = "OpenAI API key"
  type        = string
  default     = ""
  sensitive   = true
}

variable "perplexity_api_key" {
  description = "Perplexity API key"
  type        = string
  default     = ""
  sensitive   = true
}

variable "enable_redirect_web_app" {
  description = "Enable Windows redirect web app with .NET Framework"
  type        = bool
  default     = false
}

variable "redirect_app_name" {
  description = "The name of the redirect web app"
  type        = string
  default     = "breworksec"
  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.redirect_app_name))
    error_message = "Redirect app name must only contain lowercase letters, numbers, and hyphens."
  }
}

variable "tags" {
  description = "A map of tags to assign to all resources"
  type        = map(string)
  default = {
    Project     = "NotT3Chat"
    Environment = "dev"
    ManagedBy   = "Terraform"
  }
}