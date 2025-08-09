resource "azurerm_resource_group" "main" {
  name     = "${var.namespace_name}-rg"
  location = var.location
  tags     = var.tags
}