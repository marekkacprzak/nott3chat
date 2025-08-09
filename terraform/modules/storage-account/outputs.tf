output "name" {
  description = "The name of the storage account"
  value       = azurerm_storage_account.main.name
}

output "id" {
  description = "The ID of the storage account"
  value       = azurerm_storage_account.main.id
}

output "primary_access_key" {
  description = "The primary access key of the storage account"
  value       = azurerm_storage_account.main.primary_access_key
  sensitive   = true
}

output "file_share_name" {
  description = "The name of the file share"
  value       = azurerm_storage_share.database.name
}