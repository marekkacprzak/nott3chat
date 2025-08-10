variable "namespace_name" {
  description = "The namespace name for the app service"
  type        = string
}

variable "app_service_name" {
  description = "The name of the app service"
  type        = string
}

variable "location" {
  description = "The Azure region where the app service will be created"
  type        = string
}

variable "resource_group_name" {
  description = "The name of the resource group"
  type        = string
}

variable "key_vault_id" {
  description = "The ID of the key vault"
  type        = string
}

variable "jwt_secret_reference" {
  description = "Key Vault reference for JWT secret"
  type        = string
}

variable "enable_key_vault" {
  description = "Whether Key Vault is enabled"
  type        = bool
  default     = true
}

variable "openai_secret_reference" {
  description = "Key Vault reference for OpenAI API key"
  type        = string
  default     = ""
}

variable "openai_api_key" {
  description = "OpenAI API key (used when Key Vault is disabled)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "perplexity_secret_reference" {
  description = "Key Vault reference for Perplexity API key"
  type        = string
  default     = ""
}

variable "perplexity_api_key" {
  description = "Perplexity API key (used when Key Vault is disabled)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "storage_account_name" {
  description = "The name of the storage account"
  type        = string
}

variable "file_share_name" {
  description = "The name of the file share"
  type        = string
}

variable "storage_access_key" {
  description = "The access key for the storage account"
  type        = string
  sensitive   = true
}

variable "app_insights_connection_string" {
  description = "Application Insights connection string"
  type        = string
  default     = ""
}

variable "web_url" {
  description = "The URL of the frontend web app"
  type        = string
  default     = ""
}

variable "tags" {
  description = "A map of tags to assign to the app service"
  type        = map(string)
  default     = {}
}