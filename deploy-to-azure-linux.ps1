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