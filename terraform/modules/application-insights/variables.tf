variable "namespace_name" {
  description = "The namespace name for the application insights"
  type        = string
}

variable "location" {
  description = "The Azure region where the application insights will be created"
  type        = string
}

variable "resource_group_name" {
  description = "The name of the resource group"
  type        = string
}

variable "tags" {
  description = "A map of tags to assign to the application insights"
  type        = map(string)
  default     = {}
}