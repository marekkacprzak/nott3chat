terraform {
  required_version = ">= 1.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy    = true
      recover_soft_deleted_key_vaults = true
    }
  }
}

# 1. Create Resource Group
module "resource_group" {
  source = "./modules/resource-group"
  
  namespace_name = var.namespace_name
  location       = var.location
  tags           = var.tags
}

# 2. Create Static Web App (Frontend) - Created early to get URL for backend
module "static_web_app" {
  source = "./modules/static-web-app"
  
  namespace_name      = var.namespace_name
  location            = var.location
  resource_group_name = module.resource_group.name
  tags                = var.tags
  
  depends_on = [module.resource_group]
}

# 3. Create Application Insights (optional)
module "application_insights" {
  count  = var.enable_application_insights ? 1 : 0
  source = "./modules/application-insights"
  
  namespace_name      = var.namespace_name
  location            = var.location
  resource_group_name = module.resource_group.name
  tags                = var.tags
  
  depends_on = [module.resource_group]
}

# 4. Create Key Vault (optional)
module "key_vault" {
  count  = var.enable_key_vault ? 1 : 0
  source = "./modules/key-vault"
  
  namespace_name      = var.namespace_name
  location            = var.location
  resource_group_name = module.resource_group.name
  openai_api_key      = var.openai_api_key
  perplexity_api_key  = var.perplexity_api_key
  tags                = var.tags
  
  depends_on = [module.resource_group]
}

# 5. Create Storage Account
module "storage_account" {
  source = "./modules/storage-account"
  
  namespace_name      = var.namespace_name
  location            = var.location
  resource_group_name = module.resource_group.name
  tags                = var.tags
  
  depends_on = [module.resource_group]
}

# 6. Create App Service (Backend) - depends on all previous resources including frontend
module "app_service" {
  source = "./modules/app-service"
  
  namespace_name                = var.namespace_name
  app_service_name              = var.app_service_name
  location                      = var.location
  resource_group_name           = module.resource_group.name
  enable_key_vault              = var.enable_key_vault
  key_vault_id                  = var.enable_key_vault ? module.key_vault[0].id : ""
  key_vault_name                = var.enable_key_vault ? module.key_vault[0].name : ""
  jwt_secret_reference          = var.enable_key_vault ? module.key_vault[0].jwt_secret_reference : ""
  openai_secret_reference       = var.enable_key_vault ? module.key_vault[0].openai_secret_reference : ""
  perplexity_secret_reference   = var.enable_key_vault ? module.key_vault[0].perplexity_secret_reference : ""
  openai_api_key                = var.openai_api_key
  perplexity_api_key            = var.perplexity_api_key
  storage_account_name          = module.storage_account.name
  file_share_name               = module.storage_account.file_share_name
  storage_access_key            = module.storage_account.primary_access_key
  app_insights_connection_string = var.enable_application_insights ? module.application_insights[0].connection_string : ""
  web_url                       = module.static_web_app.url
  tags                          = var.tags
  
  depends_on = [
    module.resource_group,
    module.key_vault,
    module.storage_account,
    module.static_web_app
  ]
}

# 7. Create Redirect Web App (Windows with .NET Framework for redirects) - optional
module "redirect_app" {
  count  = var.enable_redirect_web_app ? 1 : 0
  source = "./modules/redirect-app"
  
  app_name            = var.redirect_app_name
  location            = var.location
  resource_group_name = module.resource_group.name
  redirect_url        = module.static_web_app.url
  tags                = var.tags
  
  depends_on = [
    module.resource_group,
    module.static_web_app
  ]
}