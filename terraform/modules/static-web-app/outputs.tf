output "id" {
  description = "The ID of the static web app"
  value       = azurerm_static_web_app.main.id
}

output "name" {
  description = "The name of the static web app"
  value       = azurerm_static_web_app.main.name
}

output "default_host_name" {
  description = "The default hostname of the static web app"
  value       = azurerm_static_web_app.main.default_host_name
}

output "url" {
  description = "The URL of the static web app"
  value       = "https://${azurerm_static_web_app.main.default_host_name}"
}

output "api_key" {
  description = "The API key (deployment token) for the static web app"
  value       = azurerm_static_web_app.main.api_key
  sensitive   = true
}