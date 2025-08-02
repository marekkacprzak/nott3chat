# Use the official .NET 9 runtime as base image with updated OS
FROM mcr.microsoft.com/dotnet/aspnet:9.0-noble AS base
WORKDIR /app
EXPOSE 8080

# Use the SDK image to build the application
FROM mcr.microsoft.com/dotnet/sdk:9.0-noble AS build
WORKDIR /src

# Copy the project file and restore dependencies
COPY ["NotT3ChatBackend.csproj", "./"]
RUN dotnet restore "NotT3ChatBackend.csproj"

# Copy the rest of the source code
COPY . .

# Build the application
RUN dotnet build "NotT3ChatBackend.csproj" -c Release -o /app/build

# Publish the application
FROM build AS publish
RUN dotnet publish "NotT3ChatBackend.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Final stage/image
FROM base AS final
WORKDIR /app

# Install security updates and minimal required packages
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y --no-install-recommends \
    ca-certificates wget && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy the published application
COPY --from=publish /app/publish .

# Create directories for Azure File Storage mount points
RUN mkdir -p /mnt/azurefileshare

# Create a non-root user for security (Ubuntu syntax)
RUN useradd --system --create-home --home-dir /app --shell /bin/bash --no-log-init appuser && \
    chown -R appuser:appuser /app && \
    chown -R appuser:appuser /mnt/azurefileshare
USER appuser

# Set environment variables
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

# Health check using wget (smaller footprint than curl) or dotnet diagnostic tools
HEALTHCHECK --interval=600s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Entry point
ENTRYPOINT ["dotnet", "NotT3ChatBackend.dll"]
