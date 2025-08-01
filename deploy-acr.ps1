param(
    [Parameter(Mandatory=$true)]
    [string]$SubscriptionId,
    
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroupName,
    
    [Parameter(Mandatory=$true)]
    [string]$AcrName,
    
    [Parameter(Mandatory=$true)]
    [string]$WebAppName,
    
    [Parameter(Mandatory=$true)]
    [string]$AzureOpenAIEndpoint,
    
    [Parameter(Mandatory=$false)]
    [string]$ImageTag = "latest",
    
    [Parameter(Mandatory=$false)]
    [string]$Location = "East US",
    
    [Parameter(Mandatory=$false)]
    [string]$StorageAccountName = ""
)

Write-Host "🐳 Starting Docker deployment to Azure Container Registry with File Storage..." -ForegroundColor Green

# Set subscription
az account set --subscription $SubscriptionId

# Create resource group if it doesn't exist
Write-Host "📦 Creating resource group..." -ForegroundColor Yellow
az group create --name $ResourceGroupName --location $Location

# Create storage account for Azure File Storage if not provided
if ([string]::IsNullOrEmpty($StorageAccountName)) {
    $StorageAccountName = "$($AcrName.ToLower())storage"
    Write-Host "💾 No storage account specified, using: $StorageAccountName" -ForegroundColor Cyan
}

Write-Host "💾 Creating Azure Storage Account for File Storage..." -ForegroundColor Yellow
az storage account create `
    --name $StorageAccountName `
    --resource-group $ResourceGroupName `
    --location $Location `
    --sku Standard_LRS `
    --kind StorageV2 `
    --access-tier Hot

# Create file share for persistent data
Write-Host "📁 Creating Azure File Share..." -ForegroundColor Yellow
az storage share create `
    --name "nott3chatdata" `
    --account-name $StorageAccountName `
    --quota 5

# Create Azure Container Registry
Write-Host "🏗️ Creating Azure Container Registry..." -ForegroundColor Yellow
az acr create --resource-group $ResourceGroupName --name $AcrName --sku Standard --admin-enabled true

# Get ACR login server
$acrLoginServer = az acr show --name $AcrName --resource-group $ResourceGroupName --query loginServer --output tsv
Write-Host "📡 ACR Login Server: $acrLoginServer" -ForegroundColor Cyan

# Login to ACR
Write-Host "🔐 Logging into ACR..." -ForegroundColor Yellow
az acr login --name $AcrName

# Build and push Docker image
Write-Host "🐳 Building and pushing Docker image..." -ForegroundColor Yellow
$imageName = "$acrLoginServer/nott3chat-backend:$ImageTag"

# Build the image
docker build -t $imageName ./backend

# Push to ACR
docker push $imageName

Write-Host "✅ Image pushed: $imageName" -ForegroundColor Green

# Create App Service Plan for Linux containers
Write-Host "🏗️ Creating App Service Plan..." -ForegroundColor Yellow
az appservice plan create `
    --name "$WebAppName-plan" `
    --resource-group $ResourceGroupName `
    --sku B1 `
    --is-linux true

# Create Web App for Containers
Write-Host "🚀 Creating Web App for Containers..." -ForegroundColor Yellow
az webapp create `
    --resource-group $ResourceGroupName `
    --plan "$WebAppName-plan" `
    --name $WebAppName `
    --deployment-container-image-name $imageName

# Enable container registry authentication
Write-Host "🔐 Configuring ACR authentication..." -ForegroundColor Yellow
$acrUsername = az acr credential show --name $AcrName --query username --output tsv
$acrPassword = az acr credential show --name $AcrName --query passwords[0].value --output tsv

az webapp config container set `
    --name $WebAppName `
    --resource-group $ResourceGroupName `
    --docker-custom-image-name $imageName `
    --docker-registry-server-url "https://$acrLoginServer" `
    --docker-registry-server-user $acrUsername `
    --docker-registry-server-password $acrPassword

# Enable system-assigned managed identity
Write-Host "🆔 Enabling managed identity..." -ForegroundColor Yellow
az webapp identity assign --resource-group $ResourceGroupName --name $WebAppName

# Configure application settings
Write-Host "⚙️ Configuring application settings..." -ForegroundColor Yellow
az webapp config appsettings set `
    --resource-group $ResourceGroupName `
    --name $WebAppName `
    --settings @(
        "ASPNETCORE_ENVIRONMENT=Production",
        "WEBSITES_ENABLE_APP_SERVICE_STORAGE=false",
        "WEBSITES_PORT=8080",
        "AzureOpenAI__Endpoint=$AzureOpenAIEndpoint",
        "AzureOpenAI__Models__0=gpt-4o-mini",
        "AzureOpenAI__Models__1=gpt-4o",
        "AzureOpenAI__Models__2=gpt-35-turbo",
        "AzureOpenAI__TitleModel=gpt-4o-mini",
        "AZURE_FILE_STORAGE_MOUNTED=true"
    )

# Configure Azure File Storage mount
Write-Host "🔧 Configuring Azure File Storage mount..." -ForegroundColor Yellow
$storageKey = az storage account keys list `
    --account-name $StorageAccountName `
    --resource-group $ResourceGroupName `
    --query "[0].value" -o tsv

# Remove existing storage mount if it exists
az webapp config storage-account delete `
    --resource-group $ResourceGroupName `
    --name $WebAppName `
    --custom-id "azurefileshare" 2>$null

# Add Azure File Storage mount
az webapp config storage-account add `
    --resource-group $ResourceGroupName `
    --name $WebAppName `
    --custom-id "azurefileshare" `
    --storage-type "AzureFiles" `
    --share-name "nott3chatdata" `
    --account-name $StorageAccountName `
    --access-key $storageKey `
    --mount-path "/mnt/azurefileshare"

# Enable continuous deployment
Write-Host "🔄 Enabling continuous deployment..." -ForegroundColor Yellow
az webapp deployment container config `
    --name $WebAppName `
    --resource-group $ResourceGroupName `
    --enable-cd true

# Get webhook URL for CI/CD
$webhookUrl = az webapp deployment container show-cd-url --name $WebAppName --resource-group $ResourceGroupName --query CI_CD_URL --output tsv
Write-Host "📡 Webhook URL for CI/CD: $webhookUrl" -ForegroundColor Cyan

# Configure ACR webhook
az acr webhook create `
    --registry $AcrName `
    --name "$WebAppName-webhook" `
    --uri $webhookUrl `
    --actions push `
    --scope "nott3chat-backend:$ImageTag"

Write-Host "✅ Docker deployment with Azure File Storage completed successfully!" -ForegroundColor Green
Write-Host "🌐 Your app is available at: https://$WebAppName.azurewebsites.net" -ForegroundColor Cyan
Write-Host "🐳 Container image: $imageName" -ForegroundColor Cyan
Write-Host "📡 ACR: https://$acrLoginServer" -ForegroundColor Cyan
Write-Host "💾 Storage Account: $StorageAccountName" -ForegroundColor Cyan
Write-Host "📁 File Share: nott3chatdata" -ForegroundColor Cyan
Write-Host "📂 Mount Path: /mnt/azurefileshare" -ForegroundColor Cyan
Write-Host "🗃️ Database Location: /mnt/azurefileshare/database.dat" -ForegroundColor Cyan
