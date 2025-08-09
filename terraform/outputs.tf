output "resource_group_name" {
  description = "The name of the created resource group"
  value       = module.resource_group.name
}

output "backend_url" {
  description = "The URL of the backend App Service"
  value       = module.app_service.url
}

output "frontend_url" {
  description = "The URL of the frontend Static Web App"
  value       = module.static_web_app.url
}

output "static_web_app_deployment_token" {
  description = "The deployment token for the Static Web App (use with npx @azure/static-web-apps-cli deploy)"
  value       = module.static_web_app.api_key
  sensitive   = true
}

output "key_vault_name" {
  description = "The name of the Key Vault"
  value       = var.enable_key_vault ? module.key_vault[0].name : ""
}

output "storage_account_name" {
  description = "The name of the Storage Account"
  value       = module.storage_account.name
}

output "app_service_name" {
  description = "The name of the App Service"
  value       = module.app_service.name
}

output "static_web_app_name" {
  description = "The name of the Static Web App"
  value       = module.static_web_app.name
}

output "redirect_app_url" {
  description = "The URL of the redirect web app"
  value       = var.enable_redirect_web_app ? module.redirect_app[0].app_url : ""
}

output "redirect_app_name" {
  description = "The name of the redirect web app"
  value       = var.enable_redirect_web_app ? var.redirect_app_name : ""
}

output "redirect_web_config" {
  description = "The web.config content for the redirect app (deploy this file to the app)"
  value       = var.enable_redirect_web_app ? module.redirect_app[0].web_config_content : ""
  sensitive   = false
}