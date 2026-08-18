# 📋 Implementation Plan: Diet Extractor & Assistant AI

Technical specification document and roadmap for developing the AI-powered diet extraction application and conversational assistant.

---

## 📊 Project Progress Table

> **Legend:** ⬜ Pending | 🟡 In Progress | ✅ Completed

| Phase | Task | Status | Priority |
| :--- | :--- | :---: | :---: |
| **0. Config & Infra** | .NET 10 Clean Architecture solution (`Api`, `Application`, `Domain`, `Infrastructure`, `Migrations.MySql`, `Migrations.Sqlite`, `Tests`) | ✅ Completed | High |
| **0. Config & Infra** | Monorepo boundaries (`backend/` + `frontend/`, root docker compose, docs) | ✅ Completed | High |
| **0. Config & Infra** | Split backend/frontend env contracts (`.env.backend`, `.env.frontend`, `launchSettings.json`) | ✅ Completed | High |
| **0. Config & Infra** | Strongly-typed .NET configuration & startup validation (`ApiConfiguration.cs`, `ServiceCollectionExtensions.cs`) | ✅ Completed | High |
| **0. Config & Infra** | SaaS vs OSS mode separation in C# runtime (`ApiConfiguration:App:Mode`, `DatabaseProviderPolicy`) | ✅ Completed | High |
| **1. Setup & DB** | EF Core 10 dual-provider setup: MySQL & SQLite with separate migration projects | ✅ Completed | High |
| **1. Setup & DB** | Policy: SaaS $\to$ MySQL; OSS $\to$ SQLite (default) or MySQL (custom/container) | ✅ Completed | High |
| **1. Setup & DB** | Non-AI state writes: plan reset/update, history restore/delete, grocery/completion state, ingredient upsert | ✅ Completed | High |
| **1. Setup & DB** | Recipe book CRUD, tags, favorite status, ingredient catalog sync, and dual migrations | ✅ Completed | High |
| **1. Setup & DB** | Search pool and click history (`/api/all-recipes`, `/api/search-history`) | ✅ Completed | High |
| **1. Setup & DB** | Backup export/import (`/api/backup/export`, `/api/backup/import`) | ✅ Completed | High |
| **1. Setup & DB** | Batch cooking state + endpoints (`GET/POST/reset`) | ✅ Completed | High |
| **1. Setup & DB** | Upload/reprocess endpoints (`/api/upload`, `/api/reprocess`) with duplicate-hash parity and source file storage | ✅ Completed | High |
| **1. Setup & DB** | Provision operational credentials for AI smoke tests (SaaS: OmniRoute tenant/key; OSS: Groq/Gemini BYOK) | ⬜ Pending | High |
| **2. PDF Extraction** | Local plain text extraction via UglyToad.PdfPig | ✅ Completed | High |
| **2. PDF Extraction** | Auto-detect selectable vs non-selectable PDF (text threshold $\ge 100$ chars) | ✅ Completed | High |
| **2. PDF Extraction** | SHA-256 hash generator for document caching & duplicate prevention | ✅ Completed | High |
| **3. AI Engine** | Groq integration (OpenAI-compatible direct OSS BYOK path) | ✅ Completed | High |
| **3. AI Engine** | Gemini provider implementation (Google.GenAI C# SDK with multimodal vision) | ✅ Completed | High |
| **3. AI Engine** | **Text Fallback Chain:** Groq Llama 3.3 $\to$ Groq Qwen 3.6 $\to$ Groq Llama 8B $\to$ Gemini 3.7/3.6/3.5 Flash | ✅ Completed | High |
| **3. AI Engine** | **Multimodal Fallback Chain:** Gemini 3.7 Flash $\to$ Gemini 3.6 Flash $\to$ Gemini 3.5 Flash Lite | ✅ Completed | High |
| **3. AI Engine** | **Dual-mode AI execution:** `UseOmniRoute` gateway vs Direct BYOK fallback | ✅ Completed | High |
| **3. AI Engine** | Consolidate prompts: 6 files $\to$ 3 (English base `prompt.md` + runtime language suffix) | ✅ Completed | Medium |
| **3. AI Engine** | Automated prompt tests: placeholder validation + non-empty checks | ✅ Completed | Medium |
| **3. AI Engine** | Recipe deduplication module prior to DB storage | ✅ Completed | Medium |
| **3. AI Engine** | Recipe AI processing (`POST /api/recipes/process-ai`) with deterministic fallback | ✅ Completed | High |
| **3. AI Engine** | Recipe image support (`GET /api/recipes/image-search`, `POST /api/recipes/report-broken-image`) + Unsplash/local lookup | ✅ Completed | High |
| **3. AI Engine** | Nutritional info in recipe JSON (calories, protein, carbs, fat per serving) + UI display | ⬜ Pending | Medium |
| **4. Chat (Optional)** | `/api/chat` endpoint with *In-Context Prompting* (diet summary in system prompt) | ⬜ Pending | Low |
| **4. Chat (Optional)** | Chat cost controls: message count cap, token limits, sliding window memory | ⬜ Pending | Low |
| **4. Chat (Optional)** | Feature flag to enable/disable chat in backend configuration | ⬜ Pending | Low |
| **5. SaaS v2.0 Auth** | SaaS User Authentication & JWT management (SaaS-only multi-tenant) | ⬜ Pending | Medium |
| **5. SaaS v2.0 Auth** | Per-user BYOK vault (AES-256-GCM encryption at rest in MySQL) | ⬜ Pending | Medium |
| **5. SaaS v2.0 Auth** | Multi-factor authentication (TOTP) & email verification (SMTP) | ⬜ Pending | Medium |
| **6. Frontend UI** | React 19 + Tailwind UI (Dashboard, Calendar, Grocery List, Recetario, Recipe Form, Batch Cooking) | ✅ Completed | High |
| **6. Frontend UI** | Runtime UI language selector (`i18next` with `en` / `es` support) | ✅ Completed | High |
| **6. Frontend UI** | Separate Nginx (`5027`) + ASP.NET API (`5026`) containers with reverse proxy | ✅ Completed | High |
| **6. Frontend UI** | Offline PWA mode (Service Worker caching for meal plan and recipes) | ⬜ Pending | Low |
| **7. Testing & QA** | .NET Unit and Integration Tests (63 passing tests in `VitalityNutri.Tests`) | ✅ Completed | High |
| **7. Testing & QA** | Frontend Vitest unit tests | 🟡 In Progress | High |
| **7. Testing & QA** | Playwright E2E full user flow tests | 🟡 In Progress | High |
| **7. Testing & QA** | CI/CD GitHub Actions workflow (test on PR + multi-container build on release tag) | 🟡 In Progress | High |
| **8. Security & Ops** | ASP.NET Core Rate Limiting (`upload`, `batch-cooking`, `general-write`) | ✅ Completed | High |
| **8. Security & Ops** | HTTP Security Headers (`nosniff`, `DENY`, `strict-origin-when-cross-origin`) | ✅ Completed | High |
| **8. Security & Ops** | Structured logging (NLog) + Sentry telemetry + App Insights | ✅ Completed | High |
| **8. Security & Ops** | Health check endpoints (`/health` with EF Core DB connectivity check) | ✅ Completed | High |
| **8. Security & Ops** | Startup database auto-migration & seed data runner | ✅ Completed | High |
| **9. API Docs** | ASP.NET Core OpenAPI 3.1 generation (`/openapi/v1.json`) | ✅ Completed | Medium |
| **9. API Docs** | Scalar API interactive reference UI (`/scalar/v1`, Development mode) | ✅ Completed | Medium |

---

## 🏗️ 1. System Architecture

### Directory Structure (.NET 10 Clean Architecture + React 19)

```text
VitalityNutri/
├── backend/
│   ├── VitalityNutri.slnx
│   ├── VitalityNutri.Api/                 # ASP.NET Core Web API + Scalar + Composition Root
│   │   ├── Controllers/                   # Thin controllers delegating to MediatR
│   │   ├── Configuration/                 # Strongly-typed ApiConfiguration & startup validation
│   │   ├── Infrastructure/                # Global exception handling & API middleware
│   │   ├── Program.cs                     # WebApplication builder, rate limiting, security headers
│   │   ├── nlog.config                    # NLog structured logging configuration
│   │   └── appsettings.json
│   ├── VitalityNutri.Application/         # CQRS Handlers, MediatR, FluentValidation, Ports
│   │   ├── Abstractions/                  # Interfaces (Persistence, Processing, Storage)
│   │   ├── Plans/                         # Plan queries and commands
│   │   ├── Recipes/                       # Recipe CRUD, AI processing, image lookup
│   │   ├── BatchCooking/                  # Batch cooking state & commands
│   │   ├── GroceryLists/                  # Grocery item status & aggregations
│   │   ├── Ingredients/                   # Ingredient catalog queries & sync
│   │   ├── Backups/                       # Backup export & import handlers
│   │   └── Uploads/                       # PDF upload, SHA-256 hash checking, AI extraction sync
│   ├── VitalityNutri.Domain/              # Pure POCO Entities & Business Models (zero external dependencies)
│   │   └── Entities/                      # WeekPlan, Recipe, BatchCooking, Ingredient, etc.
│   ├── VitalityNutri.Infrastructure/      # EF Core DbContext, Repositories, AI Processing Services
│   │   ├── Persistence/                   # VitalityNutriDbContext (Fluent API mapping), Repositories
│   │   ├── Processing/                    # DeterministicPlanExtraction, DeterministicRecipeAi, FileStorage
│   │   └── Configuration/                 # DatabaseProviderPolicy, DatabaseOptions
│   ├── VitalityNutri.Migrations.MySql/    # EF Core Migrations for MySQL
│   ├── VitalityNutri.Migrations.Sqlite/   # EF Core Migrations for SQLite
│   ├── VitalityNutri.Tests/               # xUnit/NUnit integration & unit test suite (63+ tests)
│   └── prompts/                           # Structured markdown AI prompt templates
│       ├── plan-analysis/
│       ├── recipe-ai/
│       └── batch-cooking/
├── frontend/                              # React 19 + TypeScript + Vite + Tailwind
│   ├── src/
│   │   ├── components/                    # CalendarGrid, Dashboard, GroceryList, Recetario, RecipeDetail, etc.
│   │   ├── i18n/                          # Internationalization dictionaries (English, Spanish)
│   │   ├── utils/                         # API client, date formatters, export utilities
│   │   └── App.tsx                        # Main stateful application shell
│   ├── e2e/                               # Playwright end-to-end tests
│   ├── vite.config.ts
│   └── package.json
├── docker/                                # Dockerfiles (backend .NET 10, frontend Nginx)
├── docs/                                  # CONFIGURATION.md, IMPLEMENTATION_PLAN.md, screenshots
├── docker-compose.yml                     # Multi-container orchestration
├── AGENTS.md                              # Mandatory engineering guidelines for AI agents
└── README.md
```

### Request Flow

```text
                     ┌──────────────────────────────────────────┐
                     │   Browser (SPA) on http://localhost:5027  │
                     └────────────────────┬─────────────────────┘
                                          │ (Relative /api/* requests)
                                          ▼
                     ┌──────────────────────────────────────────┐
                     │       Frontend Nginx Reverse Proxy       │
                     │  - Serves compiled React static assets   │
                     │  - Proxies /api/* to backend:80          │
                     └────────────────────┬─────────────────────┘
                                          │
                                          ▼
                     ┌──────────────────────────────────────────┐
                     │   Backend ASP.NET Core (.NET 10 Web API)  │
                     │   Rate Limiter -> Security Headers ->     │
                     │   Scalar API / OpenAPI -> Controllers    │
                     └────────────────────┬─────────────────────┘
                                          │
                     ┌────────────────────┴─────────────────────┐
                     ▼                                          ▼
           [ 1. Hash & DB Lookup ]                   [ 2. PDF Analysis ]
           Processed before?                                    │
           ├── YES: Return cached JSON              Detect selectable vs non-selectable PDF
           └── NO: Start AI processing              ├── Selectable (text >= 100 chars via PdfPig)
                                                    │   -> TEXT FALLBACK CHAIN:
                                                    │      Groq Llama 3.3 -> Groq Qwen 3.6 ->
                                                    │      Groq Llama 8B -> Gemini 3.7/3.6/3.5 Flash
                                                    │
                                                    └── Non-selectable (scanned image)
                                                        -> MULTIMODAL VISION CHAIN:
                                                           Gemini 3.7 Flash -> Gemini 3.6 Flash -> Gemini 3.5 Flash Lite
```

---

## 🧭 Architecture Principles & Standards

### 1. Clean Architecture & Layering Rules
As codified in [`AGENTS.md`](file:///c:/Users/jorge.ramirez/source/repos/ma/VitalityNutri/AGENTS.md):
- **Domain Layer (`VitalityNutri.Domain`)**: Pure C# POCOs. Never add database-specific attributes (`[Table]`, `[Column]`, `[Key]`). All mapping is configured in `VitalityNutriDbContext.OnModelCreating`.
- **Application Layer (`VitalityNutri.Application`)**: CQRS with MediatR queries/commands. Validation via `FluentValidation`. Never inject `DbContext` directly into handlers; use repository abstractions.
- **Infrastructure Layer (`VitalityNutri.Infrastructure`)**: EF Core implementation, database repositories, AI processing clients, PDF Pig text extraction, file storage.
- **API Layer (`VitalityNutri.Api`)**: Thin controllers delegating commands/queries to `ISender`.

### 2. Dual Database Provider Support
The application supports two relational database engines:
- **MySQL**: Default for SaaS & production OSS.
- **SQLite**: Supported for lightweight, zero-configuration local OSS deployments.

> [!IMPORTANT]
> **Dual Migration Rule:** Whenever a domain entity or EF Core mapping changes, migrations **MUST** be added to **BOTH** migration assemblies:
> ```bash
> dotnet ef migrations add <MigrationName> --project backend/VitalityNutri.Migrations.MySql --startup-project backend/VitalityNutri.Api
> dotnet ef migrations add <MigrationName> --project backend/VitalityNutri.Migrations.Sqlite --startup-project backend/VitalityNutri.Api
> ```

---

## 🔧 2. Configuration & Environment Contracts

Configuration is strongly typed via `ApiConfiguration.cs` and validated at application startup in `ServiceCollectionExtensions.cs`.

### Environment Files
- **Backend (`.env.backend`)**: Consumed by Docker Compose or launch profiles. Never exposed to the browser.
- **Frontend (`.env.frontend`)**: Consumed by Vite during build/run for browser UI settings.

### Configuration Schema Mapping (`ApiConfiguration.cs`)

| Configuration Key | Env Var Equivalent | Default | Description |
| :--- | :--- | :--- | :--- |
| `ApiConfiguration:App:Mode` | `ApiConfiguration__App__Mode` | `Oss` | Application mode: `Oss` or `SaaS`. |
| `ApiConfiguration:Database:Provider` | `ApiConfiguration__Database__Provider` | `MySql` | `MySql` or `Sqlite`. Validated against `App:Mode`. |
| `ApiConfiguration:Database:ApplyMigrations` | `ApiConfiguration__Database__ApplyMigrations` | `false` | When `true`, automatically applies pending EF Core migrations at startup. |
| `ApiConfiguration:ConnectionStrings:Default` | `ApiConfiguration__ConnectionStrings__Default` | Required | Connection string for MySQL or SQLite (`Data Source=/app/data/vitalitynutri.db`). |
| `ApiConfiguration:Ai:UseOmniRoute` | `ApiConfiguration__Ai__UseOmniRoute` | `false` | When `true`, routes AI requests through OmniRoute Gateway. Required if `App:Mode=SaaS`. |
| `ApiConfiguration:Ai:OmniRoute:Url` | `ApiConfiguration__Ai__OmniRoute__Url` | `http://omniroute:20128/v1` | Base URL for OmniRoute Gateway. |
| `ApiConfiguration:Ai:OmniRoute:ApiKey` | `ApiConfiguration__Ai__OmniRoute__ApiKey` | Empty | OmniRoute API key. |
| `ApiConfiguration:Ai:Providers:Groq:ApiKey` | `ApiConfiguration__Ai__Providers__Groq__ApiKey` | Empty | Groq API Key for direct OSS BYOK. |
| `ApiConfiguration:Ai:Providers:Gemini:ApiKey` | `ApiConfiguration__Ai__Providers__Gemini__ApiKey` | Empty | Google Gemini API Key. |
| `ApiConfiguration:ExternalServices:Unsplash:AccessKey` | `ApiConfiguration__ExternalServices__Unsplash__AccessKey` | Empty | Unsplash API key for recipe image search. |
| `ApiConfiguration:Telemetry:Sentry:Dsn` | `ApiConfiguration__Telemetry__Sentry__Dsn` | Empty | Sentry DSN for error tracking. |

### Startup Validation Policy (`DatabaseProviderPolicy.cs`)
```csharp
public static class DatabaseProviderPolicy
{
    public static bool IsAllowed(string mode, string provider) =>
        string.Equals(mode, "SaaS", StringComparison.OrdinalIgnoreCase)
            ? string.Equals(provider, DatabaseOptions.MySqlProvider, StringComparison.OrdinalIgnoreCase)
            : string.Equals(mode, "Oss", StringComparison.OrdinalIgnoreCase) &&
              (string.Equals(provider, DatabaseOptions.MySqlProvider, StringComparison.OrdinalIgnoreCase) ||
               string.Equals(provider, DatabaseOptions.SqliteProvider, StringComparison.OrdinalIgnoreCase));
}
```

---

## 🤖 3. AI Processing Pipeline & Fallback Chains

### 1. Plan Extraction Service (`DeterministicPlanExtractionService.cs`)
Handles PDF upload processing with automatic detection:
1. **Hash Verification**: Calculates SHA-256 of uploaded PDF. If already processed and `ForceReprocess=false`, returns cached plan.
2. **Text Extraction**: Uses `UglyToad.PdfPig` to extract text.
3. **Threshold Check**: If text length $\ge 100$ characters $\to$ Selectable PDF $\to$ Text Fallback Chain. If $< 100$ characters $\to$ Scanned PDF $\to$ Multimodal Vision Chain.
4. **Fallback Chains**:
   - **Text Chain**: Groq (`llama-3.3-70b-versatile`, `qwen/qwen3.6-27b`, `llama-3.1-8b-instant`) $\to$ Gemini (`gemini-3.7-flash`, `gemini-3.6-flash`, `gemini-3.5-flash-lite`).
   - **Vision Chain**: Gemini Multimodal (`gemini-3.7-flash`, `gemini-3.6-flash`, `gemini-3.5-flash-lite`).
5. **Deterministic Parser Fallback**: If all live AI calls fail or keys are absent, falls back to deterministic rule-based text parser to guarantee reliable local operation without crashes.

### 2. Recipe AI Service (`DeterministicRecipeAiProcessingService.cs`)
Handles single recipe improvements, conversions, and generation:
- Receives user prompts or existing recipe data.
- Calls OmniRoute or Groq/Gemini with structured JSON response formatting.
- Falls back to deterministic recipe generator on API exhaustion or network error.

### 3. Prompt Consolidation Strategy (Pending Roadmap Item)
- **Current State:** 2 prompt files per feature (`prompt-en.md` and `prompt-es.md`).
- **Target State:** 1 base English template (`prompt.md`) per feature. Language-specific instructions are appended at runtime via `{LANGUAGE}` interpolation in `Application/Abstractions/Processing`.

---

## 🗄️ 4. Database Design & State Management

All database tables and constraints are configured via EF Core Fluent API in `VitalityNutriDbContext.OnModelCreating`:

```text
Entities & Tables:
├── WeekPlans                (Id, FileName, FileHash, PlanJson, MetadataJson, IsActive, CreatedAt)
├── HistoryEntries           (Id, Action, Timestamp, DetailsJson, PlanSnapshotJson)
├── Recipes                  (Id, Name, PrepTime, CookTime, Servings, IngredientsJson, InstructionsJson, 
│                             Category, SourcePlanId, SourceDay, SourceMeal, ImageUrl, IsFavorite, TagsJson)
├── GroceryItems             (Id, Name, Category, Quantity, Unit, IsChecked, SourceWeekPlanId)
├── IngredientCatalog        (Id, NormalizedName, DisplayName, DefaultCategory, UsageCount)
├── SearchPoolRecipes        (Id, RecipeId, Name, TagsJson, IngredientsText, LastIndexedAt)
├── SearchPoolInteractions   (Id, RecipeId, Query, InteractionType, Timestamp)
└── BatchCookings            (Id, WeekPlanId, StrategyJson, SessionsJson, GeneratedAt)
```

### Database Deployment Strategy
- **SaaS Deployment**: Hosted MySQL instance. SQLite is strictly forbidden by policy guards.
- **OSS Deployment**:
  - **SQLite (Default)**: Zero configuration, writes to `/app/data/vitalitynutri.db` mount.
  - **MySQL (Optional)**: User can point connection string to their existing MySQL server, OR uncomment the `mysql` service definition in `docker-compose.yml`.

---

## 🔒 5. Open Source (OSS) vs SaaS Separation

### Scope Separation

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                             VITALITYNUTRI CORE                              │
│  - React 19 Frontend UI (Calendar, Grocery, Recipe Book, Batch Cooking)    │
│  - ASP.NET Core 10 Web API + MediatR CQRS + FluentValidation                │
│  - Dual Database Providers (EF Core 10: SQLite & MySQL)                     │
│  - Direct BYOK AI (Groq / Gemini) & Deterministic Fallbacks                 │
│  - Local PDF Pig text extraction & SHA-256 caching                          │
│  - Rate Limiting, Security Headers & Structured NLog Logging                │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            ▼                                                     ▼
┌───────────────────────────────┐             ┌───────────────────────────────┐
│        OSS MODE (v1.0)        │             │        SAAS MODE (v2.0)       │
│ - Single-user / self-hosted   │             │ - Multi-tenant cloud hosting  │
│ - Zero-auth local operation   │             │ - JWT authentication & users  │
│ - SQLite or external MySQL    │             │ - MySQL enforced              │
│ - Direct BYOK API keys        │             │ - OmniRoute Gateway enforced  │
│ - Full feature set unlocked   │             │ - AES-256 BYOK key vault      │
│                               │             │ - MFA (TOTP) & SMTP emails    │
│                               │             │ - Stripe billing (future)     │
└───────────────────────────────┘             └───────────────────────────────┘
```

#### Why separate OSS v1.0 and SaaS v2.0?
- **OSS v1.0** focuses on delivering an immediate, frictionless self-hosted product for individuals and families without the friction of account creation, email verification, or multi-tenant database partitioning.
- **SaaS v2.0** introduces multi-user security, tenant isolation, cloud billing, and user credential encryption as an additive layer when cloud hosting is launched.

---

## 💬 6. Optional Chat Module (`/api/chat`)

*Status: ⬜ Pending (Low Priority / Optional Feature)*

### Requirements
- Provide conversational dietary advice grounded strictly in the active week plan.
- **In-Context Prompting:** Inject a concise *summary* of the current week plan into the system prompt rather than raw megabyte JSON.
- **Cost Controls:**
  - Strict message count cap (e.g. 20 messages per session).
  - Sliding context window keeping only the last 4 exchanges.
  - Fast, economical model (`llama-3.1-8b-instant` or `gemini-3.5-flash-lite`).
  - Feature flag `ApiConfiguration:Ai:Chat:Enabled` to disable the feature entirely.

---

## 🐳 7. Docker Architecture & Deployment

The application runs as two separate containers connected via an internal bridge network:

```text
Host Port 5027 ──────> [ frontend (Nginx:80) ]
                            │
                            ├── Serves compiled React static SPA
                            └── Proxies /api/* ───> [ backend (ASP.NET Core:80) ] (Port 5026)
                                                         │
                                                         ├── MySQL on host / container
                                                         └── SQLite on volume /app/data
```

### Docker Compose Configuration (`docker-compose.yml`)
- `frontend`: Builds from `docker/Dockerfile.frontend`, exposes port `5027`.
- `backend`: Builds from `docker/Dockerfile.backend`, exposes port `5026` for direct API access and diagnostics.
- `backend-data` volume: Persists SQLite database files and uploaded PDFs in `/app/data`.

---

## 🏥 8. Operations, Observability & Security

### 1. Health Checks
- Active endpoint: `GET /health`
- Verifies ASP.NET Core runtime status and active EF Core database reachability.
- Frontend health: `GET /frontend-health` on port `5027`.

### 2. Structured Logging & Error Tracking
- NLog configured with structured targets writing to `/var/logs/vitalitynutriapi/` or console.
- Sentry integration automatically filters out expected client validation errors (`FluentValidation.ValidationException`) and disables itself in `Testing` environment.

### 3. Security & Rate Limiting
- Fixed-window rate limiting on sensitive mutation endpoints:
  - `upload`: 5 requests per 15 minutes.
  - `batch-cooking`: 10 requests per 5 minutes.
  - `general-write`: 30 requests per minute.
- Standard security headers added to all HTTP responses (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`).

---

## 🧪 9. Testing & Quality Verification

Before completing any implementation or PR, the full test suite must pass with **0 errors and 0 warnings**:

```bash
# Run full .NET test suite (Domain, Application, Infrastructure, Api)
dotnet test backend/VitalityNutri.slnx

# Run Frontend Vitest suite
npm --prefix frontend run test

# Run Frontend Playwright E2E suite
npm --prefix frontend run test:e2e
```

---

## 📋 10. Next Milestone Action Items

1. **Prompt Consolidation (Phase 3)**:
   - Refactor `backend/prompts/` from 6 localized files to 3 base English templates with runtime language injection.
   - Add unit tests in `VitalityNutri.Tests` to verify prompt placeholder parsing.
2. **Nutritional Information Support (Phase 3.5 & 4.5)**:
   - Add optional macros (`calories`, `protein`, `carbs`, `fat`) to `Recipe` domain entity and DTOs.
   - Add UI display in `RecipeDetail.tsx` with graceful placeholder when plan lacks macro data.
3. **CI/CD Pipeline Validation**:
   - Ensure GitHub Actions workflow runs `dotnet test` and frontend tests on all pull requests.
4. **Operational Credential Validation**:
   - Perform end-to-end smoke tests against real Groq and Gemini endpoints using BYOK keys.
