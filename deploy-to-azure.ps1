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
Set-Location backend
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

Set-Location ..