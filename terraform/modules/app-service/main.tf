# Data source to reference the existing ACR in Chat resource group
data "azurerm_container_registry" "acr" {
  name                = "HubChat"
  resource_group_name = "Chat"
}

resource "azurerm_service_plan" "main" {
  name                = "${var.namespace_name}-asp"
  resource_group_name = var.resource_group_name
  location            = var.location
  os_type             = "Linux"
  sku_name            = "F1"
  zone_balancing_enabled = false

  tags = var.tags
}

resource "azurerm_linux_web_app" "main" {
  name                = var.app_service_name
  resource_group_name = var.resource_group_name
  location            = var.location
  service_plan_id     = azurerm_service_plan.main.id
  https_only          = true
  public_network_access_enabled = true

  identity {
    type = "SystemAssigned"
  }

  site_config {
    always_on = false  # F1 plan doesn't support always_on
    
    application_stack {
      docker_image_name   = "nott3chat-backend:latest"
      docker_registry_url = "https://hubchat.azurecr.io"
    }
    
    # Use managed identity for ACR authentication
    container_registry_use_managed_identity = true
    
    # CORS configuration
    cors {
      allowed_origins     = [var.web_url]
      support_credentials = true
    }
  }

  storage_account {
    name         = "database-mount"
    type         = "AzureFiles"
    account_name = var.storage_account_name
    share_name   = var.file_share_name
    access_key   = var.storage_access_key
    mount_path   = "/mnt/azurefileshare"
  }

  app_settings = merge({
    "ASPNETCORE_ENVIRONMENT"                    = "Production"
    "WEBSITES_ENABLE_APP_SERVICE_STORAGE"      = "true"
    "DOCKER_REGISTRY_SERVER_URL"               = "https://hubchat.azurecr.io"
    "DOCKER_ENABLE_CI"                          = "true"
    "WEBSITES_PORT"                             = "80"
    "WEBSITES_CONTAINER_START_TIME_LIMIT"       = "1800"
    "ConnectionStrings__DefaultConnection"     = "Data Source=/mnt/azurefileshare/database.dat"
  }, var.enable_key_vault ? {
    # Key Vault enabled - use Key Vault references
    "Jwt__SecretKey"   = var.jwt_secret_reference
  } : {
    # Key Vault disabled - generate JWT secret
    "Jwt__SecretKey"   = random_password.jwt_fallback[0].result
  }, var.app_insights_connection_string != "" ? {
    "APPLICATIONINSIGHTS_CONNECTION_STRING" = var.app_insights_connection_string
  } : {}, var.enable_key_vault && var.openai_secret_reference != "" ? {
    # OpenAI key from Key Vault
    "OpenAI__ApiKey" = var.openai_secret_reference
  } : !var.enable_key_vault && var.openai_api_key != "" ? {
    # OpenAI key from environment variable
    "OpenAI__ApiKey" = var.openai_api_key
  } : {}, var.enable_key_vault && var.perplexity_secret_reference != "" ? {
    # Perplexity key from Key Vault
    "Perplexity__ApiKey" = var.perplexity_secret_reference
  } : !var.enable_key_vault && var.perplexity_api_key != "" ? {
    # Perplexity key from environment variable
    "Perplexity__ApiKey" = var.perplexity_api_key
  } : {}, var.web_url != "" ? {
    "Cors__AllowedOrigins__0" = var.web_url
  } : {})

  tags = var.tags

  depends_on = [
    azurerm_service_plan.main
  ]
}

# Generate fallback JWT secret when Key Vault is disabled
resource "random_password" "jwt_fallback" {
  count   = var.enable_key_vault ? 0 : 1
  length  = 64
  special = true
}

# Grant Key Vault access to the managed identity via RBAC (more stable than access policies)
resource "azurerm_role_assignment" "key_vault_secrets_user" {
  count                = var.enable_key_vault ? 1 : 0
  scope                = var.key_vault_id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_linux_web_app.main.identity[0].principal_id
  
  depends_on = [azurerm_linux_web_app.main]
}

# Assign AcrPull role to the web app's managed identity for accessing the container registry
resource "azurerm_role_assignment" "acr_pull" {
  scope                = data.azurerm_container_registry.acr.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_linux_web_app.main.identity[0].principal_id
  
  depends_on = [azurerm_linux_web_app.main]
}