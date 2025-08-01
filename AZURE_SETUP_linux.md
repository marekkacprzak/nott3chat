🐧 Azure Linux App Service Deployment Guide

Step 1: Create Linux App Service Resources

-------------------- start ----------------

# Login to Azure
az login

# Create resource group
az group create --name "nott3chat-linux-rg" --location "East US"

# Create Linux App Service Plan
az appservice plan create `
    --name "nott3chat-linux-plan" `
    --resource-group "nott3chat-linux-rg" `
    --sku "B1" `
    --is-linux true

# Create Linux Web App with .NET 8
az webapp create `
    --resource-group "nott3chat-linux-rg" `
    --plan "nott3chat-linux-plan" `
    --name "nott3chat-linux-backend" `
    --runtime "DOTNETCORE|8.0"

-------------------- end ----------------

Step 2: Build for Linux Deployment
Create a Linux-specific deployment script deploy-to-azure-linux.ps1:

-------------------- start ----------------

param(
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroupName,
    
    [Parameter(Mandatory=$true)]
    [string]$WebAppName,
    
    [Parameter(Mandatory=$true)]
    [string]$AzureOpenAIEndpoint
)

Write-Host "🐧 Starting deployment to Azure Linux Web App..." -ForegroundColor Green

# Build and publish for Linux
Write-Host "📦 Building application for Linux..." -ForegroundColor Yellow
Set-Location backend

# Clean previous builds
dotnet clean

# Restore packages
dotnet restore

# Publish for Linux runtime
dotnet publish -c Release -o ./publish-linux --runtime linux-x64 --self-contained false

# Create deployment package
Write-Host "📦 Creating Linux deployment package..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "./deployment-linux"
Copy-Item -Path "./publish-linux/*" -Destination "./deployment-linux/" -Recurse -Force

# Create startup script for Linux
$startupScript = @"
#!/bin/bash
dotnet NotT3ChatBackend.dll
"@
$startupScript | Out-File -FilePath "./deployment-linux/startup.sh" -Encoding UTF8 -NoNewline

# Create the ZIP file for Linux
Compress-Archive -Path "./deployment-linux/*" -DestinationPath "./nott3chat-backend-linux.zip" -Force

# Deploy to Azure Linux Web App
Write-Host "🌐 Deploying to Azure Linux..." -ForegroundColor Yellow
az webapp deployment source config-zip `
    --resource-group $ResourceGroupName `
    --name $WebAppName `
    --src "./nott3chat-backend-linux.zip"

# Configure app settings for Linux
Write-Host "⚙️ Configuring Linux application settings..." -ForegroundColor Yellow
az webapp config appsettings set `
    --resource-group $ResourceGroupName `
    --name $WebAppName `
    --settings @(
        "ASPNETCORE_ENVIRONMENT=Production",
        "ASPNETCORE_URLS=http://+:8080",
        "PORT=8080",
        "AzureOpenAI__Endpoint=$AzureOpenAIEndpoint",
        "AzureOpenAI__Models__0=gpt-4o-mini",
        "AzureOpenAI__Models__1=gpt-4o",
        "AzureOpenAI__Models__2=gpt-35-turbo",
        "AzureOpenAI__TitleModel=gpt-4o-mini"
    )

# Set startup command for Linux
az webapp config set `
    --resource-group $ResourceGroupName `
    --name $WebAppName `
    --startup-file "dotnet NotT3ChatBackend.dll"

Write-Host "✅ Linux deployment completed successfully!" -ForegroundColor Green
Write-Host "🌐 Your app is available at: https://$WebAppName.azurewebsites.net" -ForegroundColor Cyan

Set-Location ..

------------------ end --------------------

Step 4: Configure Program.cs for Linux
Ensure your Program.cs is configured for Linux hosting:

----------------- start -----------------

// Add this configuration for Linux hosting
var builder = WebApplication.CreateBuilder(args);

// Configure Kestrel for Linux
builder.WebHost.ConfigureKestrel(options =>
{
    var port = Environment.GetEnvironmentVariable("PORT") ?? "8080";
    options.ListenAnyIP(int.Parse(port));
});

// ... rest of your configuration

----------------- end -----------------

Step 5: Deploy to Linux
Run the Linux deployment script:

----------------- start -----------------

# Example deployment to Linux
.\deploy-to-azure-linux.ps1 `
    -ResourceGroupName "nott3chat-linux-rg" `
    -WebAppName "nott3chat-linux-backend" `
    -AzureOpenAIEndpoint "https://your-openai-resource.openai.azure.com/"

----------------- end -----------------

Step 6: Enable Managed Identity on Linux

----------------- start -----------------

# Enable system-assigned managed identity
az webapp identity assign `
    --resource-group "nott3chat-linux-rg" `
    --name "nott3chat-linux-backend"

# Get the principal ID
$principalId = az webapp identity show `
    --resource-group "nott3chat-linux-rg" `
    --name "nott3chat-linux-backend" `
    --query principalId -o tsv

# Grant Azure OpenAI permissions
az role assignment create `
    --assignee $principalId `
    --role "Cognitive Services OpenAI User" `
    --scope "/subscriptions/YOUR_SUBSCRIPTION_ID/resourceGroups/YOUR_OPENAI_RG/providers/Microsoft.CognitiveServices/accounts/YOUR_OPENAI_RESOURCE"

----------------- end -----------------

Step 7: Configure CORS for Linux

----------------- start -----------------

# Configure CORS for your frontend
az webapp cors add `
    --resource-group "nott3chat-linux-rg" `
    --name "nott3chat-linux-backend" `
    --allowed-origins "https://your-frontend-domain.com" "http://localhost:5173"

----------------- end -----------------

🔧 Linux-Specific Configuration

Database Path Configuration
For Linux, update your database configuration:

----------------- start -----------------

// In your Program.cs, configure SQLite for Linux
if (Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") == "Production")
{
    // Linux production path
    var dbPath = "/home/data/database.dat";
    var directory = Path.GetDirectoryName(dbPath);
    if (!Directory.Exists(directory))
    {
        Directory.CreateDirectory(directory);
    }
    connectionString = $"Data Source={dbPath}";
}
else
{
    // Development path
    connectionString = "Data Source=database.dat";
}

----------------- end -----------------

Environment Variables for Linux
Set these additional environment variables:

----------------- start -----------------

az webapp config appsettings set `
    --resource-group "nott3chat-linux-rg" `
    --name "nott3chat-linux-backend" `
    --settings @(
        "DOTNET_RUNNING_IN_CONTAINER=true",
        "ASPNETCORE_FORWARDEDHEADERS_ENABLED=true",
        "TZ=UTC"
    )

----------------- end -----------------

🚀 Complete Linux Deployment Example

----------------- start -----------------

# 1. Create Linux resources
az group create --name "my-chat-linux-rg" --location "East US"

az appservice plan create `
    --name "my-chat-linux-plan" `
    --resource-group "my-chat-linux-rg" `
    --sku "B1" `
    --is-linux true

az webapp create `
    --resource-group "my-chat-linux-rg" `
    --plan "my-chat-linux-plan" `
    --name "my-chat-linux-app" `
    --runtime "DOTNETCORE|8.0"

# 2. Deploy the application
.\deploy-to-azure-linux.ps1 `
    -ResourceGroupName "my-chat-linux-rg" `
    -WebAppName "my-chat-linux-app" `
    -AzureOpenAIEndpoint "https://my-openai.openai.azure.com/"

# 3. Test the deployment
Invoke-RestMethod -Uri "https://my-chat-linux-app.azurewebsites.net/health" -Method GET

----------------- end -----------------

📊 Linux vs Windows Comparison

Feature	      Linux App Service	       Windows App Service
Cost	         ✅ Lower cost	        ❌ Higher cost
Performance	   ✅ Better performance	  ⚠️ Good performance
Startup Time	✅ Faster	              ⚠️ Slower
Memory Usage	✅ Lower	              ❌ Higher
Configuration	⚠️ More complex	      ✅ Simpler
Debugging	   ⚠️ SSH required	      ✅ Built-in tools

🔍 Monitoring Linux Deployment

----------------- start -----------------
# Check logs
az webapp log tail --resource-group "nott3chat-linux-rg" --name "nott3chat-linux-backend"

# SSH into the container (for debugging)
az webapp ssh --resource-group "nott3chat-linux-rg" --name "nott3chat-linux-backend"

# Check app metrics
az monitor metrics list --resource "/subscriptions/YOUR_SUB/resourceGroups/nott3chat-linux-rg/providers/Microsoft.Web/sites/nott3chat-linux-backend" --metric "CpuPercentage,MemoryPercentage"

----------------- end -----------------

📋 Linux Deployment Checklist
<input disabled="" type="checkbox"> Linux App Service Plan created
<input disabled="" type="checkbox"> Linux Web App created with .NET 8 runtime
<input disabled="" type="checkbox"> Application built with --runtime linux-x64
<input disabled="" type="checkbox"> Port 8080 configured in settings
<input disabled="" type="checkbox"> Startup command set to dotnet NotT3ChatBackend.dll
<input disabled="" type="checkbox"> Managed Identity enabled
<input disabled="" type="checkbox"> Azure OpenAI permissions granted
<input disabled="" type="checkbox"> Database path configured for Linux (/home/data/)
<input disabled="" type="checkbox"> CORS configured
<input disabled="" type="checkbox"> Health endpoint responding

