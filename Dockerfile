# Stage 1: Build Frontend (React + Vite)
FROM node:22-alpine AS frontend-build
WORKDIR /frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/index.html frontend/tsconfig.json frontend/vite.config.ts ./
COPY frontend/public/ public/
COPY frontend/src/ src/
RUN npm run build

# Stage 2: Build Backend (.NET 10)
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend-build
WORKDIR /source

COPY backend/VitalityNutri.slnx backend/
COPY backend/VitalityNutri.Api/*.csproj backend/VitalityNutri.Api/
COPY backend/VitalityNutri.Application/*.csproj backend/VitalityNutri.Application/
COPY backend/VitalityNutri.Domain/*.csproj backend/VitalityNutri.Domain/
COPY backend/VitalityNutri.Infrastructure/*.csproj backend/VitalityNutri.Infrastructure/
COPY backend/VitalityNutri.Migrations.MySql/*.csproj backend/VitalityNutri.Migrations.MySql/
COPY backend/VitalityNutri.Migrations.Sqlite/*.csproj backend/VitalityNutri.Migrations.Sqlite/
COPY backend/VitalityNutri.Tests/*.csproj backend/VitalityNutri.Tests/
RUN dotnet restore backend/VitalityNutri.Api/VitalityNutri.Api.csproj

COPY backend/ backend/
RUN dotnet publish backend/VitalityNutri.Api/VitalityNutri.Api.csproj \
    --configuration Release \
    --no-restore \
    --output /app/publish \
    /p:UseAppHost=false

# Embed React dist into ASP.NET Core wwwroot
COPY --from=frontend-build /frontend/dist /app/publish/wwwroot

# Stage 3: Consolidated Runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime

RUN apt-get update \
    && apt-get install --yes --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=backend-build /app/publish .
RUN mkdir -p /app/data /var/logs/vitalitynutriapi && chown -R $APP_UID:$APP_UID /app/data /var/logs/vitalitynutriapi

ENV ASPNETCORE_HTTP_PORTS=80
EXPOSE 80

USER $APP_UID
ENTRYPOINT ["dotnet", "VitalityNutri.Api.dll"]
