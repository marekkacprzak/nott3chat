# Azure Web App Deployment Guide for NotT3Chat Backend

## 📦 Step 1: Prepare the Backend for Production

### 1.1 Create Production Configuration

Create `backend/appsettings.Production.json`:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning",
      "Microsoft.Hosting.Lifetime": "Information"
    }
  },
  "AllowedHosts": "*",
  "AzureOpenAI": {
    "Endpoint": "",
    "Models": ["gpt-4o-mini", "gpt-4o", "gpt-35-turbo"],
    "TitleModel": "gpt-4o-mini"
  },
  "ConnectionStrings": {
    "DefaultConnection": "Data Source=database.dat"
  }
}
```

### 1.2 Build and Publish the Application

Run these commands in PowerShell from the project root:

```pwsh
# Navigate to backend directory
cd backend

# Clean previous builds
dotnet clean

# Restore packages
dotnet restore

# Build for production
dotnet build -c Release

# Publish to a folder
dotnet publish -c Release -o ./publish --self-contained false
```

### 1.3 Create Deployment ZIP Package

```pwsh
# Create deployment directory
New-Item -ItemType Directory -Force -Path "./deployment"

# Copy published files
Copy-Item -Path "./publish/*" -Destination "./deployment/" -Recurse -Force

# Create web.config for Azure App Service
@"
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <location path="." inheritInChildApplications="false">
    <system.webServer>
      <handlers>
        <add name="aspNetCore" path="*" verb="*" modules="AspNetCoreModuleV2" resourceType="Unspecified" />
      </handlers>
      <aspNetCore processPath="dotnet" 
                  arguments=".\NotT3ChatBackend.dll" 
                  stdoutLogEnabled="false" 
                  stdoutLogFile=".\logs\stdout" 
                  hostingModel="inprocess" />
    </system.webServer>
  </location>
</configuration>
"@ | Out-File -FilePath "./deployment/web.config" -Encoding UTF8

# Create the ZIP file
Compress-Archive -Path "./deployment/*" -DestinationPath "./nott3chat-backend.zip" -Force

Write-Host "✅ Deployment package created: ./nott3chat-backend.zip" -ForegroundColor Green
```

## 🌐 Step 2: Azure Web App Setup

### 2.1 Create Azure Web App

Using Azure CLI:

```pwsh
# Login to Azure
az login

# Create resource group (if needed)
az group create --name "nott3chat-rg" --location "East US"

# Create App Service Plan
az appservice plan create --name "nott3chat-plan" --resource-group "nott3chat-rg" --sku "B1" --is-linux false

# Create Web App
az webapp create --resource-group "nott3chat-rg" --plan "nott3chat-plan" --name "nott3chat-backend" --runtime "DOTNET|8.0"
```

### 2.2 Configure Application Settings

Set these in the Azure Portal under **Configuration > Application Settings**:

```
ASPNETCORE_ENVIRONMENT = Production
WEBSITE_RUN_FROM_PACKAGE = 1
```

For Azure OpenAI configuration, add:
```
AzureOpenAI__Endpoint = https://your-resource.openai.azure.com/
AzureOpenAI__Models__0 = gpt-4o-mini
AzureOpenAI__Models__1 = gpt-4o
AzureOpenAI__Models__2 = gpt-35-turbo
AzureOpenAI__TitleModel = gpt-4o-mini
```

### 2.3 Enable Managed Identity

```pwsh
# Enable system-assigned managed identity
az webapp identity assign --resource-group "nott3chat-rg" --name "nott3chat-backend"
```

### 2.4 Grant Azure OpenAI Permissions

```pwsh
# Get the web app's managed identity principal ID
$principalId = az webapp identity show --resource-group "nott3chat-rg" --name "nott3chat-backend" --query principalId -o tsv

# Grant access to Azure OpenAI resource
az role assignment create --assignee $principalId --role "Cognitive Services OpenAI User" --scope "/subscriptions/YOUR_SUBSCRIPTION_ID/resourceGroups/YOUR_OPENAI_RG/providers/Microsoft.CognitiveServices/accounts/YOUR_OPENAI_RESOURCE"
```

## 🚀 Step 3: Deploy the Application

### 3.1 Deploy via Azure CLI

```pwsh
# Deploy the ZIP package
az webapp deployment source config-zip --resource-group "nott3chat-rg" --name "nott3chat-backend" --src "./nott3chat-backend.zip"
```

### 3.2 Alternative: Deploy via Azure Portal

1. Go to your Web App in the Azure Portal
2. Navigate to **Deployment Center**
3. Choose **ZIP Deploy**
4. Upload the `nott3chat-backend.zip` file
5. Click **Deploy**

### 3.3 Configure CORS for Frontend

```pwsh
# Configure CORS (replace with your frontend domain)
az webapp cors add --resource-group "nott3chat-rg" --name "nott3chat-backend" --allowed-origins "https://your-frontend-domain.com"

# For development, you might want to allow localhost
az webapp cors add --resource-group "nott3chat-rg" --name "nott3chat-backend" --allowed-origins "http://localhost:5173" "http://localhost:5174"
```

## 🔧 Step 4: Verify Deployment

### 4.1 Check Application Health

```pwsh
# Test the health endpoint
$webAppUrl = "https://nott3chat-backend.azurewebsites.net"
Invoke-RestMethod -Uri "$webAppUrl/health" -Method GET
```

### 4.2 Check Logs

```pwsh
# Enable logging
az webapp log config --resource-group "nott3chat-rg" --name "nott3chat-backend" --application-logging filesystem --level information

# Stream logs
az webapp log tail --resource-group "nott3chat-rg" --name "nott3chat-backend"
```

## 📝 Step 5: Frontend Configuration

Update your frontend's `.env` file to point to the deployed backend:

```env
VITE_API_URL=https://nott3chat-backend.azurewebsites.net
```

## 🔒 Security Considerations

1. **SSL/TLS**: Azure Web Apps provide HTTPS by default
2. **Authentication**: The app uses Azure AD authentication via Managed Identity
3. **CORS**: Configure only necessary origins
4. **Logging**: Monitor application logs for security events

## 📊 Monitoring and Scaling

### Enable Application Insights (Optional)

```pwsh
# Create Application Insights
az monitor app-insights component create --app "nott3chat-insights" --location "East US" --resource-group "nott3chat-rg"

# Get instrumentation key
$instrumentationKey = az monitor app-insights component show --app "nott3chat-insights" --resource-group "nott3chat-rg" --query instrumentationKey -o tsv

# Add to app settings
az webapp config appsettings set --resource-group "nott3chat-rg" --name "nott3chat-backend" --settings "APPLICATIONINSIGHTS_CONNECTION_STRING=InstrumentationKey=$instrumentationKey"
```

## 🎯 Quick Deployment Script

Save this as `deploy-to-azure.ps1`:

```pwsh
param(
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroupName,
    
    [Parameter(Mandatory=$true)]
    [string]$WebAppName,
    
    [Parameter(Mandatory=$true)]
    [string]$AzureOpenAIEndpoint
)

Write-Host "🚀 Starting deployment to Azure Web App..." -ForegroundColor Green

# Build and publish
Write-Host "📦 Building application..." -ForegroundColor Yellow
cd backend
dotnet clean
dotnet restore
dotnet publish -c Release -o ./publish --self-contained false

# Create deployment package
Write-Host "📦 Creating deployment package..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "./deployment"
Copy-Item -Path "./publish/*" -Destination "./deployment/" -Recurse -Force

# Create web.config
$webConfig = @"
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <location path="." inheritInChildApplications="false">
    <system.webServer>
      <handlers>
        <add name="aspNetCore" path="*" verb="*" modules="AspNetCoreModuleV2" resourceType="Unspecified" />
      </handlers>
      <aspNetCore processPath="dotnet" 
                  arguments=".\NotT3ChatBackend.dll" 
                  stdoutLogEnabled="false" 
                  stdoutLogFile=".\logs\stdout" 
                  hostingModel="inprocess" />
    </system.webServer>
  </location>
</configuration>
"@
$webConfig | Out-File -FilePath "./deployment/web.config" -Encoding UTF8

Compress-Archive -Path "./deployment/*" -DestinationPath "./nott3chat-backend.zip" -Force

# Deploy to Azure
Write-Host "🌐 Deploying to Azure..." -ForegroundColor Yellow
az webapp deployment source config-zip --resource-group $ResourceGroupName --name $WebAppName --src "./nott3chat-backend.zip"

# Configure app settings
Write-Host "⚙️ Configuring application settings..." -ForegroundColor Yellow
az webapp config appsettings set --resource-group $ResourceGroupName --name $WebAppName --settings @(
    "ASPNETCORE_ENVIRONMENT=Production",
    "WEBSITE_RUN_FROM_PACKAGE=1",
    "AzureOpenAI__Endpoint=$AzureOpenAIEndpoint",
    "AzureOpenAI__Models__0=gpt-4o-mini",
    "AzureOpenAI__Models__1=gpt-4o",
    "AzureOpenAI__Models__2=gpt-35-turbo",
    "AzureOpenAI__TitleModel=gpt-4o-mini"
)

Write-Host "✅ Deployment completed successfully!" -ForegroundColor Green
Write-Host "🌐 Your app is available at: https://$WebAppName.azurewebsites.net" -ForegroundColor Cyan

cd ..
```

## 🏃‍♂️ Quick Start Commands

Run these commands to deploy:

```pwsh
# 1. Create the production package
cd backend
dotnet publish -c Release -o ./publish --self-contained false

# 2. Create deployment ZIP
New-Item -ItemType Directory -Force -Path "./deployment"
Copy-Item -Path "./publish/*" -Destination "./deployment/" -Recurse -Force
@"
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <location path="." inheritInChildApplications="false">
    <system.webServer>
      <handlers>
        <add name="aspNetCore" path="*" verb="*" modules="AspNetCoreModuleV2" resourceType="Unspecified" />
      </handlers>
      <aspNetCore processPath="dotnet" arguments=".\NotT3ChatBackend.dll" stdoutLogEnabled="false" stdoutLogFile=".\logs\stdout" hostingModel="inprocess" />
    </system.webServer>
  </location>
</configuration>
"@ | Out-File -FilePath "./deployment/web.config" -Encoding UTF8
Compress-Archive -Path "./deployment/*" -DestinationPath "./nott3chat-backend.zip" -Force

# 3. Deploy to Azure (replace with your values)
az webapp deployment source config-zip --resource-group "your-rg" --name "your-webapp" --src "./nott3chat-backend.zip"
```

## 📋 Checklist

- [ ] Azure OpenAI resource created and models deployed
- [ ] Web App created with .NET 8 runtime
- [ ] Managed Identity enabled and granted permissions
- [ ] Application settings configured
- [ ] Backend deployed and health check passes
- [ ] CORS configured for frontend domain
- [ ] Frontend updated with production API URL
- [ ] SSL certificate working (automatic with Azure)
- [ ] Logs and monitoring configured

Your NotT3Chat backend should now be running on Azure Web App! 🎉

{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning",
      "Microsoft.Hosting.Lifetime": "Information"
    }
  },
  "AllowedHosts": "*",
  "AzureOpenAI": {
    "Endpoint": "",
    "Models": ["gpt-4o-mini", "gpt-4o", "gpt-35-turbo"],
    "TitleModel": "gpt-4o-mini"
  },
  "ConnectionStrings": {
    "DefaultConnection": "Data Source=database.dat"
  }
}


🎯 Summary
I've created a comprehensive Azure Web App deployment guide for your NotT3Chat backend that includes:

📁 Files Created:
backend/appsettings.Production.json - Production configuration
deploy-to-azure.ps1 - Automated deployment script

az webapp deployment source config-zip --resource-group "your-rg" --name "your-webapp" --src "./nott3chat-backend.zip"

# Run from the project root directory
.\deploy-to-azure.ps1 -ResourceGroupName "nott3chat-rg" -WebAppName "my-nott3chat-app" -AzureOpenAIEndpoint "https://my-openai-resource.openai.azure.com/"