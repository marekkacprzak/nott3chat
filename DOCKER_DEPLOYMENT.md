# 🐳 Docker + Azure Container Registry Deployment Guide

This guide shows how to deploy NotT3Chat backend using Docker containers and Azure Container Registry (ACR).

## 📋 Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop) installed
- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) installed
- Azure subscription with permissions to create resources
- Azure OpenAI service deployed

## 🚀 Quick Start

### 1. Build Docker Image Locally

```pwsh
# Build the Docker image
.\build-docker.ps1

# Or build with custom tag
.\build-docker.ps1 -ImageTag "v1.0.0"
```

### 2. Test Locally with Docker

```pwsh
# Run the container locally
docker run -p 5128:8080 `
  -e "AzureOpenAI__Endpoint=https://your-openai.openai.azure.com/" `
  nott3chat-backend:latest

# Or use docker-compose
docker-compose up
```

### 3. Deploy to Azure Container Registry

```pwsh
# Deploy to ACR and Azure Web App
.\deploy-acr.ps1 `
  -SubscriptionId "your-subscription-id" `
  -ResourceGroupName "nott3chat-containers-rg" `
  -AcrName "nott3chatacr" `
  -WebAppName "nott3chat-container-app" `
  -AzureOpenAIEndpoint "https://your-openai.openai.azure.com/"
```

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Developer     │───▶│  Azure Container│───▶│   Azure Web App │
│   Local Build   │    │    Registry     │    │  for Containers │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Docker Image    │    │  Private Image  │    │  Running App    │
│ Built Locally   │    │    Storage      │    │   Production    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📁 File Structure

```
nott3chat/
├── backend/
│   ├── Dockerfile              # Multi-stage Docker build
│   ├── .dockerignore          # Files to exclude from build
│   └── ...backend files...
├── docker-compose.yml         # Local development setup
├── build-docker.ps1          # Local build script
├── deploy-acr.ps1            # ACR deployment script
└── .github/workflows/
    └── deploy-acr.yml        # CI/CD pipeline
```

## 🐳 Dockerfile Explanation

The [`backend/Dockerfile`](backend/Dockerfile) uses a multi-stage build:

1. **Base Stage**: Uses `mcr.microsoft.com/dotnet/aspnet:8.0` for runtime
2. **Build Stage**: Uses `mcr.microsoft.com/dotnet/sdk:8.0` to build the app
3. **Publish Stage**: Creates optimized publish output
4. **Final Stage**: Copies only the published files for a minimal image

Key features:
- ✅ Multi-stage build for smaller final image
- ✅ Non-root user for security
- ✅ Health check endpoint
- ✅ Proper port configuration (8080)
- ✅ Production-optimized settings

## 🏗️ Manual ACR Setup

If you prefer manual setup:

### 1. Create Azure Resources

```pwsh
# Login to Azure
az login

# Create resource group
az group create --name "nott3chat-containers-rg" --location "East US"

# Create Azure Container Registry
az acr create --resource-group "nott3chat-containers-rg" --name "nott3chatacr" --sku Standard --admin-enabled true

# Create App Service Plan for Linux containers
az appservice plan create --name "nott3chat-container-plan" --resource-group "nott3chat-containers-rg" --sku B1 --is-linux true
```

### 2. Build and Push Image

```pwsh
# Get ACR login server
$acrName = "nott3chatacr"
$acrLoginServer = az acr show --name $acrName --query loginServer --output tsv

# Login to ACR
az acr login --name $acrName

# Build and tag image
docker build -t "$acrLoginServer/nott3chat-backend:latest" ./backend

# Push to ACR
docker push "$acrLoginServer/nott3chat-backend:latest"
```

### 3. Create Web App for Containers

```pwsh
# Create web app
az webapp create `
  --resource-group "nott3chat-containers-rg" `
  --plan "nott3chat-container-plan" `
  --name "nott3chat-container-app" `
  --deployment-container-image-name "$acrLoginServer/nott3chat-backend:latest"

# Configure ACR credentials
$acrUsername = az acr credential show --name $acrName --query username --output tsv
$acrPassword = az acr credential show --name $acrName --query passwords[0].value --output tsv

az webapp config container set `
  --name "nott3chat-container-app" `
  --resource-group "nott3chat-containers-rg" `
  --docker-registry-server-url "https://$acrLoginServer" `
  --docker-registry-server-user $acrUsername `
  --docker-registry-server-password $acrPassword
```

## ⚙️ Configuration

### Environment Variables

Set these in Azure Web App settings:

```
ASPNETCORE_ENVIRONMENT = Production
WEBSITES_ENABLE_APP_SERVICE_STORAGE = false
WEBSITES_PORT = 8080
AzureOpenAI__Endpoint = https://your-openai.openai.azure.com/
AzureOpenAI__Models__0 = gpt-4o-mini
AzureOpenAI__Models__1 = gpt-4o
AzureOpenAI__Models__2 = gpt-35-turbo
AzureOpenAI__TitleModel = gpt-4o-mini
```

### Managed Identity Setup

```pwsh
# Enable managed identity
az webapp identity assign --resource-group "nott3chat-containers-rg" --name "nott3chat-container-app"

# Get principal ID
$principalId = az webapp identity show --resource-group "nott3chat-containers-rg" --name "nott3chat-container-app" --query principalId --output tsv

# Grant Azure OpenAI access
az role assignment create --assignee $principalId --role "Cognitive Services OpenAI User" --scope "/subscriptions/YOUR_SUBSCRIPTION_ID/resourceGroups/YOUR_OPENAI_RG/providers/Microsoft.CognitiveServices/accounts/YOUR_OPENAI_RESOURCE"
```

## 🔄 CI/CD with GitHub Actions

The `.github/workflows/deploy-acr.yml` file provides automatic deployment on push.

### Setup GitHub Secrets:

1. **AZURE_CREDENTIALS**: Service principal JSON
2. **ACR_USERNAME**: ACR admin username
3. **ACR_PASSWORD**: ACR admin password

### Create Service Principal:

```pwsh
az ad sp create-for-rbac --name "nott3chat-github-actions" --role contributor --scopes /subscriptions/YOUR_SUBSCRIPTION_ID --sdk-auth
```

## 📊 Monitoring and Logging

### View Container Logs

```pwsh
# Stream logs
az webapp log tail --resource-group "nott3chat-containers-rg" --name "nott3chat-container-app"

# Download logs
az webapp log download --resource-group "nott3chat-containers-rg" --name "nott3chat-container-app"
```

### Container Metrics

```pwsh
# Check container status
az webapp show --resource-group "nott3chat-containers-rg" --name "nott3chat-container-app" --query state

# View container settings
az webapp config container show --resource-group "nott3chat-containers-rg" --name "nott3chat-container-app"
```

## 🔧 Troubleshooting

### Common Issues

1. **Container not starting**:
   ```pwsh
   # Check logs
   az webapp log tail --resource-group "nott3chat-containers-rg" --name "nott3chat-container-app"
   ```

2. **ACR authentication issues**:
   ```pwsh
   # Refresh ACR credentials
   az acr credential renew --name "nott3chatacr" --password-name password
   ```

3. **Port configuration**:
   - Ensure `WEBSITES_PORT=8080` is set
   - Dockerfile exposes port 8080
   - Application listens on `http://+:8080`

### Health Check

Test the deployment:

```pwsh
# Health endpoint
Invoke-RestMethod -Uri "https://nott3chat-container-app.azurewebsites.net/health" -Method GET

# Container info
curl -s "https://nott3chat-container-app.azurewebsites.net/health" | jq .
```

## 💰 Cost Optimization

- **Use B1 pricing tier** for development/testing
- **Enable auto-scaling** for production workloads
- **Use spot instances** for non-critical workloads
- **Clean up unused images** in ACR regularly

## 🔒 Security Best Practices

- ✅ Use managed identity instead of connection strings
- ✅ Enable ACR admin user only when needed
- ✅ Use private endpoints for ACR in production
- ✅ Scan container images for vulnerabilities
- ✅ Use minimal base images (already implemented)
- ✅ Run containers as non-root user (already implemented)

## 📋 Deployment Checklist

- [ ] Docker Desktop installed and running
- [ ] Azure CLI installed and logged in
- [ ] Azure OpenAI resource created with models deployed
- [ ] ACR created with admin user enabled
- [ ] Container image built and pushed to ACR
- [ ] Web App for Containers created
- [ ] ACR authentication configured
- [ ] Environment variables set
- [ ] Managed identity enabled and permissions granted
- [ ] Health endpoint responding
- [ ] CORS configured for frontend
- [ ] CI/CD pipeline configured (optional)

## 🚀 Example Deployment Commands

```pwsh
# Complete deployment example
.\deploy-acr.ps1 `
  -SubscriptionId "12345678-1234-1234-1234-123456789012" `
  -ResourceGroupName "my-nott3chat-rg" `
  -AcrName "mynott3chatacr" `
  -WebAppName "my-nott3chat-app" `
  -AzureOpenAIEndpoint "https://my-openai.openai.azure.com/" `
  -ImageTag "v1.0.0" `
  -Location "East US"
```

Your NotT3Chat backend is now running in a secure, scalable Docker container on Azure! 🐳🚀
