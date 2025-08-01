🎯 Summary of Docker + ACR Deployment with Azure File Storage
I've created a comprehensive Docker deployment solution for your NotT3Chat backend with Azure Container Registry and persistent Azure File Storage. Here's what was created:

📁 Files Created:

Dockerfile - Multi-stage Docker build with Azure File Storage support
.dockerignore - Optimized build context
docker-compose.yml - Local development environment with file storage mapping
deploy-acr.ps1 - Complete ACR deployment automation with Azure File Storage
buildDocker.ps1 - Local build script
deploy-acr.yml - CI/CD pipeline with file storage configuration
DOCKER_DEPLOYMENT.md - Comprehensive deployment guide

## Step 1: Azure File Storage Integration
The Docker solution now includes persistent storage using Azure File Storage:

### Storage Features:
- 💾 **Persistent Database** - SQLite database stored in Azure File Storage
- 🔄 **Deployment Survival** - Data persists across container deployments
- 📁 **File Share Mount** - Automatic mounting at `/mnt/azurefileshare`
- 🏠 **Local Development** - Local volume mapping for development
- 🔧 **Auto Configuration** - Automatic storage account and file share creation

### Storage Architecture:
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Container App  │───▶│ Azure File Share│───▶│  Persistent DB  │
│ /mnt/azurefileshare  │    │ nott3chatdata   │    │  database.dat   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Step 4: Create ACR Deployment Script with Azure File Storage
Created deploy-acr.ps1 with comprehensive Azure Container Registry deployment automation:

### Features:
- ✅ **Resource Group Creation** - Automatically creates resource group if needed
- ✅ **Storage Account Setup** - Creates Azure Storage Account for file persistence
- ✅ **File Share Creation** - Creates Azure File Share for database storage
- ✅ **ACR Setup** - Creates Azure Container Registry with admin enabled
- ✅ **Docker Build & Push** - Builds image and pushes to ACR
- ✅ **Web App Creation** - Creates Linux Web App for Containers
- ✅ **Storage Mount** - Automatically mounts Azure File Share to container
- ✅ **Authentication** - Configures ACR credentials for Web App
- ✅ **Managed Identity** - Enables system-assigned managed identity
- ✅ **App Settings** - Configures all required environment variables
- ✅ **Continuous Deployment** - Sets up webhook for auto-deployment
- ✅ **Security** - Uses best practices for container security

### Usage:
```powershell
.\deploy-acr.ps1 `
  -SubscriptionId "your-subscription-id" `
  -ResourceGroupName "nott3chat-containers-rg" `
  -AcrName "nott3chatacr" `
  -WebAppName "nott3chat-container-app" `
  -AzureOpenAIEndpoint "https://your-openai.openai.azure.com/" `
  -StorageAccountName "nott3chatstorage"
```

### Storage Configuration:
- **Storage Account**: Auto-created if not specified (e.g., `nott3chatacrstorage`)
- **File Share**: `nott3chatdata` with 5GB quota
- **Mount Path**: `/mnt/azurefileshare` in container
- **Database Path**: `/mnt/azurefileshare/database.dat`

## Step 5: Create GitHub Actions Workflow for CI/CD
Created .github/workflows/deploy-acr.yml for automatic deployment:

### CI/CD Pipeline Features:
- 🚀 **Automatic Deployment** - Triggers on push to main branch
- 🐳 **Docker Build** - Builds container image in GitHub Actions
- 📦 **ACR Push** - Pushes image to Azure Container Registry
- 🔄 **Auto Deploy** - Webhook triggers Web App deployment
- 🔐 **Secure** - Uses GitHub Secrets for credentials
- ✅ **Health Check** - Verifies deployment success

### GitHub Secrets Required:
```
AZURE_CREDENTIALS - Service principal JSON
AZURE_SUBSCRIPTION_ID - Your Azure subscription ID
ACR_NAME - Azure Container Registry name
ACR_USERNAME - ACR admin username
ACR_PASSWORD - ACR admin password
WEBAPP_NAME - Web App name
RESOURCE_GROUP - Resource group name
AZURE_OPENAI_ENDPOINT - OpenAI endpoint URL
STORAGE_ACCOUNT_NAME - Azure Storage Account name for File Storage
```

### Workflow File (.github/workflows/deploy-acr.yml):
```yaml
name: Deploy to Azure Container Registry

on:
  push:
    branches: [ main ]
  workflow_dispatch:

env:
  REGISTRY: ${{ secrets.ACR_NAME }}.azurecr.io
  IMAGE_NAME: nott3chat-backend

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: 'Checkout GitHub Action'
      uses: actions/checkout@v4

    - name: 'Login to Azure'
      uses: azure/login@v1
      with:
        creds: ${{ secrets.AZURE_CREDENTIALS }}

    - name: 'Login to ACR'
      uses: azure/docker-login@v1
      with:
        login-server: ${{ env.REGISTRY }}
        username: ${{ secrets.ACR_USERNAME }}
        password: ${{ secrets.ACR_PASSWORD }}

    - name: 'Build and Push Docker Image'
      run: |
        docker build -t ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }} ./backend
        docker build -t ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest ./backend
        docker push ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
        docker push ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest

    - name: 'Update Web App Container Image'
      uses: azure/webapps-deploy@v2
      with:
        app-name: ${{ secrets.WEBAPP_NAME }}
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}

    - name: 'Configure App Settings'
      run: |
        az webapp config appsettings set \
          --resource-group ${{ secrets.RESOURCE_GROUP }} \
          --name ${{ secrets.WEBAPP_NAME }} \
          --settings \
            "ASPNETCORE_ENVIRONMENT=Production" \
            "WEBSITES_ENABLE_APP_SERVICE_STORAGE=false" \
            "WEBSITES_PORT=8080" \
            "AzureOpenAI__Endpoint=${{ secrets.AZURE_OPENAI_ENDPOINT }}" \
            "AzureOpenAI__Models__0=gpt-4o-mini" \
            "AzureOpenAI__Models__1=gpt-4o" \
            "AzureOpenAI__Models__2=gpt-35-turbo" \
            "AzureOpenAI__TitleModel=gpt-4o-mini"

    - name: 'Health Check'
      run: |
        sleep 60
        curl -f https://${{ secrets.WEBAPP_NAME }}.azurewebsites.net/health || exit 1
```

### Setup Instructions:
1. **Create Service Principal**:
```powershell
az ad sp create-for-rbac --name "nott3chat-github-actions" --role contributor --scopes /subscriptions/YOUR_SUBSCRIPTION_ID --sdk-auth
```

2. **Add GitHub Secrets**:
   - Go to your repository → Settings → Secrets and Variables → Actions
   - Add all required secrets listed above

3. **Enable GitHub Actions**:
   - Commit the workflow file to `.github/workflows/deploy-acr.yml`
   - Push to main branch to trigger first deployment

## Step 6: Setup GitHub Secrets and Complete CI/CD

### Required GitHub Secrets Setup:

1. **AZURE_CREDENTIALS**: Create service principal and add JSON output
```powershell
az ad sp create-for-rbac --name "nott3chat-github-actions" \
  --role contributor \
  --scopes /subscriptions/YOUR_SUBSCRIPTION_ID \
  --sdk-auth
```

2. **AZURE_SUBSCRIPTION_ID**: Your Azure subscription ID
```powershell
az account show --query id --output tsv
```

3. **ACR_NAME**: Your Azure Container Registry name (e.g., "nott3chatacr")

4. **ACR_USERNAME** and **ACR_PASSWORD**: Get from ACR
```powershell
$acrName = "your-acr-name"
az acr credential show --name $acrName --query username --output tsv
az acr credential show --name $acrName --query passwords[0].value --output tsv
```

5. **WEBAPP_NAME**: Your Web App name (e.g., "nott3chat-container-app")

6. **RESOURCE_GROUP**: Your resource group name (e.g., "nott3chat-containers-rg")

7. **AZURE_OPENAI_ENDPOINT**: Your OpenAI endpoint URL

8. **STORAGE_ACCOUNT_NAME**: Your Azure Storage Account name for file persistence
```powershell
# Get storage account name (the one created by deploy-acr.ps1)
echo "nott3chatacrstorage"  # or your custom storage account name
```

### GitHub Repository Setup:
1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** for each secret above
4. Commit and push the workflow file to trigger deployment

## Step 7: Verify Deployment

### Test the deployment:
```powershell
# Health check
Invoke-RestMethod -Uri "https://your-webapp-name.azurewebsites.net/health" -Method GET

# Check container logs
az webapp log tail --resource-group "your-resource-group" --name "your-webapp-name"

# View deployment status
az webapp deployment list --resource-group "your-resource-group" --name "your-webapp-name"

# Verify Azure File Storage mount
az webapp config storage-account list --resource-group "your-resource-group" --name "your-webapp-name"
```

## Step 8: Azure File Storage Management

### Managing Your Persistent Database Storage:

```powershell
# List files in the storage share
az storage file list `
    --share-name "nott3chatdata" `
    --account-name "your-storage-account" `
    --account-key "your-storage-key"

# Download database backup
az storage file download `
    --share-name "nott3chatdata" `
    --path "database.dat" `
    --dest "./database-backup.dat" `
    --account-name "your-storage-account" `
    --account-key "your-storage-key"

# Upload database restore
az storage file upload `
    --share-name "nott3chatdata" `
    --source "./database-restore.dat" `
    --path "database.dat" `
    --account-name "your-storage-account" `
    --account-key "your-storage-key"

# Monitor storage usage
az storage share show `
    --name "nott3chatdata" `
    --account-name "your-storage-account" `
    --account-key "your-storage-key" `
    --query "properties.shareQuota"
```

### Troubleshooting Azure File Storage:

```powershell
# Check if storage mount is working
az webapp ssh --resource-group "your-resource-group" --name "your-webapp-name"
# In SSH session:
ls -la /mnt/azurefileshare/
df -h /mnt/azurefileshare

# Verify mount configuration
az webapp config storage-account show --resource-group "your-resource-group" --name "your-webapp-name" --custom-id "azurefileshare"

# Restart web app if storage issues persist
az webapp restart --resource-group "your-resource-group" --name "your-webapp-name"
```

🚀 Quick Start Examples:
Local Development with Azure File Storage:

# Build locally
.\buildDocker.ps1

# Run with Docker Compose (maps local ./data to /mnt/azurefileshare)
docker-compose up

Deploy to Azure with File Storage:

.\deploy-acr.ps1 `
  -SubscriptionId "your-subscription-id" `
  -ResourceGroupName "nott3chat-containers-rg" `
  -AcrName "nott3chatacr" `
  -WebAppName "nott3chat-container-app" `
  -AzureOpenAIEndpoint "https://your-openai.openai.azure.com/" `
  -StorageAccountName "nott3chatstorage"


🐳 Key Features:
✅ Multi-stage Docker build for optimized images
✅ Security hardened (non-root user, minimal attack surface)
✅ Azure File Storage for persistent database
✅ Health checks built-in
✅ Auto-scaling support
✅ CI/CD ready with GitHub Actions
✅ Managed Identity for secure Azure OpenAI access
✅ Continuous deployment with ACR webhooks
✅ Cost optimized with proper resource sizing
✅ Data persistence across deployments

🏗️ Architecture Benefits:
Containerized - Consistent environments across dev/prod
Private Registry - Secure image storage in ACR
Persistent Storage - Azure File Storage for database persistence
Managed Identity - No secrets in container images
Auto-deployment - Push to git triggers deployment
Health monitoring - Built-in health checks and logging
Scalable - Azure Web App auto-scaling
Data Backup - Easy backup/restore through Azure File Storage