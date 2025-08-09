output "id" {
  description = "The ID of the application insights"
  value       = azurerm_application_insights.main.id
}

output "name" {
  description = "The name of the application insights"
  value       = azurerm_application_insights.main.name
}

output "instrumentation_key" {
  description = "The instrumentation key of the application insights"
  value       = azurerm_application_insights.main.instrumentation_key
  sensitive   = true
}

output "connection_string" {
  description = "The connection string of the application insights"
  value       = azurerm_application_insights.main.connection_string
  sensitive   = true
}