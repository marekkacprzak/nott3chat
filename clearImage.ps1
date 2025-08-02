param(
    [Parameter(Mandatory=$false)]
    [string]$ImageTag = "latest",
    
    [Parameter(Mandatory=$false)]
    [string]$ImageName = "nott3chat-backend",

    
    [Parameter(Mandatory=$false)]
    [string]$AzureRegistry = "hubchat.azurecr.io"
)
# Remove images with <none> tags for your specific repository
$imageFullName = $AzureRegistry + "/" + $ImageName + ":" + $ImageTag
docker images $imageFullName --filter "dangling=true" -q | ForEach-Object { docker rmi $_ }
docker image prune -f