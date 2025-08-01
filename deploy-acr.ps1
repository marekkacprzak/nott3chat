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
    [string]$Location = "East US"
)

Write-Host "🐳 Starting Docker deployment to Azure Container Registry..." -ForegroundColor Green

# Set subscription
az account set --subscription $SubscriptionId

# Create resource group if it doesn't exist
Write-Host "📦 Creating resource group..." -ForegroundColor Yellow
az group create --name $ResourceGroupName --location $Location

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
        "AzureOpenAI__TitleModel=gpt-4o-mini"
    )

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

Write-Host "✅ Docker deployment completed successfully!" -ForegroundColor Green
Write-Host "🌐 Your app is available at: https://$WebAppName.azurewebsites.net" -ForegroundColor Cyan
Write-Host "🐳 Container image: $imageName" -ForegroundColor Cyan
Write-Host "📡 ACR: https://$acrLoginServer" -ForegroundColor Cyan
