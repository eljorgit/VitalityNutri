# VitalityNutri .NET Backend

Primary backend built on .NET 10 using Clean Architecture.

## Projects

- `VitalityNutri.Api`: HTTP endpoints, middleware, Scalar, and composition root.
- `VitalityNutri.Application`: MediatR use cases, FluentValidation pipeline, AutoMapper profiles, and ports.
- `VitalityNutri.Domain`: entities and domain behavior with no infrastructure dependencies.
- `VitalityNutri.Infrastructure`: EF Core DbContext, repository implementations, and external service adapters.
- `VitalityNutri.Migrations.MySql`: EF Core migrations for MySQL (SaaS & OSS).
- `VitalityNutri.Migrations.Sqlite`: EF Core migrations for SQLite (OSS).
- `VitalityNutri.Tests`: unit and architecture-facing tests.

## API Controllers

Endpoints are grouped by feature category under `VitalityNutri.Api/Controllers`:

```text
Controllers/
├── Health/
│   └── HealthController.cs
└── Plans/
	└── PlansController.cs
```

Add new endpoint categories as sibling folders. Controllers delegate application work through MediatR and do not access EF Core directly.

Dependencies point inward:

```text
Api -> Application + Infrastructure
Infrastructure -> Application + Domain
Application -> Domain
Domain -> none
Tests -> Application + Domain + Infrastructure
```

## Configuration

Set the MySQL connection string outside source control:

```powershell
$env:ApiConfiguration__ConnectionStrings__Default = "Server=localhost;Port=3306;Database=vitalitynutri;User ID=YOUR_USER;Password=YOUR_PASSWORD;"
```

## Run

```powershell
dotnet build backend/VitalityNutri.slnx
dotnet test backend/VitalityNutri.slnx
dotnet run --project backend/VitalityNutri.Api/VitalityNutri.Api.csproj
```

Development endpoints:

- Scalar API reference: `/scalar/v1`
- OpenAPI 3.1 document: `/openapi/v1.json`
- Health: `/health`

## Database providers

- `ApiConfiguration__App__Mode=SaaS` requires `ApiConfiguration__Database__Provider=MySql`.
- `ApiConfiguration__App__Mode=Oss` supports `ApiConfiguration__Database__Provider=MySql` or `ApiConfiguration__Database__Provider=Sqlite`.

MySQL migrations live in `VitalityNutri.Migrations.MySql/Migrations`. SQLite migrations live in `VitalityNutri.Migrations.Sqlite/Migrations`. Both providers read the active value from `ApiConfiguration__ConnectionStrings__Default`. For OSS SQLite, set `ApiConfiguration__Database__ApplyMigrations=true` and use `ApiConfiguration__ConnectionStrings__Default=Data Source=/app/data/vitalitynutri.db`; Docker persists `/app/data` in `backend-data`.

## Adding Migrations

When modifying entities in `VitalityNutri.Domain` or updating `OnModelCreating`, always generate migrations for **both** providers:

```powershell
# 1. MySQL Migration
dotnet ef migrations add <MigrationName> --project backend/VitalityNutri.Migrations.MySql --startup-project backend/VitalityNutri.Api

# 2. SQLite Migration
dotnet ef migrations add <MigrationName> --project backend/VitalityNutri.Migrations.Sqlite --startup-project backend/VitalityNutri.Api
```
