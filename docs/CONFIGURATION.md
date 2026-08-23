# Configuration and Docker Deployment

VitalityNutri uses separate configuration contracts and containers for the frontend and backend.

## Windows debugging

Visual Studio and `dotnet run` use the private launch profile for local debugging:

```powershell
Copy-Item backend/VitalityNutri.Api/Properties/launchSettings.example.json backend/VitalityNutri.Api/Properties/launchSettings.json
```

Replace the `CHANGE_ME` values in `launchSettings.json`. The real file is ignored by Git; only `launchSettings.example.json` is tracked. Specific local profiles are split between `appsettings.Development-oss.json` (local SQLite), `appsettings.Development-saas.json` (MySQL SaaS dev), and `appsettings.Release.json` (release defaults).

Do not use `.env.backend` for direct Windows debugging. It is consumed by Docker Compose on the VPS.

## Why two containers

- The React frontend is a static artifact served efficiently by Nginx.
- The .NET API owns database access, AI keys, and server-side logic.
- The browser calls relative `/api/*` URLs. Nginx proxies them to the private backend service.
- The frontend publishes port `5027`; the backend publishes port `5026` for direct API clients and diagnostics.
- MySQL and backend credentials never reach the browser.
- Frontend and backend can be built, deployed, health-checked, and rolled back independently.

## Environment files

Create local files from the tracked templates:

```powershell
Copy-Item .env.backend.example .env.backend
Copy-Item .env.frontend.example .env.frontend
```

Both local files are ignored by Git and Docker build contexts.

### Backend: `.env.backend`

Loaded only by the `backend` container through Docker Compose. Set `ASPNETCORE_ENVIRONMENT=Development` on a development VPS or `Release` on a production VPS.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `ASPNETCORE_ENVIRONMENT` | No | `Release` | ASP.NET Core environment. Scalar/OpenAPI endpoints are exposed only in Development. |
| `ASPNETCORE_HTTP_PORTS` | No | `80` | HTTP port inside the ASP.NET container. |
| `ApiConfiguration__App__Mode` | No | `Oss` | `SaaS` requires MySQL; `Oss` supports MySQL or SQLite. |
| `ApiConfiguration__Security__UseHttpsRedirection` | No | `false` | Enable only when ASP.NET terminates TLS itself. |
| `ApiConfiguration__Database__Provider` | No | `MySql` | `MySql` or `Sqlite`, constrained by `ApiConfiguration__App__Mode`. |
| `ApiConfiguration__Database__ApplyMigrations` | No | `false` | Apply provider-specific migrations on startup; recommended for OSS SQLite. |
| `ApiConfiguration__ConnectionStrings__Default` | Yes | None | Connection string for the selected provider. MySQL URL for MySQL; file path for SQLite. |
| `ApiConfiguration__Ai__UseOmniRoute` | No | `false` | Selects gateway routing once AI migration reaches .NET. |
| `ApiConfiguration__Ai__OmniRoute__Url` | Conditional | `http://omniroute:20128/v1` | Internal OmniRoute endpoint. |
| `ApiConfiguration__Ai__OmniRoute__ApiKey` | Conditional | Empty | OmniRoute credential. |
| `ApiConfiguration__Ai__Providers__Gemini__ApiKey` | Conditional | Empty | Gemini credential. |
| `ApiConfiguration__Ai__Providers__Gemini__TimeoutSeconds` | No | `300` | Gemini request timeout. Increase for large PDF extraction requests. |
| `ApiConfiguration__Ai__Providers__Groq__ApiKey` | Conditional | Empty | Groq credential. |
| `ApiConfiguration__ExternalServices__Unsplash__AccessKey` | No | Empty | Unsplash credential. |
| `ApiConfiguration__Upload__MaxFileSizeMb` | No | `15` | Maximum PDF file size in MB accepted by the backend validator. |

Double underscores map environment variables to nested .NET configuration sections.

If MySQL runs on the Docker host, use `host.docker.internal`:

```env
ApiConfiguration__ConnectionStrings__Default=Server=host.docker.internal;Port=3306;Database=vitalitynutri;User ID=app_user;Password=CHANGE_ME;SslMode=Preferred;
```

If MySQL later becomes a Compose service, replace the host with its service name, such as `mysql`.

OSS SQLite configuration:

```env
ApiConfiguration__App__Mode=Oss
ApiConfiguration__Database__Provider=Sqlite
ApiConfiguration__Database__ApplyMigrations=true
ApiConfiguration__ConnectionStrings__Default=Data Source=/app/data/vitalitynutri.db
```

SaaS must use `ApiConfiguration__App__Mode=SaaS` with `ApiConfiguration__Database__Provider=MySql`; SaaS + SQLite is rejected during startup.

### Frontend: `.env.frontend`

Loaded only by the `frontend` container. Every value is public because it is rendered into browser JavaScript.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `FRONTEND_LANGUAGE` | No | `en` | Initial interface language (`en` or `es`). |
| `FRONTEND_SITE_VISIBILITY` | No | `local` | `public` enables share links without the local-access warning; `local` keeps the warning. |
| `FRONTEND_MAX_UPLOAD_SIZE_MB` | No | `15` | Max PDF upload size displayed in the UI and checked on file selection. |
| `NGINX_CLIENT_MAX_BODY_SIZE` | No | `25M` | Nginx reverse proxy payload size limit (accommodates base64 overhead). |

Never put API keys, passwords, tokens, or database URLs in this file.

### 📦 Customizing Maximum PDF Upload Size

To change the maximum allowed file size (for example, to 30 MB):
1. In `.env.backend`: set `ApiConfiguration__Upload__MaxFileSizeMb=30`.
2. In `.env.frontend`: set `FRONTEND_MAX_UPLOAD_SIZE_MB=30` and `NGINX_CLIENT_MAX_BODY_SIZE=50M` (allowing for base64 JSON payload overhead).
3. Restart containers: `docker compose up -d` or `npm run docker:restart`.

## Docker Compose

The Compose file uses the images published by this repository:

- `ghcr.io/eljorgit/vitalitynutri-backend:latest`
- `ghcr.io/eljorgit/vitalitynutri-frontend:latest`

A push to `main` runs validation only. Pushing a tag matching `v*` builds and publishes both images, then deploys them when the SSH deployment secrets are configured.

Before the first tagged deployment, create the deployment directory on the VPS and place `.env.backend` there. Add `.env.frontend` only when its defaults (`en` and `local`) are not appropriate. The workflow copies `docker-compose.yml`, authenticates to GHCR, pulls the images, and restarts the services; environment files remain only on the VPS.

The deployment job requires these GitHub secrets:

- `SSH_HOST`
- `SSH_USER`
- `SSH_KEY`
- `DEPLOY_PATH`
- `SSH_PORT` when the server does not use port 22
- `TAILSCALE_AUTHKEY` when SSH is reachable only through Tailscale

For MySQL, the configured database must be reachable from the container. If `ApplyMigrations` is false, its schema must already exist. For a new OSS SQLite deployment, set the SQLite values shown above and keep the `backend-data` volume.

Validate configuration without printing resolved secrets:

```powershell
docker compose config --quiet
```

Build and start:

```powershell
docker compose up --build -d
```

Inspect status and logs:

```powershell
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
```

Stop the stack:

```powershell
docker compose down
```

## Network flow

```text
Browser -> localhost:5027 -> frontend (Nginx:80)
                              |-- static React files
                              `-- /api/* -> backend:80
                                             `-- MySQL on host.docker.internal:3306

Direct API client -> localhost:5026 -> backend:80
```

- Public app: `http://localhost:5027`
- Public API: `http://localhost:5026`
- Frontend health: `http://localhost:5027/frontend-health`
- Backend health through proxy: `http://localhost:5027/health`
- Backend health directly: `http://localhost:5026/health`
- Scalar in Development only: `http://localhost:5027/scalar/v1`
- OpenAPI in Development only: `http://localhost:5027/openapi/v1.json`

The React app still uses relative `/api/*` URLs through Nginx, avoiding CORS and keeping one browser origin. Port `5026` exists for direct API consumers; restrict it with your host firewall or reverse proxy if it should not be internet-accessible.

## Development and release on the same host

This repository now ships two Compose files so both environments can coexist on one machine without port conflicts:

- `docker-compose.yml` (development stack): web `5027`, api `5026`
- `docker-compose.release.yml` (release stack): web `5227`, api `5226`

Use separate environment files for release:

```powershell
Copy-Item .env.backend.release.example .env.backend.release
Copy-Item .env.frontend.release.example .env.frontend.release
```

Start development stack:

```powershell
docker compose -f docker-compose.yml up -d
```

Start release stack:

```powershell
docker compose -f docker-compose.release.yml up -d
```
