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

# Check if storage mount already exists and remove it to avoid conflicts
Write-Host "🔧 Configuring storage mount..." -ForegroundColor Yellow
az webapp config storage-account delete `
    --resource-group $ResourceGroupName `
    --name $WebAppName `
    --custom-id "azurefileshare" 2>$null

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
Write-Host ""
Write-Host "📊 Storage Information:" -ForegroundColor Yellow
Write-Host "   Storage Account: $StorageAccountName" -ForegroundColor White
Write-Host "   File Share: nott3chatdata" -ForegroundColor White
Write-Host "   Mount Path: /mnt/azurefileshare" -ForegroundColor White

Set-Location ..