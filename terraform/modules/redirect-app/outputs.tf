output "app_url" {
  description = "URL of the redirect web app"
  value       = "https://${azurerm_windows_web_app.redirect.default_hostname}"
}

output "app_id" {
  description = "ID of the redirect web app"
  value       = azurerm_windows_web_app.redirect.id
}

output "principal_id" {
  description = "Principal ID of the redirect web app (if identity is enabled)"
  value       = try(azurerm_windows_web_app.redirect.identity[0].principal_id, null)
}

output "web_config_content" {
  description = "Content of the web.config file"
  value       = local_file.web_config.content
}