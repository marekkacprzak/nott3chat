🐧 Azure Linux App Service Deployment Guide

Step 1: Create Linux App Service Resources with Azure File Storage

-------------------- start ----------------

# Login to Azure
az login

# Create resource group
az group create --name "nott3chat-linux-rg" --location "East US"

# Create storage account for Azure File Storage
az storage account create `
    --name "nott3chatstorage$(Get-Random)" `
    --resource-group "nott3chat-linux-rg" `
    --location "East US" `
    --sku "Standard_LRS" `
    --kind "StorageV2"

# Get storage account name (replace with your actual storage account name)
$storageAccountName = "nott3chatstorage12345"

# Create file share for database persistence
az storage share create `
    --name "nott3chatdata" `
    --account-name $storageAccountName

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

# Mount Azure File Storage to the web app
$storageKey = az storage account keys list `
    --account-name $storageAccountName `
    --resource-group "nott3chat-linux-rg" `
    --query "[0].value" -o tsv

az webapp config storage-account add `
    --resource-group "nott3chat-linux-rg" `
    --name "nott3chat-linux-backend" `
    --custom-id "azurefileshare" `
    --storage-type "AzureFiles" `
    --share-name "nott3chatdata" `
    --account-name $storageAccountName `
    --access-key $storageKey `
    --mount-path "/mnt/azurefileshare"

-------------------- end ----------------

Step 2: Build for Linux Deployment with Azure File Storage
Create a Linux-specific deployment script deploy-to-azure-linux.ps1:

-------------------- start ----------------

param(
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroupName,
    
    [Parameter(Mandatory=$true)]
    [string]$WebAppName,
    
    [Parameter(Mandatory=$true)]
    [string]$AzureOpenAIEndpoint,
    
    [Parameter(Mandatory=$true)]
    [string]$StorageAccountName
)

Write-Host "🐧 Starting deployment to Azure Linux Web App with File Storage..." -ForegroundColor Green

# Configure Azure File Storage mount
Write-Host "💾 Setting up Azure File Storage..." -ForegroundColor Yellow
$storageKey = az storage account keys list `
    --account-name $StorageAccountName `
    --resource-group $ResourceGroupName `
    --query "[0].value" -o tsv

az webapp config storage-account add `
    --resource-group $ResourceGroupName `
    --name $WebAppName `
    --custom-id "azurefileshare" `
    --storage-type "AzureFiles" `
    --share-name "nott3chatdata" `
    --account-name $StorageAccountName `
    --access-key $storageKey `
    --mount-path "/mnt/azurefileshare"

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

# Create the ZIP file for Linux
Compress-Archive -Path "./deployment-linux/*" -DestinationPath "./nott3chat-backend-linux.zip" -Force

# Deploy to Azure Linux Web App
Write-Host "🌐 Deploying to Azure Linux..." -ForegroundColor Yellow
az webapp deployment source config-zip `
    --resource-group $ResourceGroupName `
    --name $WebAppName `
    --src "./nott3chat-backend-linux.zip"

# Configure app settings for Linux with Azure File Storage
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
        "AzureOpenAI__TitleModel=gpt-4o-mini",
        "AZURE_FILE_STORAGE_MOUNTED=true"
    )

# Set startup command for Linux
az webapp config set `
    --resource-group $ResourceGroupName `
    --name $WebAppName `
    --startup-file "dotnet NotT3ChatBackend.dll"

Write-Host "✅ Linux deployment with Azure File Storage completed successfully!" -ForegroundColor Green
Write-Host "🌐 Your app is available at: https://$WebAppName.azurewebsites.net" -ForegroundColor Cyan
Write-Host "💾 Database will persist in Azure File Storage at: /mnt/azurefileshare/database.dat" -ForegroundColor Cyan

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

🔧 Linux-Specific Configuration with Azure File Storage

Database Path Configuration with Azure File Storage
For Linux with persistent storage, update your database configuration:

----------------- start -----------------

// In your Program.cs, configure SQLite for Linux with Azure File Storage
if (Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") == "Production")
{
    // Azure File Storage path for Linux production
    var dbPath = "/mnt/azurefileshare/database.dat";
    var directory = Path.GetDirectoryName(dbPath);
    if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
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

🚀 Complete Linux Deployment Example with Azure File Storage

----------------- start -----------------

# 1. Create Linux resources with storage
az group create --name "my-chat-linux-rg" --location "East US"

# Create storage account
$storageAccountName = "mychat$(Get-Random)"
az storage account create `
    --name $storageAccountName `
    --resource-group "my-chat-linux-rg" `
    --location "East US" `
    --sku "Standard_LRS"

# Create file share
az storage share create `
    --name "nott3chatdata" `
    --account-name $storageAccountName

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

# 2. Deploy the application with file storage
.\deploy-to-azure-linux.ps1 `
    -ResourceGroupName "my-chat-linux-rg" `
    -WebAppName "my-chat-linux-app" `
    -AzureOpenAIEndpoint "https://my-openai.openai.azure.com/" `
    -StorageAccountName $storageAccountName

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

# Verify Azure File Storage mount
az webapp config storage-account list --resource-group "nott3chat-linux-rg" --name "nott3chat-linux-backend"

# Check file share contents
az storage file list --share-name "nott3chatdata" --account-name "YOUR_STORAGE_ACCOUNT"

----------------- end -----------------

💾 Azure File Storage Management

Managing Your Persistent Database Storage

----------------- start -----------------

# List files in the storage share
az storage file list `
    --share-name "nott3chatdata" `
    --account-name "YOUR_STORAGE_ACCOUNT" `
    --account-key "YOUR_STORAGE_KEY"

# Download database backup
az storage file download `
    --share-name "nott3chatdata" `
    --path "database.dat" `
    --dest "./database-backup.dat" `
    --account-name "YOUR_STORAGE_ACCOUNT" `
    --account-key "YOUR_STORAGE_KEY"

# Upload database restore
az storage file upload `
    --share-name "nott3chatdata" `
    --source "./database-restore.dat" `
    --path "database.dat" `
    --account-name "YOUR_STORAGE_ACCOUNT" `
    --account-key "YOUR_STORAGE_KEY"

# Create additional directories in file share
az storage directory create `
    --share-name "nott3chatdata" `
    --name "backups" `
    --account-name "YOUR_STORAGE_ACCOUNT" `
    --account-key "YOUR_STORAGE_KEY"

# Monitor storage usage
az storage share show `
    --name "nott3chatdata" `
    --account-name "YOUR_STORAGE_ACCOUNT" `
    --account-key "YOUR_STORAGE_KEY" `
    --query "properties.shareQuota"

----------------- end -----------------

🔧 Troubleshooting Azure File Storage

Common Issues and Solutions

----------------- start -----------------

# Issue: Database file not found
# Solution: Check mount path and create directory
az webapp ssh --resource-group "nott3chat-linux-rg" --name "nott3chat-linux-backend"
# In SSH session:
ls -la /mnt/azurefileshare/
mkdir -p /mnt/azurefileshare/
touch /mnt/azurefileshare/database.dat

# Issue: Permission denied on database file
# Solution: Check file permissions
chmod 666 /mnt/azurefileshare/database.dat

# Issue: Storage mount not working
# Solution: Verify storage account configuration
az webapp config storage-account list --resource-group "nott3chat-linux-rg" --name "nott3chat-linux-backend"

# Remount storage if needed
az webapp restart --resource-group "nott3chat-linux-rg" --name "nott3chat-linux-backend"

----------------- end -----------------

📋 Linux Deployment Checklist with Azure File Storage
<input disabled="" type="checkbox"> Storage account created for file persistence
<input disabled="" type="checkbox"> Azure File Share created (nott3chatdata)
<input disabled="" type="checkbox"> Linux App Service Plan created
<input disabled="" type="checkbox"> Linux Web App created with .NET 8 runtime
<input disabled="" type="checkbox"> Azure File Storage mounted to /mnt/azurefileshare
<input disabled="" type="checkbox"> Application built with --runtime linux-x64
<input disabled="" type="checkbox"> Port 8080 configured in settings
<input disabled="" type="checkbox"> Startup command set to dotnet NotT3ChatBackend.dll
<input disabled="" type="checkbox"> Managed Identity enabled
<input disabled="" type="checkbox"> Azure OpenAI permissions granted
<input disabled="" type="checkbox"> Database path configured for Azure File Storage (/mnt/azurefileshare/)
<input disabled="" type="checkbox"> CORS configured
<input disabled="" type="checkbox"> Health endpoint responding
<input disabled="" type="checkbox"> Database persistence verified across deployments

