# Agent Guidelines & Engineering Standards

This document is the **single source of truth** for all AI coding agents (GitHub Copilot, Cursor, Claude, Antigravity, Windsurf, Devin, Codex, etc.) working on this repository.

---

## 1. Multi-Provider Database Migrations (CRITICAL RULE)

This codebase uses **Entity Framework Core 10** with dual database provider support:
- **MySQL** (Default for SaaS & OSS production) $\to$ `backend/VitalityNutri.Migrations.MySql`
- **SQLite** (Supported for OSS lightweight local deployments) $\to$ `backend/VitalityNutri.Migrations.Sqlite`

### Mandatory Dual-Migration Rule
> [!IMPORTANT]
> Whenever you modify an entity in `VitalityNutri.Domain` or adjust schema mapping in `VitalityNutriDbContext.OnModelCreating`, you **MUST** create a migration in **BOTH** migration assemblies. Never create a migration for only one provider.

### Exact Commands for New Migrations
When adding a migration named `<MigrationName>` (e.g. `AddUserProfiles`):

```bash
# 1. Generate MySQL Migration
dotnet ef migrations add <MigrationName> \
  --project backend/VitalityNutri.Migrations.MySql \
  --startup-project backend/VitalityNutri.Api

# 2. Generate SQLite Migration
dotnet ef migrations add <MigrationName> \
  --project backend/VitalityNutri.Migrations.Sqlite \
  --startup-project backend/VitalityNutri.Api
```

### Removing the Last Unapplied Migration
```bash
# Remove from MySQL
dotnet ef migrations remove \
  --project backend/VitalityNutri.Migrations.MySql \
  --startup-project backend/VitalityNutri.Api

# Remove from SQLite
dotnet ef migrations remove \
  --project backend/VitalityNutri.Migrations.Sqlite \
  --startup-project backend/VitalityNutri.Api
```

---

## 2. Clean Architecture & Layering Rules

```text
Api -> Application + Infrastructure
Infrastructure -> Application + Domain
Application -> Domain
Domain -> (Zero external dependencies)
```

1. **Domain Layer (`VitalityNutri.Domain`)**:
   - Entities must remain pure C# POCOs with business encapsulation.
   - **NEVER** add database-specific attributes (`[Table]`, `[Column]`, `[Key]`, etc.) to domain entities.
   - All table names, column types, lengths, and indexes **must** be configured via Fluent API in `VitalityNutriDbContext.OnModelCreating`.
2. **Application Layer (`VitalityNutri.Application`)**:
   - Follow CQRS with MediatR queries (`IRequest<TResponse>`) and commands.
   - Business validations must be implemented as `FluentValidation.AbstractValidator<T>` classes.
   - Never inject `DbContext` directly into application handlers; use repository abstractions (`IPlanRepository`, `IRecipeRepository`, etc.).
3. **API Layer (`VitalityNutri.Api`)**:
   - Controllers must be thin and delegate all work to `ISender` (MediatR).
   - Use RFC 7807 ProblemDetails for error responses.

---

## 3. Security, Rate Limiting & Networking

- **Rate Limiting**: Always apply rate limiting attributes to mutation/AI endpoints:
  - `[EnableRateLimiting("upload")]` on file upload and reprocessing endpoints.
  - `[EnableRateLimiting("batch-cooking")]` on batch cooking generation endpoints.
  - `[EnableRateLimiting("general-write")]` on recipe creation, AI processing, and editing endpoints.
- **CORS & Headers**: Keep security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) active in middleware.

---

## 4. Observability & Error Tracking

- **Logging**: Use structured logging via `ILogger<T>`. All logs route through NLog targets (`/var/logs/vitalitynutriapi/`).
- **Sentry & Telemetry**:
  - Telemetry is configured via `ApiConfiguration.Telemetry`.
  - **NEVER** report expected client validation errors (`FluentValidation.ValidationException`) or 4xx responses to Sentry as server errors.
  - **NEVER** enable Sentry during test runs (`builder.Environment.IsEnvironment("Testing")` must bypass Sentry).

---

## 5. Configuration & Secrets

- Never hardcode connection strings, API keys, or secrets in source code.
- Bind all settings through strongly-typed options in `ApiConfiguration.cs`.

---

## 6. Testing & Quality Verification

Before completing any task, always build and execute the full test suite:
```bash
dotnet test backend/VitalityNutri.slnx
```
Requirements:
- **0 build warnings**
- **0 build errors**
- **100% passing tests**
