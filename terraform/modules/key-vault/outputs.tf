output "id" {
  description = "The ID of the key vault"
  value       = azurerm_key_vault.main.id
}

output "name" {
  description = "The name of the key vault"
  value       = azurerm_key_vault.main.name
}

output "vault_uri" {
  description = "The URI of the key vault"
  value       = azurerm_key_vault.main.vault_uri
}

output "jwt_secret_reference" {
  description = "Key Vault reference for JWT secret"
  value       = "@Microsoft.KeyVault(VaultName=${azurerm_key_vault.main.name};SecretName=${azurerm_key_vault_secret.jwt_secret.name})"
}

output "openai_secret_reference" {
  description = "Key Vault reference for OpenAI API key"
  value       = var.openai_api_key != "" ? "@Microsoft.KeyVault(VaultName=${azurerm_key_vault.main.name};SecretName=${azurerm_key_vault_secret.openai_api_key[0].name})" : ""
}

output "perplexity_secret_reference" {
  description = "Key Vault reference for Perplexity API key"
  value       = var.perplexity_api_key != "" ? "@Microsoft.KeyVault(VaultName=${azurerm_key_vault.main.name};SecretName=${azurerm_key_vault_secret.perplexity_api_key[0].name})" : ""
}