variable "namespace_name" {
  description = "The namespace name for the key vault"
  type        = string
}

variable "location" {
  description = "The Azure region where the key vault will be created"
  type        = string
}

variable "resource_group_name" {
  description = "The name of the resource group"
  type        = string
}

variable "jwt_secret_key" {
  description = "JWT secret key (if empty, will be generated)"
  type        = string
  default     = ""
  sensitive   = true
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

variable "tags" {
  description = "A map of tags to assign to the key vault"
  type        = map(string)
  default     = {}
}