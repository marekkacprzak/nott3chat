param(
    [Parameter(Mandatory=$false)]
    [string]$ImageTag = "latest",
    
    [Parameter(Mandatory=$false)]
    [string]$ImageName = "nott3chat-backend",

    
    [Parameter(Mandatory=$false)]
    [string]$AzureRegistry = "hubchat.azurecr.io"
)

Write-Host "🐳 Building Docker image locally..." -ForegroundColor Green

# Build the Docker image
$imageFullName = $ImageName + ":" + $ImageTag
$imageFullName = $AzureRegistry + "/" + $imageFullName
Write-Host "📦 Building image: $imageFullName" -ForegroundColor Yellow
docker build -t $imageFullName ./backend

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Docker image built successfully!" -ForegroundColor Green
    Write-Host "🚀 To run locally:" -ForegroundColor Cyan
    Write-Host "   docker run -p 5128:8080 -e AzureOpenAI__Endpoint=YOUR_ENDPOINT $imageFullName" -ForegroundColor White
    Write-Host ""
    Write-Host "🐳 To run with docker-compose:" -ForegroundColor Cyan
    Write-Host "   docker-compose up" -ForegroundColor White
    Write-Host ""
    Write-Host "📋 Available images:" -ForegroundColor Cyan
    docker images $ImageName
} else {
    Write-Host "❌ Docker build failed!" -ForegroundColor Red
    exit 1
}