# Azure OpenAI Setup Guide

This application has been refactored to use Azure OpenAI services with credential-based authentication (no API keys required).

## Prerequisites

1. **Azure Subscription**: You need an active Azure subscription
2. **Azure OpenAI Resource**: Create an Azure OpenAI resource in the Azure portal
3. **Model Deployments**: Deploy the models you want to use (e.g., gpt-4o-mini, gpt-4o)

## Authentication Setup

The application uses `DefaultAzureCredential` which supports multiple authentication methods in this order:

1. **Environment Variables** (recommended for development)
2. **Managed Identity** (recommended for production in Azure)
3. **Visual Studio/VS Code authentication**
4. **Azure CLI authentication**
5. **Azure PowerShell authentication**

### Development Setup

#### Option 1: Azure CLI (Recommended)
```bash
# Install Azure CLI if not already installed
# Then login
az login
```

#### Option 2: Environment Variables
Set these environment variables:
```bash
AZURE_CLIENT_ID=<your-service-principal-client-id>
AZURE_CLIENT_SECRET=<your-service-principal-client-secret>
AZURE_TENANT_ID=<your-azure-tenant-id>
```

### Production Setup

For production deployments in Azure, use **Managed Identity**:

1. Enable System-Assigned Managed Identity on your Azure resource (App Service, Container Instance, etc.)
2. Grant the Managed Identity access to your Azure OpenAI resource:
   - Role: `Cognitive Services OpenAI User` or `Cognitive Services OpenAI Contributor`

## Configuration

Update your `appsettings.json` and `appsettings.Development.json`:

```json
{
  "AzureOpenAI": {
    "Endpoint": "https://your-resource-name.openai.azure.com/",
    "Models": ["gpt-4o-mini", "gpt-4o", "gpt-35-turbo"],
    "TitleModel": "gpt-4o-mini"
  }
}
```

### Configuration Properties

- **Endpoint**: Your Azure OpenAI resource endpoint URL
- **Models**: Array of deployed model names available for chat
- **TitleModel**: Model to use for generating chat titles

## Model Deployment

In your Azure OpenAI resource, make sure to deploy the models with the exact names you specify in the configuration:

1. Go to Azure OpenAI Studio
2. Navigate to "Deployments"
3. Create deployments for each model you want to use
4. Use the deployment names in your configuration

## Testing the Setup

1. Make sure your authentication is configured correctly
2. Update the configuration files with your Azure OpenAI endpoint and model names
3. Run the application:
   ```bash
   dotnet run
   ```
4. Check the logs for successful authentication and model loading

## Troubleshooting

### Common Issues

1. **Authentication Errors**: 
   - Verify your Azure credentials are valid
   - Check that the identity has proper permissions to the Azure OpenAI resource

2. **Model Not Found**: 
   - Ensure the model is deployed in your Azure OpenAI resource
   - Verify the deployment name matches the configuration

3. **Permission Denied**: 
   - Grant the `Cognitive Services OpenAI User` role to your identity
   - For the Azure OpenAI resource scope

### Required Azure Permissions

The identity (service principal or managed identity) needs these permissions:
- `Cognitive Services OpenAI User` - for basic usage
- `Cognitive Services OpenAI Contributor` - if you need to manage deployments

## Security Best Practices

1. **Never commit credentials** to source control
2. **Use Managed Identity** in production environments
3. **Limit permissions** to only what's necessary
4. **Regularly rotate** service principal secrets if using them
5. **Monitor access** through Azure Activity Logs
