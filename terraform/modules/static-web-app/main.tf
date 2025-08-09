resource "azurerm_static_web_app" "main" {
  name                = "${var.namespace_name}-swa"
  resource_group_name = var.resource_group_name
  location            = var.location
  sku_tier            = "Free"
  sku_size            = "Free"

  tags = var.tags
}