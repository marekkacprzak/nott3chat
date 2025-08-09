output "id" {
  description = "The ID of the app service"
  value       = azurerm_linux_web_app.main.id
}

output "name" {
  description = "The name of the app service"
  value       = azurerm_linux_web_app.main.name
}

output "default_hostname" {
  description = "The default hostname of the app service"
  value       = azurerm_linux_web_app.main.default_hostname
}

output "url" {
  description = "The URL of the app service"
  value       = "https://${azurerm_linux_web_app.main.default_hostname}"
}

output "principal_id" {
  description = "The principal ID of the managed identity"
  value       = azurerm_linux_web_app.main.identity[0].principal_id
}