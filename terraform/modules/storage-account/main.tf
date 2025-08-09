resource "azurerm_storage_account" "main" {
  name                     = "${replace(var.namespace_name, "-", "")}storage"
  resource_group_name      = var.resource_group_name
  location                 = var.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  
  min_tls_version                = "TLS1_2"
  allow_nested_items_to_be_public = false
  
  tags = var.tags
}

resource "azurerm_storage_share" "database" {
  name                 = "database"
  storage_account_name = azurerm_storage_account.main.name
  quota                = 5 # 5 GB

  depends_on = [azurerm_storage_account.main]
}