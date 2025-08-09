variable "namespace_name" {
  description = "The namespace name for the static web app"
  type        = string
}

variable "location" {
  description = "The Azure region where the static web app will be created"
  type        = string
}

variable "resource_group_name" {
  description = "The name of the resource group"
  type        = string
}

variable "tags" {
  description = "A map of tags to assign to the static web app"
  type        = map(string)
  default     = {}
}