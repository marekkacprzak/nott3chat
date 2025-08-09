data "azurerm_client_config" "current" {}

resource "azurerm_key_vault" "main" {
  name                       = "${var.namespace_name}-kv"
  location                   = var.location
  resource_group_name        = var.resource_group_name
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  soft_delete_retention_days = 7
  purge_protection_enabled   = false
  enable_rbac_authorization  = true

  tags = var.tags
}

# Grant admin access via RBAC instead of access policy
resource "azurerm_role_assignment" "key_vault_admin" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Administrator"
  principal_id         = data.azurerm_client_config.current.object_id
}

resource "azurerm_key_vault_secret" "jwt_secret" {
  name         = "Jwt--SecretKey"
  value        = var.jwt_secret_key != "" ? var.jwt_secret_key : random_password.jwt_secret[0].result
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [azurerm_key_vault.main]
}

resource "random_password" "jwt_secret" {
  count = var.jwt_secret_key != "" ? 0 : 1
  length  = 64
  special = true
}

resource "azurerm_key_vault_secret" "openai_api_key" {
  count        = var.openai_api_key != "" ? 1 : 0
  name         = "OpenAI--ApiKey"
  value        = var.openai_api_key
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [azurerm_key_vault.main]
}

resource "azurerm_key_vault_secret" "perplexity_api_key" {
  count        = var.perplexity_api_key != "" ? 1 : 0
  name         = "Perplexity--ApiKey"
  value        = var.perplexity_api_key
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [azurerm_key_vault.main]
}