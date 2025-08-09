resource "azurerm_service_plan" "redirect" {
  name                = "${var.app_name}-asp"
  resource_group_name = var.resource_group_name
  location            = var.location
  os_type             = "Windows"
  sku_name            = "F1"

  tags = var.tags
}

resource "azurerm_windows_web_app" "redirect" {
  name                = var.app_name
  resource_group_name = var.resource_group_name
  location            = var.location
  service_plan_id     = azurerm_service_plan.redirect.id
  https_only          = true

  site_config {
    always_on = false  # F1 plan doesn't support always_on
    
    application_stack {
      current_stack  = "dotnet"
      dotnet_version = "v4.0"
    }
  }

  app_settings = {
    "ASPNETCORE_ENVIRONMENT" = "Production"
  }

  tags = var.tags

  depends_on = [azurerm_service_plan.redirect]
}

# Note: The web.config file needs to be deployed manually after the app is created.
# You can use the Azure Portal, Azure CLI, FTP, or GitHub Actions to deploy it.
# The content is available in the output "web_config_content"

# Create the web.config content as a local file for reference
resource "local_file" "web_config" {
  filename = "${path.module}/generated-web.config"
  content  = <<-EOT
<?xml version="1.0" encoding="utf-8"?> 
<configuration> 
  <system.webServer> 
    <rewrite> 
      <rules> 
        <rule name="Redirect all to static web app" stopProcessing="true"> 
          <match url="(.*)" /> 
          <action type="Redirect" url="${var.redirect_url}/" redirectType="Permanent" /> 
        </rule> 
      </rules> 
    </rewrite> 
  </system.webServer> 
</configuration>
  EOT
}

# Output instructions for deploying the web.config
output "deployment_instructions" {
  value = <<-EOT
    
    To deploy the web.config to ${azurerm_windows_web_app.redirect.name}:
    
    1. Using Azure CLI:
       az webapp deployment source config-zip --resource-group ${var.resource_group_name} --name ${azurerm_windows_web_app.redirect.name} --src web.config.zip
    
    2. Using FTP:
       - Get FTP credentials from Azure Portal
       - Upload web.config to /site/wwwroot/
    
    3. Using Azure Portal:
       - Go to App Service > Advanced Tools (Kudu)
       - Navigate to Debug console > CMD
       - Upload web.config to D:\home\site\wwwroot\
  EOT
}