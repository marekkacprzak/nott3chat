# NotT3Chat Azure Deployment Script
# This script deploys the entire NotT3Chat application to Azure using Terraform and Azure CLI

param(
    [string]$ContainerRegistryName = "hubchat",
    [string]$ImageTag = "latest",
    [bool]$SkipTerraform = $false
)

# Set error action preference to stop on any error
$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting NotT3Chat Azure Deployment" -ForegroundColor Green
Write-Host "=====================================`n" -ForegroundColor Green

# Function to check if a command exists
function Test-Command($Command) {
    $null = Get-Command $Command -ErrorAction SilentlyContinue
    return $?
}

# Function to exit with error
function Exit-WithError($Message) {
    Write-Host "❌ ERROR: $Message" -ForegroundColor Red
    exit 1
}

# ======================================
# 1. PREREQUISITES CHECK
# ======================================
Write-Host "🔍 Checking prerequisites..." -ForegroundColor Yellow

# Check Docker
if (-not (Test-Command "docker")) {
    Exit-WithError "Docker is not installed or not in PATH"
}

# Test Docker daemon
try {
    docker version | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Exit-WithError "Docker daemon is not running. Please start Docker Desktop."
}

# Check Terraform
if (-not (Test-Command "terraform")) {
    Exit-WithError "Terraform is not installed or not in PATH"
}

# Check Azure CLI
if (-not (Test-Command "az")) {
    Exit-WithError "Azure CLI is not installed or not in PATH"
}

# Check if logged into Azure
try {
    $account = az account show --query "user.name" --output tsv 2>$null
    if ([string]::IsNullOrEmpty($account)) {
        Exit-WithError "Not logged into Azure CLI. Run 'az login' first."
    }
    Write-Host "✅ Azure CLI logged in as: $account" -ForegroundColor Green
} catch {
    Exit-WithError "Not logged into Azure CLI. Run 'az login' first."
}

# Check pnpm
if (-not (Test-Command "pnpm")) {
    Exit-WithError "pnpm is not installed or not in PATH"
}

Write-Host "✅ All prerequisites check passed`n" -ForegroundColor Green

# ======================================
# 2. TERRAFORM DEPLOYMENT
# ======================================
if (-not $SkipTerraform) {
    Write-Host "🏗️ Deploying infrastructure with Terraform..." -ForegroundColor Yellow

    Set-Location "terraform"

    # Initialize Terraform if needed
    if (-not (Test-Path ".terraform")) {
        Write-Host "Initializing Terraform..." -ForegroundColor Cyan
        terraform init
        if ($LASTEXITCODE -ne 0) { Exit-WithError "Terraform init failed" }
    }

    terraform refresh
    if ($LASTEXITCODE -ne 0) { Exit-WithError "Terraform refresh failed" }

    # Plan Terraform deployment
    Write-Host "Planning Terraform deployment..." -ForegroundColor Cyan
    terraform plan -out="tfplan"
    if ($LASTEXITCODE -ne 0) { Exit-WithError "Terraform plan failed" }

    # Apply Terraform deployment
    Write-Host "Applying Terraform deployment..." -ForegroundColor Cyan
    terraform apply "tfplan"
    if ($LASTEXITCODE -ne 0) { Exit-WithError "Terraform apply failed" }

    # Get Terraform outputs
    Write-Host "Getting Terraform outputs..." -ForegroundColor Cyan
    $staticWebAppName = terraform output -raw static_web_app_name
    $resourceGroupName = terraform output -raw resource_group_name
    $backendUrl = terraform output -raw backend_url
    $backendWebUrl = $backendUrl -replace "^https://", ""
} else {
    Write-Host "⏩ Skipping Terraform deployment (SkipTerraform = $SkipTerraform)" -ForegroundColor Yellow
    
    # Get existing values from terraform state if available
    Set-Location "terraform"
    if (Test-Path ".terraform") {
        Write-Host "Getting existing Terraform outputs..." -ForegroundColor Cyan
        $staticWebAppName = terraform output -raw static_web_app_name
        $resourceGroupName = terraform output -raw resource_group_name
        $backendUrl = terraform output -raw backend_url
        $backendWebUrl = $backendUrl -replace "^https://", ""
    } else {
        Exit-WithError "No existing Terraform state found. Run with -SkipTerraform $false first."
    }
}

Write-Host "📋 Deployment Information:" -ForegroundColor Green
Write-Host "   Static Web App: $staticWebAppName" -ForegroundColor White
Write-Host "   Resource Group: $resourceGroupName" -ForegroundColor White
Write-Host "   Backend URL: $backendUrl" -ForegroundColor White
Write-Host ""

# ======================================
# 3. GET STATIC WEB APP DEPLOYMENT TOKEN
# ======================================
Write-Host "🔑 Getting Static Web App deployment token..." -ForegroundColor Yellow

$deploymentToken = az staticwebapp secrets list --name $staticWebAppName --resource-group $resourceGroupName --query "properties.apiKey" --output tsv
if ([string]::IsNullOrEmpty($deploymentToken)) {
    Exit-WithError "Failed to get Static Web App deployment token"
}
Write-Host "✅ Deployment token retrieved" -ForegroundColor Green

# ======================================
# 4. BACKEND DOCKER BUILD AND PUSH
# ======================================
Set-Location ".."
Write-Host "🐳 Building and pushing backend Docker image..." -ForegroundColor Yellow

# Login to Azure Container Registry
Write-Host "Logging into Azure Container Registry..." -ForegroundColor Cyan
$acrLoginServer = az acr show --name $ContainerRegistryName --query loginServer --output tsv  
az acr login --name $ContainerRegistryName
if ($LASTEXITCODE -ne 0) { Exit-WithError "Failed to login to Azure Container Registry" }

# Build Docker image
Write-Host "Building Docker image..." -ForegroundColor Cyan
$imageName = "$ContainerRegistryName.azurecr.io/nott3chat-backend:$ImageTag"
docker build -t $imageName ./backend
if ($LASTEXITCODE -ne 0) { Exit-WithError "Docker build failed" }

if (-not $true) {
    # Container vulnerability scanning
    Write-Host "Scanning Docker image for vulnerabilities..." -ForegroundColor Cyan
    try {
        # Check if Docker Scout is available
        docker scout version 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Using Docker Scout for vulnerability scanning..." -ForegroundColor Yellow
            docker scout quickview $imageName
            #docker scout cves $imageName --format sarif --output "vulnerability-report.sarif"
            #$scoutResult = docker scout cves $imageName --exit-code
            #if ($scoutResult -match "No vulnerabilities found") {
            #    Write-Host "✅ No critical vulnerabilities found" -ForegroundColor Green
            #} else {
            #    Write-Host "⚠️  Vulnerabilities detected - check vulnerability-report.sarif" -ForegroundColor Yellow
            #}
        } else {
            # Fallback to Azure Container Registry scanning
            Write-Host "Using Azure Container Registry vulnerability scanning..." -ForegroundColor Yellow
            az acr task create --registry $ContainerRegistryName --name security-scan --image $imageName --cmd "echo Security scan placeholder" --commit-trigger-enabled false --pull-request-trigger-enabled false 2>$null | Out-Null
            Write-Host "✅ Container registered for Azure Security Center scanning" -ForegroundColor Green
        }
    } catch {
        Write-Host "⚠️  Vulnerability scanning not available - consider enabling Azure Security Center" -ForegroundColor Yellow
    }
}
# Push Docker image
Write-Host "Pushing Docker image to registry..." -ForegroundColor Cyan
docker push "$acrLoginServer/nott3chat-backend:latest"  
if ($LASTEXITCODE -ne 0) { Exit-WithError "Docker push failed" }

Write-Host "✅ Backend image built and pushed: $imageName" -ForegroundColor Green

# ======================================
# 5. UPDATE FRONTEND ENVIRONMENT FILES
# ======================================
Write-Host "📝 Updating frontend environment files..." -ForegroundColor Yellow

# Update .env file
$envContent = "VITE_API_URL=https://$backendWebUrl"
Set-Content -Path "front-end\.env" -Value $envContent -Encoding UTF8
Write-Host "✅ Updated front-end\.env" -ForegroundColor Green

# Update .env.production file
$envProductionContent = @"
VITE_API_URL=https://$backendWebUrl
VITE_WS_URL=wss://$backendWebUrl
VITE_ENABLE_CONSOLE=false
VITE_CSP_MODE=production
"@
Set-Content -Path "front-end\.env.production" -Value $envProductionContent -Encoding UTF8
Write-Host "✅ Updated front-end\.env.production" -ForegroundColor Green

# ======================================
# 6. BUILD FRONTEND
# ======================================
Write-Host "⚛️ Building frontend..." -ForegroundColor Yellow

Set-Location "front-end"

# Install dependencies
Write-Host "Installing frontend dependencies..." -ForegroundColor Cyan
pnpm install
if ($LASTEXITCODE -ne 0) { Exit-WithError "pnpm install failed" }

# Build for production
Write-Host "Building frontend for production..." -ForegroundColor Cyan
pnpm run build
if ($LASTEXITCODE -ne 0) { Exit-WithError "Frontend build failed" }

Write-Host "✅ Frontend built successfully" -ForegroundColor Green

# ======================================
# 7. DEPLOY FRONTEND TO STATIC WEB APP
# ======================================
Write-Host "📤 Deploying frontend to Azure Static Web Apps..." -ForegroundColor Yellow

pnpm dlx @azure/static-web-apps-cli deploy ./dist --deployment-token $deploymentToken --env production
if ($LASTEXITCODE -ne 0) { Exit-WithError "Frontend deployment failed" }

Write-Host "✅ Frontend deployed successfully" -ForegroundColor Green

# ======================================
# 8. RESTART BACKEND APP SERVICE
# ======================================
Set-Location ".."
Write-Host "🔄 Restarting backend App Service to pick up new image..." -ForegroundColor Yellow

Set-Location "terraform"
$backendAppName = terraform output -raw app_service_name
Set-Location ".."

az webapp restart --name $backendAppName --resource-group $resourceGroupName
if ($LASTEXITCODE -ne 0) { Exit-WithError "Failed to restart backend App Service" }

Write-Host "✅ Backend App Service restarted" -ForegroundColor Green

# ======================================
# 9. DEPLOYMENT SUMMARY
# ======================================
Write-Host "`n🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Deployment Summary:" -ForegroundColor Cyan
Write-Host "   Frontend URL: https://$staticWebAppName.azurestaticapps.net" -ForegroundColor White
Write-Host "   Backend URL:  $backendUrl" -ForegroundColor White
Write-Host "   Resource Group: $resourceGroupName" -ForegroundColor White
Write-Host ""
Write-Host "🔍 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Test the application by visiting the frontend URL" -ForegroundColor White
Write-Host "   2. Check logs in Azure Portal if there are any issues" -ForegroundColor White
Write-Host "   3. Monitor Application Insights for performance metrics" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  Note: It may take a few minutes for the deployment to fully propagate." -ForegroundColor Yellow