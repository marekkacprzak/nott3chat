param(
    [Parameter(Mandatory=$false)]
    [string]$ImageTag = "latest",
    
    [Parameter(Mandatory=$false)]
    [string]$ImageName = "nott3chat-backend"
)

Write-Host "🐳 Building Docker image locally..." -ForegroundColor Green

# Build the Docker image
Write-Host "📦 Building image: ${ImageName}:${ImageTag}" -ForegroundColor Yellow
docker build -t "${ImageName}:${ImageTag}" ./backend

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Docker image built successfully!" -ForegroundColor Green
    Write-Host "🚀 To run locally:" -ForegroundColor Cyan
    Write-Host "   docker run -p 5128:8080 -e AzureOpenAI__Endpoint=YOUR_ENDPOINT ${ImageName}:${ImageTag}" -ForegroundColor White
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
