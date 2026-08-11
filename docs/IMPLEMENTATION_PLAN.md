# 📋 Implementation Plan: Diet Extractor & Assistant AI

Technical specification document and roadmap for developing the AI-powered diet extraction application and conversational assistant.

---

## 📊 Project Progress Table

> **Legend:** ⬜ Pending | 🟡 In Progress | ✅ Completed

| Phase | Task | Status | Priority |
| :--- | :--- | :---: | :---: |
| **0. Config & Infra** | Zod env validation module (`server/config/env.ts`) | ⬜ Pending | High |
| **0. Config & Infra** | AI provider abstraction interface + factory (`server/ai/`) | ⬜ Pending | High |
| **0. Config & Infra** | SaaS vs OSS mode separation (`server/saas/`) | ⬜ Pending | High |
| **1. Setup & DB** | Initial Node.js server configuration (Express / Fastify) | ⬜ Pending | High |
| **1. Setup & DB** | Configure Database schema (SQLite for OSS, PostgreSQL for SaaS) | ⬜ Pending | High |
| **1. Setup & DB** | Create isolated accounts and obtain API Keys for Groq & Google AI Studio | ⬜ Pending | High |
| **2. PDF Extraction** | Implement local plain text extraction (`pdf-parse` / `pdfjs-dist`) | ⬜ Pending | High |
| **2. PDF Extraction** | Auto-detect selectable vs non-selectable PDF (text threshold >100 chars) | ⬜ Pending | High |
| **2. PDF Extraction** | Implement Hash generator (SHA-256) for document caching | ⬜ Pending | High |
| **3. AI Engine** | Groq provider implementation (OpenAI-compatible) | ⬜ Pending | High |
| **3. AI Engine** | Gemini provider implementation (multimodal) | ⬜ Pending | High |
| **3. AI Engine** | **Text Fallback Chain:** Groq Llama 3.3 → Groq Qwen 3.6 → Groq Llama 8B → Gemini Flash Lite → Gemini Flash Lite | ⬜ Pending | High |
| **3. AI Engine** | **Dual-mode AI execution:** `USE_OMNIROUTE` gateway (default) vs Direct BYOK fallback — `generateAIResponse(alias, req)` single entry | ⬜ Pending | High |
| **3. AI Engine** | **Multimodal Fallback Chain:** Gemini 3.5 Flash Lite → Gemini 3.1 Flash Lite | ⬜ Pending | High |
| **3. AI Engine** | Consolidate prompts: 6 files → 3 (English base + runtime lang suffix) | ⬜ Pending | Medium |
| **3. AI Engine** | Prompt tests: placeholder validation + non-empty checks | ⬜ Pending | Medium |
| **3. AI Engine** | Recipe deduplication module prior to DB storage | ⬜ Pending | Medium |
| **3. AI Engine** | Recipe processor: separate flows for image/text/mejora/PDF | ⬜ Pending | Medium |
| **4. Chat (Optional)** | `/api/chat` endpoint with *In-Context Prompting* (Diet **summary** in prompt, not full JSON) | ⬜ Pending | Medium |
| **4. Chat (Optional)** | Chat cost controls: message count cap, char length cap, dedicated cheap model | ⬜ Pending | High |
| **4. Chat (Optional)** | Message history management with sliding memory window | ⬜ Pending | Medium |
| **4. Chat (Optional)** | Feature Flag switch to enable/disable chat in `.env` | ⬜ Pending | Low |
| **3. AI Engine** | Nutritional info in recipe JSON (macros per serving) + placeholder if absent | ⬜ Pending | High |
| **6. Frontend & Deploy** | Recipe nutrition display in UI + placeholder ("plan does not include nutritional info") | ⬜ Pending | Medium |
| **5. Auth & Modes** | Implement **BYOK** (*Bring Your Own Key*) support for Open Source version | ⬜ Pending | Medium |
| **5. Auth & Modes** | JWT Authentication & Rate Limiting by IP/User (SaaS Mode) | ⬜ Pending | Medium |
| **5. Auth & Modes** | Runtime language selector: AppBar dropdown + `/api/config` + per-user `users.lang` | ⬜ Pending | High |
| **5. Auth & Modes** | SaaS landing page (`domain.com`) + app (`app.domain.com`) subdomain split | ⬜ Pending | Medium |
| **6. Frontend & Deploy** | React UI development (PDF upload, Diet viewer, Chat widget) | ⬜ Pending | High |
| **6. Frontend & Deploy** | Medical disclaimer on landing page + footer | ⬜ Pending | High |
| **6. Frontend & Deploy** | Create `docker-compose.yml` for self-hosted deployment | ⬜ Pending | Medium |
| **7. Testing** | Unit tests: backend functions, providers, utilities | ⬜ Pending | High |
| **7. Testing** | Unit tests: React components, hooks, utils | ⬜ Pending | High |
| **7. Testing** | Integration tests: API endpoints, DB queries | ⬜ Pending | High |
| **7. Testing** | E2E tests: Playwright full user flows | ⬜ Pending | High |
| **7. Testing** | CI pipeline: Vitest + Playwright on every PR | ⬜ Pending | High |
| **8. Security** | Husky pre-commit hooks (lint, test, typecheck) | ⬜ Pending | High |
| **8. Security** | HTTP security headers (Helmet.js, CSP, HSTS) | ⬜ Pending | High |
| **8. Security** | Rate limiting (global + auth + AI endpoints) | ⬜ Pending | High |
| **8. Security** | Input validation & sanitization (Zod + sanitize-html) | ⬜ Pending | High |
| **8. Security** | Auth security (bcrypt, account lockout, JWT rotation) | ⬜ Pending | High |
| **8. Security** | MFA (TOTP via otplib — Authy/Google Authenticator, recovery codes, encrypted secrets) | ⬜ Pending | High |
| **8. Security** | BYOK encryption (AES-256-GCM at rest) | ⬜ Pending | High |
| **8. Security** | Audit logging for sensitive events | ⬜ Pending | Medium |
| **8. Security** | File upload security (magic bytes, size limits) | ⬜ Pending | Medium |
| **9. Operations** | Health check endpoints (/health, /health/ready) | ⬜ Pending | High |
| **9. Operations** | Graceful shutdown (SIGTERM/SIGINT handling) | ⬜ Pending | High |
| **9. Operations** | Structured logging (pino) with request tracking | ⬜ Pending | High |
| **9. Operations** | Database migrations (Drizzle ORM) | ⬜ Pending | High |
| **9. Operations** | Error handling middleware (provider-agnostic) | ⬜ Pending | High |
| **9. Operations** | Backup strategy for SaaS PostgreSQL | ⬜ Pending | Medium |
| **10. API Docs** | OpenAPI/Swagger auto-generation from Zod schemas | ⬜ Pending | Medium |
| **10. API Docs** | Swagger UI endpoint (/docs) | ⬜ Pending | Medium |
| **11. Performance** | Response compression (compression middleware) | ⬜ Pending | Medium |
| **11. Performance** | Static asset caching (1 year max-age) | ⬜ Pending | Medium |
| **11. Performance** | Database connection pooling | ⬜ Pending | Medium |
| **11. Performance** | Request deduplication for same upload hash | ⬜ Pending | Medium |
| **11. Performance** | Memory management middleware | ⬜ Pending | Low |

---

## 🏗️ 1. System Architecture

### Directory Structure (Post-Refactor)

```
vitalitynutri/
├── server/
│   ├── config/
│   │   └── env.ts                  # Zod validated env schema (DRY: single source of truth)
│   ├── ai/
│   │   ├── types.ts                # AIClient interface (Clean: contract at boundary)
│   │   ├── factory.ts              # Creates client + fallback chain (DRY: one retry path)
│   │   ├── pdf-processor.ts        # Auto-detect + route (DRY: one PDF entry point)
│   │   └── providers/
│   │       ├── groq.ts             # OpenAI-compatible (text-only)
│   │       ├── gemini.ts           # Multimodal
│   │       ├── openai.ts           # OpenAI-compatible (text-only)
│   │       └── anthropic.ts        # Anthropic Messages API
│   ├── saas/                       # SaaS-only features (removable for OSS)
│   │   ├── auth/
│   │   │   ├── jwt.ts
│   │   │   └── middleware.ts
│   │   └── routes.ts
│   ├── middleware/
│   │   ├── auth.ts                 # No-op if MODE=oss
│   │   └── rateLimit.ts            # Global if MODE=oss, per-user if MODE=saas
│   └── server.ts                   # Main entry (routes conditionally loaded)
├── src/                            # Frontend (React)
├── prompts/                        # Prompt templates (1 per type, English only)
│   ├── plan-analysis/prompt.md
│   ├── batch-cooking/prompt.md
│   └── recipe-ai/prompt.md         # Used by PDF, image, text, and mejora flows
└── ...
```

> **Note:** `server/saas/billing/` is intentionally omitted. Add Stripe integration when first paying user arrives. YAGNI.
>
> **Note:** `providers.ts` was removed — `getAvailableProviders()` and `getModelOverrides()` live in `env.ts` (DRY: single config file).

### Request Flow

```
                    ┌─────────────────────────────────────┐
                    │   Backend: Node.js (REST API)        │
                    │   Hosted on: VPS (1 GB RAM)          │
                    │                                      │
                    │   ┌──────────────────────────────┐  │
                    │   │  config/env.ts (Zod validated)│  │
                    │   │  MODE=oss|saas                │  │
                    │   │  AI_PROVIDERS=groq,gemini     │  │
                    │   │  AI_MODELS=groq:llama-3.3-70b │  │
                    │   └──────────────────────────────┘  │
                    └───────────────┬─────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
          [ 1. Hash & DB Lookup ]        [ 2. PDF Analysis ]
          Processed before?                       │
          ├── YES: Return cached JSON   Auto-detect PDF type
          └── NO: Start AI processing   ├── Selectable (text >100 chars)
                                        │   → Text extraction → TEXT CHAIN
                                        │     Groq Llama 3.3 → Qwen 3.6 → Llama 8B
                                        │     → Gemini Flash Lite → Gemini Flash Lite
                                        │
                                        └── Non-selectable (scanned/image)
                                            → Render to image → MULTIMODAL CHAIN
                                              Gemini 3.5 Flash Lite → Gemini 3.1 Flash Lite
```

---

## 🧭 Architecture Principles

### Clean Architecture
- **Dependencies point inward.** `server/ai/` never imports from `server/saas/`. `server/saas/` imports from `server/ai/`.
- **Domain logic in types.** `AIClient` interface defines the contract. Providers are implementations.
- **Config at the edge.** `env.ts` parses once at startup. Rest of app reads typed `env.*` — never `process.env`.

### DRY
- **One retry function.** `generateWithFallback()` handles all retry/fallback logic. No duplicate retry code in providers.
- **One error classifier.** `isRetryableError()` works for all providers. Provider-specific errors handled inside each provider.
- **One PDF flow.** `processPDF()` is the single entry point. No duplicated hash/check/route logic in endpoints.
- **One prompt per type.** English base prompt + runtime language suffix. No duplicated prompt files per language.

### KISS
- **Env vars over config files.** Two keys: `AI_PROVIDERS` (order) + `AI_MODELS` (overrides). No YAML/TOML parsing.
- **Factory over registry.** `createClient(provider)` is a switch statement. No plugin system, no dynamic imports.
- **SQLite for OSS.** No PostgreSQL setup for self-hosters. Single file, zero config.
- **Billing is a stub.** `server/saas/billing/` doesn't exist yet. Implement when first paying user arrives.
- **No LangSmith.** Prompt versioning via git. Observability via simple logging if needed later.

---

## 🔧 2. Zod Environment Configuration

### Schema Definition

```ts
// server/config/env.ts
import { z } from "zod";

// All providers supported. OSS users can bring any key.
// SaaS defaults to groq + Gemini (both have free tiers).
const aiProviderEnum = z.enum(["groq", "gemini", "openai", "anthropic"]);

const envSchema = z.object({
  // ─── Mode ─────────────────────────────────────────────
  MODE: z.enum(["oss", "saas"]).default("oss"),
  
  // ─── Server ───────────────────────────────────────────
  PORT: z.coerce.number().int().positive().default(5027),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  APP_URL: z.string().url().optional().default(""),
  SITE_VISIBILITY: z.enum(["public", "local"]).default("local"),
  // ─── Localization (runtime, NOT build-time) ───────────
  // Available UI languages served via GET /api/config → AppBar dropdown.
  // User picks in-app; choice persisted per-user (SaaS: users.lang) or
  // localStorage (OSS). First entry of AVAILABLE_LANGS = default.
  AVAILABLE_LANGS: z.string().default("en,es"),
  DEFAULT_LANG: z.string().default("en"),
  DISABLE_HMR: z.coerce.boolean().default(false),
  
  // ─── AI Gateway (OmniRoute) — available to both modes ──
  // USE_OMNIROUTE=true  → route all AI calls through an OpenAI-compatible
  //                       OmniRoute Gateway. Delegate model selection, free-tier
  //                       pool aggregation, fallback chains, and token compression
  //                       (Caveman/RTK) using virtual model aliases (combos).
  // USE_OMNIROUTE=false → Direct BYOK: connect straight to vendor APIs, local
  //                       fallback loops across user's enabled keys.
  USE_OMNIROUTE: z.coerce.boolean().default(true),
  OMNIROUTE_URL: z.string().url().default("http://omniroute:20128/v1"),
  OMNIROUTE_API_KEY: z.string().optional().default("omniroute"),
  
  // ─── Virtual Model Aliases (OmniRoute Combos) ─────────
  // Logical task names. In Gateway mode, passed to OmniRoute which maps them to
  // real model combos. In Direct BYOK mode, mapped to the user's AI_PROVIDERS.
  MODEL_PDF_TEXT: z.string().default("nutri-pdf-text"),
  MODEL_PDF_VISION: z.string().default("nutri-pdf-vision"),
  MODEL_BATCH_COOKING: z.string().default("nutri-batch"),
  MODEL_RECIPE_AI: z.string().default("nutri-recipe"),
  MODEL_CHAT: z.string().default("nutri-chat"),
  
  // ─── AI Providers (ordered fallback list) ─────────────
  // Used ONLY when USE_OMNIROUTE=false (Direct BYOK).
  // Free tier providers: groq (30 RPM), gemini (15 RPM Flash, 1500 req/day)
  // Paid-only: openai ($5 trial, expires 3mo), anthropic ($5 trial, expires ~90d)
  // Default: groq,gemini (both free forever)
  AI_PROVIDERS: z.string()
    .transform(s => s.split(",").map(s => s.trim()))
    .pipe(z.array(aiProviderEnum).min(1))
    .default("groq,gemini"),
  
  // ─── AI Models (optional overrides per provider) ──────
  // Format: "provider:model,provider:model,..."
  // Example: "groq:llama-3.3-70b-versatile,groq:qwen/qwen3.6-27b"
  // If omitted, each provider uses its built-in default chain.
  // Used ONLY when USE_OMNIROUTE=false (Direct BYOK).
  AI_MODELS: z.string().optional().default(""),
  
  // ─── Direct Provider Keys (BYOK when USE_OMNIROUTE=false) ──
  // Selectively configure only the providers you want.
  // Unselected provider keys remain completely optional.
  GROQ_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  
  // ─── Optional ─────────────────────────────────────────
  UNSPLASH_ACCESS_KEY: z.string().optional(),
  
  // ─── Chat cost controls (optional feature) ────────────
  CHAT_ENABLED: z.coerce.boolean().default(true),
  CHAT_MAX_MESSAGES: z.coerce.number().int().positive().default(20),
  CHAT_MAX_USER_CHARS: z.coerce.number().int().positive().default(500),
  CHAT_MAX_CONTEXT_TOKENS: z.coerce.number().int().positive().default(4000),
  CHAT_MODEL: z.string().default("llama-3.1-8b-instant"),
  
  // ─── MFA (SaaS) ───────────────────────────────────────
  MFA_REQUIRED: z.coerce.boolean().default(false),
  MFA_ISSUER: z.string().default("VitalityNutri"),
  MFA_WINDOW: z.coerce.number().int().min(0).max(2).default(1),
  MFA_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  MFA_ATTEMPT_WINDOW: z.string().default("15m"),
  MFA_TOKEN_TTL: z.string().default("5m"),
  
  // ─── SaaS Only (validated only if MODE=saas) ─────────
  JWT_SECRET: z.string().min(32).optional(),
}).superRefine((data, ctx) => {
  const keyMap: Record<string, string | undefined> = {
    groq: data.GROQ_API_KEY,
    gemini: data.GEMINI_API_KEY,
    openai: data.OPENAI_API_KEY,
    anthropic: data.ANTHROPIC_API_KEY,
  };
  
  // ── Gateway Mode (USE_OMNIROUTE=true): only URL is required ──
  // Provider keys are optional. OmniRoute aggregates keys server-side.
  if (data.USE_OMNIROUTE) {
    if (!data.OMNIROUTE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "USE_OMNIROUTE=true requires OMNIROUTE_URL",
        path: ["OMNIROUTE_URL"],
      });
    }
  }
  
  // ── Direct BYOK Mode (USE_OMNIROUTE=false): require keys ──
  // Check AI_PROVIDERS and require at least one valid API key for the
  // selected providers. Unselected provider keys remain optional.
  if (!data.USE_OMNIROUTE) {
    const hasAnyKey = data.AI_PROVIDERS.some(p => !!keyMap[p]);
    if (!hasAnyKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "USE_OMNIROUTE=false (Direct BYOK) requires at least one API key for AI_PROVIDERS (e.g., GROQ_API_KEY or GEMINI_API_KEY)",
        path: ["AI_PROVIDERS"],
      });
    }
  }
  
  // SaaS requires JWT_SECRET
  if (data.MODE === "saas" && !data.JWT_SECRET) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "MODE=saas requires JWT_SECRET (min 32 chars)",
      path: ["JWT_SECRET"],
    });
  }
  
  // Validate AI_MODELS format if provided
  if (data.AI_MODELS) {
    for (const entry of data.AI_MODELS.split(",").map(s => s.trim()).filter(Boolean)) {
      const [provider, ...modelParts] = entry.split(":");
      const model = modelParts.join(":");
      if (!provider || !model) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid AI_MODELS format: "${entry}". Expected "provider:model"`,
          path: ["AI_MODELS"],
        });
      }
      if (!aiProviderEnum.safeParse(provider).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown provider in AI_MODELS: "${provider}"`,
          path: ["AI_MODELS"],
        });
      }
    }
  }
});

// Parse on startup — crash immediately on bad config
export const env = envSchema.parse(process.env);

// ─── Derived values ───────────────────────────────────────
export const isSaaS = env.MODE === "saas";
export const isOSS = env.MODE === "oss";

// Gateway vs Direct BYOK routing
export const useOmniRoute = env.USE_OMNIROUTE;

// Map of virtual model alias → env value
export const MODEL_ALIASES: Record<string, string> = {
  "pdf-text": env.MODEL_PDF_TEXT,
  "pdf-vision": env.MODEL_PDF_VISION,
  "batch-cooking": env.MODEL_BATCH_COOKING,
  "recipe-ai": env.MODEL_RECIPE_AI,
  "chat": env.MODEL_CHAT,
};

// Check which providers have keys configured (Direct BYOK mode only)
export function getAvailableProviders(): string[] {
  const keyMap: Record<string, string | undefined> = {
    groq: env.GROQ_API_KEY,
    gemini: env.GEMINI_API_KEY,
    openai: env.OPENAI_API_KEY,
    anthropic: env.ANTHROPIC_API_KEY,
  };
  // Only providers the user explicitly enabled AND has keys for
  return env.AI_PROVIDERS.filter(p => !!keyMap[p]);
}

// Parse AI_MODELS into a map: { groq: ["llama-3.3-70b-versatile", ...], gemini: [...] }
export function getModelOverrides(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  if (!env.AI_MODELS) return map;
  
  for (const entry of env.AI_MODELS.split(",").map(s => s.trim()).filter(Boolean)) {
    const [provider, ...modelParts] = entry.split(":");
    const model = modelParts.join(":");
    if (!map.has(provider)) map.set(provider, []);
    map.get(provider)!.push(model);
  }
  return map;
}
```

### `.env.example`

```env
# ─── Mode ─────────────────────────────────────────────
# MODE: "oss" (self-hosted, BYOK) or "saas" (managed, platform keys)
# Default: oss
MODE=oss

# ─── Server ───────────────────────────────────────────
PORT=5027
NODE_ENV=development
APP_URL=""
SITE_VISIBILITY=local

# ─── Localization (runtime) ───────────────────────────
# UI languages offered in the AppBar dropdown. Served via GET /api/config.
# First entry is the default. NOT baked at build time.
AVAILABLE_LANGS=en,es
DEFAULT_LANG=en

# ─── AI Gateway (OmniRoute) ──────────────────────────────
# USE_OMNIROUTE=true  → route through OmniRoute gateway (virtual model aliases,
#                       gateway handles fallback/compression/pooling).
# USE_OMNIROUTE=false → Direct BYOK: connect straight to vendor APIs, local
#                       fallback loops across enabled keys.
# Default: true (SaaS + self-hosted with local OmniRoute)
USE_OMNIROUTE=true
OMNIROUTE_URL=http://omniroute:20128/v1
OMNIROUTE_API_KEY=omniroute

# ─── Virtual Model Aliases (OmniRoute Combos) ──────────
# Logical task names. Gateway mode → sent to OmniRoute as-is.
# Direct BYOK mode → mapped to AI_PROVIDERS by the factory.
MODEL_PDF_TEXT=nutri-pdf-text
MODEL_PDF_VISION=nutri-pdf-vision
MODEL_BATCH_COOKING=nutri-batch
MODEL_RECIPE_AI=nutri-recipe
MODEL_CHAT=nutri-chat

# ─── AI Providers (comma-separated, ordered by priority) ──
# ONLY used when USE_OMNIROUTE=false (Direct BYOK).
# Free tier (permanent): groq (30 RPM, 1K req/day), gemini (15 RPM, 1500 req/day)
# Paid-only (trial credits expire): openai ($5, 3 months), anthropic ($5, ~90 days)
# Default: groq,gemini (both free forever, no credit card needed)
AI_PROVIDERS=groq,gemini

# ─── AI Models (optional overrides per provider) ──────
# Format: "provider:model,provider:model,..."
# If omitted, each provider uses its built-in default chain.
# Example: override Groq's default models
# AI_MODELS=groq:llama-3.3-70b-versatile,groq:qwen/qwen3.6-27b,groq:llama-3.1-8b-instant
AI_MODELS=

# ─── Direct Provider Keys (BYOK when USE_OMNIROUTE=false) ──
# Configure ONLY the providers you want. Unselected keys stay optional.
# USE_OMNIROUTE=true → all keys optional (OmniRoute aggregates server-side).
GROQ_API_KEY=gsk_your_groq_key_here
GEMINI_API_KEY=AIzaSy_your_gemini_key_here
# OPENAI_API_KEY=sk-your_openai_key_here       # Optional, trial only
# ANTHROPIC_API_KEY=sk-ant-your_anthropic_key_here  # Optional, trial only

# ─── Optional ─────────────────────────────────────────
UNSPLASH_ACCESS_KEY=""

# ─── SaaS Only (MODE=saas requires these) ────────────
# JWT_SECRET=min-32-characters-for-jwt-signing
```

---

## 🤖 3. AI Provider Abstraction

### Interface Definition

```ts
// server/ai/types.ts

/** What the caller sends */
export interface GenerateTextRequest {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  responseFormat?: "json" | "text";
  maxTokens?: number;
}

/** What the caller receives */
export interface GenerateTextResponse {
  text: string;
  model: string;
  provider: string;
  usage?: { input: number; output: number };
}

/** Provider capability flags */
export interface AIClient {
  readonly name: string;
  readonly supportsMultimodal: boolean;
  
  generateText(req: GenerateTextRequest): Promise<GenerateTextResponse>;
  generateWithImage(req: GenerateTextRequest & {
    image: { data: string; mimeType: string };
  }): Promise<GenerateTextResponse>;
}
```

### Provider Implementations

#### Groq (OpenAI-Compatible)

```ts
// server/ai/providers/groq.ts
import OpenAI from "openai";
import { AIClient, GenerateTextRequest, GenerateTextResponse } from "../types.js";

const GROQ_MODELS = [
  "llama-3.3-70b-versatile",  // Production, 280 tps, $0.59/$0.79 per 1M
  "qwen/qwen3.6-27b",         // PREVIEW — 500 tps, $0.60/$3.00 per 1M (may be deprecated)
  "llama-3.1-8b-instant",      // Production, 560 tps, $0.05/$0.08 per 1M
] as const;

export class GroqClient implements AIClient {
  readonly name = "groq";
  readonly supportsMultimodal = false;
  
  private client: OpenAI;
  private models: readonly string[];
  
  constructor(apiKey: string, models?: string[]) {
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://api.groq.com/openai/v1",
    });
    this.models = models ?? GROQ_MODELS;
  }
  
  async generateText(req: GenerateTextRequest): Promise<GenerateTextResponse> {
    const messages: OpenAI.ChatCompletionMessageParam[] = [];
    if (req.systemPrompt) {
      messages.push({ role: "system", content: req.systemPrompt });
    }
    messages.push({ role: "user", content: req.prompt });
    
    const response = await this.client.chat.completions.create({
      model: this.models[0], // First model, fallback handled at factory level
      messages,
      temperature: req.temperature ?? 0.2,
      max_tokens: req.maxTokens ?? 4096,
      response_format: req.responseFormat === "json" ? { type: "json_object" } : undefined,
    });
    
    return {
      text: response.choices[0].message.content ?? "",
      model: response.model,
      provider: this.name,
      usage: response.usage ? {
        input: response.usage.prompt_tokens,
        output: response.usage.completion_tokens,
      } : undefined,
    };
  }
  
  async generateWithImage(): Promise<GenerateTextResponse> {
    throw new Error("Groq does not support multimodal input");
  }
}
```

#### Gemini (Adapted from Current)

```ts
// server/ai/providers/gemini.ts
import { GoogleGenAI } from "@google/genai";
import { AIClient, GenerateTextRequest, GenerateTextResponse } from "../types.js";

const GEMINI_MODELS = [
  "gemini-2.5-flash",         // Latest, best balance
  "gemini-2.5-flash-lite",    // Fastest/cheapest
  "gemini-2.0-flash",         // Previous gen, still good
] as const;

export class GeminiClient implements AIClient {
  readonly name = "gemini";
  readonly supportsMultimodal = true;
  
  private ai: GoogleGenAI;
  private models: readonly string[];
  
  constructor(apiKey: string, models?: string[]) {
    this.ai = new GoogleGenAI({
      apiKey,
      httpOptions: { timeout: 300000 },
    });
    this.models = models ?? GEMINI_MODELS;
  }
  
  async generateText(req: GenerateTextRequest): Promise<GenerateTextResponse> {
    const contents = [
      ...(req.systemPrompt ? [{ role: "user", parts: [{ text: req.systemPrompt }] }] : []),
      { role: "user", parts: [{ text: req.prompt }] },
    ];
    
    const response = await this.ai.models.generateContent({
      model: this.models[0],
      contents,
      config: {
        responseMimeType: req.responseFormat === "json" ? "application/json" : undefined,
        temperature: req.temperature ?? 0.2,
        maxOutputTokens: req.maxTokens,
      },
    });
    
    return {
      text: response.text ?? "",
      model: this.models[0],
      provider: this.name,
    };
  }
  
  async generateWithImage(req: GenerateTextRequest & {
    image: { data: string; mimeType: string };
  }): Promise<GenerateTextResponse> {
    const contents = [
      { inlineData: { mimeType: req.image.mimeType, data: req.image.data } },
      req.prompt,
    ];
    
    const response = await this.ai.models.generateContent({
      model: this.models[0],
      contents,
      config: {
        responseMimeType: req.responseFormat === "json" ? "application/json" : undefined,
        temperature: req.temperature ?? 0.2,
      },
    });
    
    return {
      text: response.text ?? "",
      model: this.models[0],
      provider: this.name,
    };
  }
}
```

#### OpenAI (OpenAI-Compatible)

```ts
// server/ai/providers/openai.ts
import OpenAI from "openai";
import { AIClient, GenerateTextRequest, GenerateTextResponse } from "../types.js";

const OPENAI_MODELS = [
  "gpt-4o-mini",              // Cheapest, fast
  "gpt-4o",                   // Balanced
  "gpt-4.1-nano",             // Latest nano
] as const;

export class OpenAIClient implements AIClient {
  readonly name = "openai";
  readonly supportsMultimodal = false;

  private client: OpenAI;
  private models: readonly string[];

  constructor(apiKey: string, models?: string[]) {
    this.client = new OpenAI({ apiKey });
    this.models = models ?? OPENAI_MODELS;
  }

  async generateText(req: GenerateTextRequest): Promise<GenerateTextResponse> {
    const messages: OpenAI.ChatCompletionMessageParam[] = [];
    if (req.systemPrompt) {
      messages.push({ role: "system", content: req.systemPrompt });
    }
    messages.push({ role: "user", content: req.prompt });

    const response = await this.client.chat.completions.create({
      model: this.models[0],
      messages,
      temperature: req.temperature ?? 0.2,
      max_tokens: req.maxTokens ?? 4096,
      response_format: req.responseFormat === "json" ? { type: "json_object" } : undefined,
    });

    return {
      text: response.choices[0].message.content ?? "",
      model: response.model,
      provider: this.name,
      usage: response.usage ? {
        input: response.usage.prompt_tokens,
        output: response.usage.completion_tokens,
      } : undefined,
    };
  }

  async generateWithImage(): Promise<GenerateTextResponse> {
    throw new Error("OpenAI text-only via this client");
  }
}
```

#### Anthropic (Messages API)

```ts
// server/ai/providers/anthropic.ts
import Anthropic from "@anthropic-ai/sdk";
import { AIClient, GenerateTextRequest, GenerateTextResponse } from "../types.js";

const ANTHROPIC_MODELS = [
  "claude-sonnet-4-20250514",  // Balanced
  "claude-haiku-35-20241022",  // Fast/cheap
] as const;

export class AnthropicClient implements AIClient {
  readonly name = "anthropic";
  readonly supportsMultimodal = false;

  private client: Anthropic;
  private models: readonly string[];

  constructor(apiKey: string, models?: string[]) {
    this.client = new Anthropic({ apiKey });
    this.models = models ?? ANTHROPIC_MODELS;
  }

  async generateText(req: GenerateTextRequest): Promise<GenerateTextResponse> {
    const response = await this.client.messages.create({
      model: this.models[0],
      max_tokens: req.maxTokens ?? 4096,
      temperature: req.temperature ?? 0.2,
      system: req.systemPrompt ?? "",
      messages: [{ role: "user", content: req.prompt }],
    });

    const textBlock = response.content.find(b => b.type === "text");

    return {
      text: textBlock?.text ?? "",
      model: response.model,
      provider: this.name,
      usage: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      },
    };
  }

  async generateWithImage(): Promise<GenerateTextResponse> {
    throw new Error("Anthropic text-only via this client");
  }
}
```

### Factory + Fallback Chain (Dual-Mode)

```ts
// server/ai/factory.ts
import { env, getAvailableProviders, getModelOverrides, MODEL_ALIASES } from "../config/env.js";
import { AIClient, GenerateTextRequest, GenerateTextResponse } from "./types.js";
import { GroqClient } from "./providers/groq.js";
import { GeminiClient } from "./providers/gemini.js";
import { OpenAIClient } from "./providers/openai.js";
import { AnthropicClient } from "./providers/anthropic.js";

const RETRIES_PER_MODEL = 3;

function createClient(provider: string, modelsOverride?: string[]): AIClient {
  const overrides = getModelOverrides();
  const models = modelsOverride ?? overrides.get(provider);
  const apiKey = env[`${provider.toUpperCase()}_API_KEY` as keyof typeof env] as string;
  
  switch (provider) {
    case "groq":    return new GroqClient(apiKey, models);
    case "gemini":  return new GeminiClient(apiKey, models);
    case "openai":  return new OpenAIClient(apiKey, models);
    case "anthropic": return new AnthropicClient(apiKey, models);
    default: throw new Error(`Unknown provider: ${provider}`);
  }
}

function isRetryableError(error: any): boolean {
  const status = error?.status || error?.code;
  const msg = String(error?.message || "").toLowerCase();
  return [429, 503, 504].includes(status) ||
    ["high demand", "unavailable", "resource_exhausted", "quota", "rate", "timeout"]
      .some(s => msg.includes(s));
}

function isUnsupportedModelError(error: any): boolean {
  const status = error?.status || error?.code;
  const msg = String(error?.message || "").toLowerCase();
  return status === 400 || status === 404 ||
    (msg.includes("model") && ["not found", "unsupported", "not available"].some(s => msg.includes(s)));
}

/**
 * Direct BYOK fallback loop. Iterates the user's enabled providers in priority
 * order, skipping any whose API key is missing or that lack multimodal support.
 * DRY: no retry logic exists anywhere else.
 * KISS: flat loop, no recursion, no state machines.
 */
export async function generateWithFallback(
  req: GenerateTextRequest,
  options?: { multimodal?: boolean }
): Promise<GenerateTextResponse> {
  const providers = getAvailableProviders(); // only enabled providers WITH keys
  let lastError: any = null;
  
  for (const providerName of providers) {
    const client = createClient(providerName);
    
    // Skip non-multimodal providers when image is needed
    if (options?.multimodal && !client.supportsMultimodal) continue;
    
    for (let attempt = 1; attempt <= RETRIES_PER_MODEL; attempt++) {
      try {
        return options?.multimodal && "image" in req
          ? await client.generateWithImage(req as any)
          : await client.generateText(req);
      } catch (error: any) {
        lastError = error;
        if (isUnsupportedModelError(error) || !isRetryableError(error)) break;
        if (attempt < RETRIES_PER_MODEL) {
          await new Promise(r => setTimeout(r, Math.min(1000 * 2 ** (attempt - 1), 10000)));
        }
      }
    }
  }
  
  throw lastError || new Error("No provider could handle the request");
}

/**
 * OmniRoute gateway client. OpenAI-compatible, pointed at the gateway URL.
 * OmniRoute handles model selection, free-tier pooling, fallback chains,
 * and token compression (Caveman/RTK). No local retries — the gateway owns that.
 */
let gatewayClient: OpenAI | null = null;
function getGatewayClient(): OpenAI {
  if (!gatewayClient) {
    gatewayClient = new OpenAI({
      apiKey: env.OMNIROUTE_API_KEY,
      baseURL: env.OMNIROUTE_URL,
    });
  }
  return gatewayClient;
}

async function generateViaGateway(
  alias: string,
  req: GenerateTextRequest,
  options?: { multimodal?: boolean }
): Promise<GenerateTextResponse> {
  const client = getGatewayClient();
  const model = MODEL_ALIASES[alias] ?? alias;
  const messages: OpenAI.ChatCompletionMessageParam[] = [];
  if (req.systemPrompt) {
    messages.push({ role: "system", content: req.systemPrompt });
  }
  messages.push({ role: "user", content: req.prompt });
  
  const response = await client.chat.completions.create({
    model, // virtual alias — OmniRoute maps it to a real combo
    messages,
    temperature: req.temperature ?? 0.2,
    max_tokens: req.maxTokens ?? 4096,
    response_format: req.responseFormat === "json" ? { type: "json_object" } : undefined,
  });
  
  return {
    text: response.choices[0].message.content ?? "",
    model: response.model,
    provider: "omniroute",
    usage: response.usage ? {
      input: response.usage.prompt_tokens,
      output: response.usage.completion_tokens,
    } : undefined,
  };
}

/**
 * Direct BYOK chat cost control: chat is PINNED to the cheap dedicated model
 * (env.CHAT_MODEL, e.g. llama-3.1-8b-instant) — never the expensive fallback
 * chain (Llama-70b ≈ 11× cost per message). Same retry policy as the fallback
 * loop, but single-model.
 */
async function generateChatDirect(req: GenerateTextRequest): Promise<GenerateTextResponse> {
  const providers = getAvailableProviders();
  let lastError: any = null;
  for (const providerName of providers) {
    const client = createClient(providerName, [env.CHAT_MODEL]);
    for (let attempt = 1; attempt <= RETRIES_PER_MODEL; attempt++) {
      try {
        return await client.generateText(req);
      } catch (error: any) {
        lastError = error;
        if (isUnsupportedModelError(error) || !isRetryableError(error)) break;
        if (attempt < RETRIES_PER_MODEL) {
          await new Promise(r => setTimeout(r, Math.min(1000 * 2 ** (attempt - 1), 10000)));
        }
      }
    }
  }
  throw lastError || new Error("No provider could handle the chat request");
}

/**
 * SINGLE ENTRY POINT for all AI operations (PDF, recipe, batch, chat, mejora).
 * Routes by deployment mode:
 *
 *  Branch A — USE_OMNIROUTE=true  → gateway call with virtual model alias.
 *              No local retries/fallbacks (OmniRoute owns that).
 *  Branch B — USE_OMNIROUTE=false → local fallback loop across enabled
 *              AI_PROVIDERS. Providers without keys are skipped.
 *              Chat alias is pinned to env.CHAT_MODEL (cost control).
 *
 * @param alias Logical task name: "pdf-text" | "pdf-vision" | "batch-cooking"
 *              | "recipe-ai" | "chat"
 */
export async function generateAIResponse(
  alias: string,
  req: GenerateTextRequest,
  options?: { multimodal?: boolean }
): Promise<GenerateTextResponse> {
  if (env.USE_OMNIROUTE) {
    return generateViaGateway(alias, req, options);
  }
  // Direct BYOK: alias only selects the task; provider routing is per-provider
  // via getAvailableProviders(). The alias is not sent to any vendor.
  if (alias === "chat") {
    return generateChatDirect(req);
  }
  return generateWithFallback(req, options);
}
```

---

## 📝 3.5 Prompt Strategy (DRY) + Eval Suite

**One prompt per type, English only.** Language instruction appended at runtime.

```
prompts/
├── plan-analysis/
│   └── prompt.md           # English base prompt
├── batch-cooking/
│   └── prompt.md           # English base prompt
└── recipe-ai/
    └── prompt.md           # English base prompt
```

```ts
// DRY: single prompt file, language suffix appended at runtime
async function getPrompt(type: string, lang: string): Promise<string> {
  const base = await fs.readFile(`prompts/${type}/prompt.md`, "utf-8");
  
  if (lang === "es") {
    return `${base}\n\n---\nIMPORTANT: Respond entirely in Spanish. All food names, instructions, and descriptions must be in Spanish.`;
  }
  return base;
}
```

> **Why not separate files per language?** Models understand "respond in Spanish" perfectly. One file to maintain. No drift between versions. Fewer prompt tokens.

**Chat has no prompt file.** Its system message is built inline from the diet JSON — dynamic, not a template.

### Test Fixtures

```
prompts/__fixtures__/
├── plan-analysis/
│   ├── sample-selectable.pdf      # Small selectable PDF (text >100 chars)
│   ├── sample-scanned.pdf         # Small scanned/image PDF
│   └── expected/
│       ├── selectable.json        # Expected AI output for selectable
│       └── scanned.json           # Expected AI output for scanned
├── batch-cooking/
│   ├── sample-plan.json           # Existing diet JSON
│   └── expected/
│       └── batch.json             # Expected batch cooking output
└── recipe-ai/
    ├── sample-recipe.pdf          # Recipe PDF
    ├── sample-recipe-image.jpg    # Recipe as image
    ├── sample-recipe-text.txt     # Recipe as plain text
    └── expected/
        ├── from-pdf.json
        ├── from-image.json
        └── from-text.json
```

> Fixtures are small (<100KB total). Sanitized — no real user data. Committed to git.

### Eval Levels

#### Level 1: Static Tests (Free, Every Commit)

```ts
// prompts/prompt.test.ts
import { readFileSync } from "fs";
import { describe, test, expect } from "vitest";

const PROMPT_DIR = "prompts";
const PROMPT_TYPES = ["plan-analysis", "batch-cooking", "recipe-ai"];

const REQUIRED_PLACEHOLDERS: Record<string, string[]> = {
  "plan-analysis": ["{{kOptions}}", "{{extraPrompt}}"],
  "batch-cooking": [],
  "recipe-ai": ["{{kOptions}}", "{{extraPrompt}}"],
};

describe("Prompt files", () => {
  test.each(PROMPT_TYPES)(
    "%s/prompt.md exists and is non-empty",
    (type) => {
      const prompt = readFileSync(`${PROMPT_DIR}/${type}/prompt.md`, "utf-8");
      expect(prompt.trim().length).toBeGreaterThan(50);
    }
  );

  test.each(PROMPT_TYPES)(
    "%s/prompt.md contains required placeholders",
    (type) => {
      const prompt = readFileSync(`${PROMPT_DIR}/${type}/prompt.md`, "utf-8");
      for (const placeholder of REQUIRED_PLACEHOLDERS[type] ?? []) {
        expect(prompt).toContain(placeholder);
      }
    }
  );
});
```

#### Level 2: Schema Validation (Free, Every Commit)

```ts
// prompts/eval.schema.test.ts
import { z } from "zod";
import { describe, test, expect } from "vitest";

// Output schemas per prompt type
const PlanAnalysisSchema = z.object({
  patient: z.object({
    name: z.string().min(1),
    age: z.number().positive(),
    gender: z.enum(["M", "F", "O"]),
  }),
  diagnosis: z.string().min(1),
  meals: z.array(z.object({
    name: z.string(),
    foods: z.array(z.object({
      name: z.string(),
      portion: z.string(),
      calories: z.number().optional(),
    })),
  })),
  dailyTotals: z.object({
    calories: z.number().positive(),
    protein: z.number().positive(),
    carbs: z.number().positive(),
    fat: z.number().positive(),
  }),
});

const RecipeSchema = z.object({
  name: z.string().min(1),
  ingredients: z.array(z.object({
    name: z.string(),
    quantity: z.string(),
    unit: z.string().optional(),
  })),
  instructions: z.array(z.string().min(10)),
  prepTime: z.string().optional(),
  cookTime: z.string().optional(),
  servings: z.number().positive().optional(),
  // NEW: optional nutritional info per serving (may be absent)
  nutrition: z.object({
    calories: z.number().positive(),
    protein: z.number().nonnegative(),
    carbs: z.number().nonnegative(),
    fat: z.number().nonnegative(),
  }).optional(),
});

const BatchCookingSchema = z.object({
  recipes: z.array(z.object({
    name: z.string(),
    ingredients: z.array(z.string()),
    steps: z.array(z.string()),
    servings: z.number(),
    prepTime: z.string(),
    cookTime: z.string(),
  })),
  shoppingList: z.array(z.object({
    item: z.string(),
    quantity: z.string(),
    category: z.string(),
  })),
});

describe("Output schema validation", () => {
  test("PlanAnalysisSchema is valid Zod schema", () => {
    expect(() => PlanAnalysisSchema.parse({
      patient: { name: "Test", age: 30, gender: "M" },
      diagnosis: "Test diagnosis",
      meals: [{ name: "Breakfast", foods: [{ name: "Egg", portion: "2 units" }] }],
      dailyTotals: { calories: 2000, protein: 100, carbs: 250, fat: 70 },
    })).not.toThrow();
  });

  test("RecipeSchema is valid Zod schema", () => {
    expect(() => RecipeSchema.parse({
      name: "Test Recipe",
      ingredients: [{ name: "Flour", quantity: "2", unit: "cups" }],
      instructions: ["Mix ingredients together"],
    })).not.toThrow();
  });

  test("BatchCookingSchema is valid Zod schema", () => {
    expect(() => BatchCookingSchema.parse({
      recipes: [{
        name: "Test",
        ingredients: ["Flour"],
        steps: ["Mix"],
        servings: 4,
        prepTime: "10 min",
        cookTime: "20 min",
      }],
      shoppingList: [{ item: "Flour", quantity: "2 cups", category: "Dry" }],
    })).not.toThrow();
  });
});
```

#### Level 3: Regression Tests (Real API, Every Commit)

> **Note:** Eval harness calls `generateWithFallback` directly (not `generateAIResponse`) — it deliberately exercises the Direct BYOK free-tier path (Groq runs, Gemini judges) with `skipIf` when no keys exist. Gateway-mode coverage is owned by the dual-mode factory tests (see §14.3).

```ts
// prompts/eval.regression.test.ts
import fs from "fs";
import path from "path";
import { describe, test, expect, beforeAll } from "vitest";
import { generateWithFallback } from "../server/ai/factory.js";
import { getPrompt } from "../server/prompts.js";

const FIXTURES_DIR = "prompts/__fixtures__";
const TOLERANCE = 0.85; // 85% match threshold

// Load expected outputs
function loadExpected(type: string, variant: string) {
  const file = path.join(FIXTURES_DIR, type, "expected", `${variant}.json`);
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

// Load sample input
function loadInput(type: string, filename: string) {
  return fs.readFileSync(path.join(FIXTURES_DIR, type, filename));
}

// Compare AI output against expected (fuzzy match)
function scoreMatch(actual: any, expected: any): number {
  const actualKeys = Object.keys(actual);
  const expectedKeys = Object.keys(expected);
  
  // Key coverage: how many expected keys exist in actual
  const keyCoverage = expectedKeys.filter(k => actualKeys.includes(k)).length / expectedKeys.length;
  
  // Type match: are the types compatible?
  let typeMatch = 0;
  for (const key of expectedKeys) {
    if (actualKeys.includes(key)) {
      const actualType = typeof actual[key];
      const expectedType = typeof expected[key];
      if (actualType === expectedType) typeMatch++;
      else if (Array.isArray(actual[key]) === Array.isArray(expected[key])) typeMatch++;
    }
  }
  const typeScore = typeMatch / expectedKeys.length;
  
  return (keyCoverage + typeScore) / 2;
}

describe("Prompt regression tests", () => {
  // Skip if no API key available (CI with secrets)
  const hasApiKey = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY;
  
  test.skipIf(!hasApiKey)("plan-analysis: selectable PDF matches expected structure", async () => {
    const prompt = await getPrompt("plan-analysis", "en");
    const pdfBuffer = loadInput("plan-analysis", "sample-selectable.pdf");
    const expected = loadExpected("plan-analysis", "selectable");
    
    const result = await generateWithFallback({
      prompt: `Extract diet data:\n\n${pdfBuffer.toString()}\n\n${prompt}`,
      responseFormat: "json",
    });
    
    const actual = JSON.parse(result.text);
    const score = scoreMatch(actual, expected);
    
    expect(score).toBeGreaterThanOrEqual(TOLERANCE);
  }, 30000); // 30s timeout for API call

  test.skipIf(!hasApiKey)("recipe-ai: from text matches expected structure", async () => {
    const prompt = await getPrompt("recipe-ai", "en");
    const recipeText = fs.readFileSync(
      path.join(FIXTURES_DIR, "recipe-ai", "sample-recipe-text.txt"), "utf-8"
    );
    const expected = loadExpected("recipe-ai", "from-text");
    
    const result = await generateWithFallback({
      prompt: `${prompt}\n\nRecipe text:\n${recipeText}`,
      responseFormat: "json",
    });
    
    const actual = JSON.parse(result.text);
    const score = scoreMatch(actual, expected);
    
    expect(score).toBeGreaterThanOrEqual(TOLERANCE);
  }, 30000);
});
```

#### Level 4: Quality Scoring — Gemini/Groq as Judge (Free, Manual)

> **Key insight:** Use Gemini (1500 req/day free) or Groq (1K req/day free) as judges. Entire eval suite = $0.

```ts
// prompts/eval.quality.ts
// Run manually: npx tsx prompts/eval.quality.ts
import { GoogleGenAI } from "@google/genai";
import { generateWithFallback } from "../server/ai/factory.js";
import { getPrompt } from "../server/prompts.js";

const JUDGE = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

interface QualityCriteria {
  completeness: number;  // 0-1: Are all fields populated?
  accuracy: number;      // 0-1: Do values make sense?
  format: number;        // 0-1: Valid JSON, correct structure?
  consistency: number;   // 0-1: Does it match expected schema?
}

async function judgeWithGemini(
  actual: any,
  expected: any,
  type: string
): Promise<QualityCriteria> {
  const judgePrompt = `You are an AI output quality judge. Evaluate this ${type} output.

EXPECTED STRUCTURE:
${JSON.stringify(expected, null, 2)}

ACTUAL OUTPUT TO EVALUATE:
${JSON.stringify(actual, null, 2)}

Score each criterion 0.0 to 1.0:
- completeness: Are all expected fields populated? (not empty/undefined)
- accuracy: Do values make sense? (positive calories, reasonable macros, valid food names)
- format: Is it valid JSON with correct structure?
- consistency: How well does it match the expected schema?

Respond ONLY with JSON:
{
  "completeness": <0.0-1.0>,
  "accuracy": <0.0-1.0>,
  "format": <0.0-1.0>,
  "consistency": <0.0-1.0>,
  "issues": ["<list any specific problems>"]
}`;

  const response = await JUDGE.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: judgePrompt }] }],
    config: { responseMimeType: "application/json", temperature: 0.1 },
  });

  return JSON.parse(response.text ?? "{}");
}

async function evaluatePrompt(
  type: string,
  input: Buffer | string,
  expected: any
): Promise<QualityCriteria & { issues: string[] }> {
  // 1. Run prompt on Groq (free tier)
  const prompt = await getPrompt(type, "en");
  const result = await generateWithFallback({
    prompt: typeof input === "string" 
      ? `${prompt}\n\n${input}`
      : `${prompt}\n\n${input.toString()}`,
    responseFormat: "json",
  });
  
  const actual = JSON.parse(result.text);
  
  // 2. Judge with Gemini (free tier)
  const scores = await judgeWithGemini(actual, expected, type);
  
  return { ...scores, issues: scores.issues ?? [] };
}

// Run evaluation
async function main() {
  const types = ["plan-analysis", "recipe-ai", "batch-cooking"];
  const results: Record<string, QualityCriteria> = {};
  
  for (const type of types) {
    console.log(`\n=== Evaluating: ${type} ===`);
    
    // Load fixtures and run
    const criteria = await evaluatePrompt(type, sampleInput, expected);
    results[type] = criteria;
    
    console.log(`  Completeness: ${(criteria.completeness * 100).toFixed(1)}%`);
    console.log(`  Accuracy:     ${(criteria.accuracy * 100).toFixed(1)}%`);
    console.log(`  Format:       ${(criteria.format * 100).toFixed(1)}%`);
    console.log(`  Consistency:  ${(criteria.consistency * 100).toFixed(1)}%`);
    console.log(`  Average:      ${((criteria.completeness + criteria.accuracy + criteria.format + criteria.consistency) / 4 * 100).toFixed(1)}%`);
    if (criteria.issues.length) {
      console.log(`  Issues:`);
      criteria.issues.forEach(i => console.log(`    - ${i}`));
    }
  }
  
  // Summary
  const avg = Object.values(results).reduce((acc, r) => 
    (acc + r.completeness + r.accuracy + r.format + r.consistency) / 4, 0
  ) / Object.keys(results).length;
  
  console.log(`\n=== Overall: ${(avg * 100).toFixed(1)}% ===`);
  process.exit(avg >= 0.85 ? 0 : 1);
}

main().catch(console.error);
```

### Eval Execution Summary

| Level | What | When | Cost | Catches |
|---|---|---|---|---|
| **L1: Static** | Placeholder check, non-empty | Every commit | Free | Broken placeholders, empty files |
| **L2: Schema** | Zod schema validation | Every commit | Free | Wrong output structure |
| **L3: Regression** | Groq runs prompt, Gemini judges | Every commit | Free (both free tiers) | Prompt drift, quality regression |
| **L4: Quality** | Groq runs prompt, Gemini scores 4 criteria | Manual (prompt changes) | Free (both free tiers) | Subtle quality issues |

> **CI cost: $0.** Groq free (30 RPM) + Gemini free (15 RPM) = unlimited evals within free tiers.

---

## 📄 4. PDF Auto-Detection, Hash Check & Routing

```ts
// server/ai/pdf-processor.ts
import fs from "fs";
import crypto from "crypto";
import pdfParse from "pdf-parse";
import { generateAIResponse } from "./factory.js";

const TEXT_THRESHOLD = 100;

export interface PDFResult {
  fileHash: string;
  isSearchable: boolean;
  text: string | null;
  aiResponse: any;
}

/**
 * Compute SHA-256 hash of a file buffer.
 * DRY: single hash function used by upload and reprocess.
 */
export function computeFileHash(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Auto-detect PDF type and route to the appropriate virtual model alias.
 * Deployment-agnostic: the alias (MODEL_PDF_TEXT / MODEL_PDF_VISION) is passed
 * through generateAIResponse(), which routes it to OmniRoute (gateway mode)
 * or to the local fallback chain (Direct BYOK mode).
 * 
 * Flow:
 * 1. Compute hash
 * 2. Check DB cache (caller handles this via findPlanByHash)
 * 3. If not cached or force=true:
 *    a. Extract text → if >100 chars → MODEL_PDF_TEXT (searchable)
 *    b. Else → render image → MODEL_PDF_VISION (scanned/image)
 */
export async function processPDF(filePath: string, prompt: string): Promise<PDFResult> {
  const fileBuffer = fs.readFileSync(filePath);
  const fileHash = computeFileHash(fileBuffer);
  
  // Attempt text extraction
  const pdfData = await pdfParse(fileBuffer);
  const extractedText = pdfData.text.trim();
  const isSearchable = extractedText.length > TEXT_THRESHOLD;
  
  if (isSearchable) {
    const aiResponse = await generateAIResponse("pdf-text", {
      prompt: `Extract diet/nutrition data from this text:\n\n${extractedText}\n\n${prompt}`,
      responseFormat: "json",
      temperature: 0.2,
    });
    
    return { fileHash, isSearchable, text: extractedText, aiResponse };
  } else {
    // Render first page to image for multimodal
    const { default: pdf2pic } = await import("pdf2pic");
    const converter = pdf2pic.fromBuffer(fileBuffer, {
      density: 300, format: "png", width: 2048, height: 2048,
    });
    const firstPage = await converter(1);
    
    const aiResponse = await generateAIResponse("pdf-vision", {
      prompt: `Extract diet/nutrition data from this scanned document image:\n\n${prompt}`,
      responseFormat: "json",
      temperature: 0.2,
      image: { data: firstPage.base64, mimeType: "image/png" },
    }, { multimodal: true });
    
    return { fileHash, isSearchable: false, text: null, aiResponse };
  }
}
```

### Upload Endpoint Flow (with Hash Check)

```ts
// POST /api/upload
app.post("/api/upload", async (req, res) => {
  const { fileName, fileData, lang, force } = req.body;
  const fileBuffer = Buffer.from(fileData, "base64");
  const fileHash = computeFileHash(fileBuffer);
  
  // 1. Hash check — skip AI if already processed
  if (!force) {
    const existing = findPlanByHash(fileHash);
    if (existing) {
      return res.json({
        duplicateDetected: true,
        existingPlan: { id: existing.id, fileName: existing.file_name, isActive: existing.is_active }
      });
    }
  }
  
  // 2. Save file, process with AI, store result
  // ...
});

// POST /api/reprocess — always re-runs AI (force=true equivalent)
app.post("/api/reprocess", async (req, res) => {
  const active = getPlan();
  const filePath = path.resolve("data", "uploads", active.metadata.savedFileName);
  
  // Reprocess always runs AI (no hash check)
  const result = await processPDF(filePath, getOptimizedPrompt(lang));
  
  // Update DB with new hash and result
  savePlan(result.aiResponse, metadata, savedFileName, result.fileHash);
});
```

> **Key:** Upload checks hash first (cheap). Reprocess always re-runs AI (user explicitly asked).

### Recipe Processing Flows (Separate from PDF)

> **Decision:** Recipe sources use separate flows. PDF goes through `pdf-processor.ts`. Image/text/mejora go through `recipe-processor.ts`.

```ts
// server/ai/recipe-processor.ts
// Routes: /api/recipes/process-ai (4 source types)
// All calls go through generateAIResponse("recipe-ai", ...) — the alias maps
// to MODEL_RECIPE_AI. Gateway mode routes it to OmniRoute; Direct BYOK mode
// selects multimodal-capable providers only when an image is attached.

// 1. IMAGE — recipe-ai alias, multimodal (image-aware combo)
async function processImage(buffer: Buffer, lang: string): Promise<any> {
  const base64 = buffer.toString("base64");
  const prompt = await getPrompt("recipe-ai", lang);
  return generateAIResponse("recipe-ai", {
    prompt,
    responseFormat: "json",
    image: { data: base64, mimeType: "image/jpeg" },
  }, { multimodal: true });
}

// 2. TEXT — recipe-ai alias, text-only
async function processText(text: string, lang: string): Promise<any> {
  const prompt = await getPrompt("recipe-ai", lang);
  return generateAIResponse("recipe-ai", {
    prompt: `${prompt}\n\nRecipe text:\n${text}`,
    responseFormat: "json",
  });
}

// 3. PDF — delegate to pdf-processor.ts (same as diet extraction)
async function processRecipePDF(buffer: Buffer, lang: string): Promise<any> {
  // Import from pdf-processor.ts (NOT this file — avoid infinite recursion)
  const { processPDF } = await import("./pdf-processor.js");
  const prompt = await getPrompt("recipe-ai", lang);
  return processPDF(buffer, prompt);
}

// 4. MEJORA (improve) — send existing recipe JSON back to AI
async function processImprove(recipeData: any, lang: string): Promise<any> {
  const prompt = await getPrompt("recipe-ai", lang);
  return generateAIResponse("recipe-ai", {
    prompt: `${prompt}\n\nImprove this recipe:\n${JSON.stringify(recipeData)}`,
    responseFormat: "json",
  });
}
```

---

## 🥗 4.5 Nutritional Info per Recipe (Optional Field)

> **Goal:** Every recipe can carry a per-serving macro breakdown. If absent, the UI shows a placeholder — never a fake zero.

### Data Model (added to recipe JSON + DB)

```ts
// src/types.ts — Recipe interface addition
export interface RecipeNutrition {
  calories: number;   // kcal per serving
  protein: number;    // grams per serving
  carbs: number;      // grams per serving
  fat: number;        // grams per serving
}

export interface Recipe {
  // ...existing fields...
  nutrition?: RecipeNutrition; // optional — may be absent
}
```

### DB Column (recipes table)

```sql
-- SQLite / PostgreSQL
nutrition TEXT NULL DEFAULT NULL   -- JSON: {"calories":350,"protein":25,"carbs":40,"fat":12}
```

> **Why NULL not 0?** `0` is a valid value (fat-free recipe). Absent ≠ zero. UI distinguishes "not provided" from "0g".

### Prompt Update (recipe-ai)

The `recipe-ai` prompt (EN + ES) now instructs the model to emit an optional `nutrition` object per recipe:

```json
"nutrition": {
  "calories": 350,
  "protein": 25,
  "carbs": 40,
  "fat": 12
}
```

**Prompt rules:**
- Estimate macros **per serving** from ingredients/quantities when possible
- If source lacks nutritional data AND it cannot be reliably estimated → **omit** the `nutrition` field entirely (never invent)
- Top-level `calories` stays; `nutrition` adds the macro breakdown

### Display Rules (RecipeDetail)

```tsx
// src/components/RecipeDetail.tsx — nutrition card
{recipe.nutrition ? (
  <div className="nutrition-card">
    <p>{t("recipedetail.nutrition_per_serving")}</p>
    <div className="grid grid-cols-2 gap-2">
      <Macro label="Calories" value={`${recipe.nutrition.calories} kcal`} />
      <Macro label="Protein" value={`${recipe.nutrition.protein} g`} />
      <Macro label="Carbs" value={`${recipe.nutrition.carbs} g`} />
      <Macro label="Fat" value={`${recipe.nutrition.fat} g`} />
    </div>
  </div>
) : (
  <div className="nutrition-placeholder">
    {t("recipedetail.nutrition_not_available")}
  </div>
)}
```

### Placeholder Text (i18n)

```
en: "This plan does not include nutritional information."
es: "Este plan no incluye información nutricional."
```

### Behavior Matrix

| Source | nutrition present? | UI shows |
|---|---|---|
| AI-generated recipe with ingredients/amounts | Usually yes (estimated) | Macro card |
| Manual recipe, no data entered | No | Placeholder |
| Old plans / PDF without data | No | Placeholder |
| Mejora flow re-generates | Depends on output | Card or placeholder |

### Validation

- Zod: `nutrition` object optional, fields must be non-negative numbers
- Reject `{protein: -5}` or `{carbs: "high"}` → discard invalid `nutrition`, keep recipe
- If `nutrition.calories` present but top-level `calories` missing → backfill top-level from nutrition

---

## 🗄️ 5. Database Design

**SQLite** for OSS (self-hosted), **PostgreSQL** for SaaS (managed).

```sql
-- ============================================================
-- OSS MODE (SQLite) — simple, single-user, no auth
-- ============================================================

-- Processed Diets Table (Cache by Hash)
CREATE TABLE diets (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    file_hash TEXT UNIQUE NOT NULL,        -- SHA-256 of PDF
    diet_data TEXT NOT NULL,               -- JSON extracted by AI (TEXT in SQLite)
    created_at TEXT DEFAULT (datetime('now'))
);

-- Chat Conversations Table (Optional)
CREATE TABLE chat_messages (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    diet_id TEXT REFERENCES diets(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_diets_hash ON diets(file_hash);

-- ============================================================
-- SaaS MODE (PostgreSQL) — multi-tenant, auth, billing
-- ============================================================

-- Users Table (email/password + OAuth)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),              -- NULL if OAuth-only user
    name VARCHAR(255),
    avatar_url TEXT,
    provider VARCHAR(50) DEFAULT 'email',    -- 'email', 'google', 'github'
    provider_id VARCHAR(255),                -- OAuth provider's user ID
    -- Optional BYOK per user (AES-256 encrypted at rest)
    api_keys JSONB DEFAULT '{}',             -- {"groq": "enc:gsk_...", "openai": "enc:sk-..."}
    -- MFA (TOTP) — secret encrypted at rest, recovery codes hashed
    mfa_secret TEXT,                         -- AES-256-GCM encrypted base32 secret
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_verified_at TIMESTAMP,
    mfa_recovery_codes JSONB,                -- 10 hashed single-use codes
    token_version INTEGER DEFAULT 0,         -- bump to invalidate all sessions
    lang VARCHAR(5) DEFAULT 'en',            -- UI language preference (AppBar dropdown, §6.1)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Refresh tokens for session management
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,        -- SHA-256 of refresh token
    used BOOLEAN DEFAULT FALSE,              -- Token rotation: mark as used
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- Email verification tokens
CREATE TABLE email_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Password reset tokens
CREATE TABLE password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Login attempts (for account lockout)
CREATE TABLE login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    ip_address INET NOT NULL,
    success BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_login_attempts_email ON login_attempts(email, created_at);

-- Audit logs (security events)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,            -- 'login', 'logout', 'password_change', etc.
    ip_address INET NOT NULL,
    user_agent TEXT,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at);
CREATE INDEX idx_audit_logs_action ON audit_logs(action, created_at);

-- Processed Diets Table
CREATE TABLE diets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    file_hash VARCHAR(64) UNIQUE NOT NULL,
    diet_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat Conversations Table
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diet_id UUID REFERENCES diets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_diets_hash ON diets(file_hash);
CREATE INDEX idx_diets_user ON diets(user_id);
```

---

## 🔒 6. Open Source vs SaaS Separation

### The Chatwoot-Inspired Model

| Aspect | OSS (`MODE=oss`) | SaaS (`MODE=saas`) |
|---|---|---|
| **Auth** | No auth (single user) | Email/password + OAuth (Google, GitHub) |
| **API Keys** | User brings own keys (BYOK) | Platform keys default, optional BYOK per user |
| **Rate Limiting** | Global (IP-based) | Per-user (authenticated), tighter if using platform keys |
| **Database** | SQLite (simple) | PostgreSQL (multi-tenant) |
| **Landing Page** | None (direct access to app) | Full marketing landing (`domain.com`) + App (app.domain.com) + Login / Register / Forgot Password + Medical Disclaimer |
| **Updates** | Manual (git pull) | Automatic (managed) |
| **Support** | Community (GitHub Issues) | Direct (email/chat) |

### Medical Disclaimer (Required)

> **This tool does not replace a professional nutritionist.** It is a supplementary tool to help users organize and visualize their meal plans in real time. Always consult a qualified healthcare professional for medical nutrition advice.

**Placement:**
1. **Landing page:** Prominent banner below hero section
2. **Footer:** Persistent across all pages
3. **PDF output:** Included in generated diet summaries
4. **Chat:** System prompt includes disclaimer instruction
5. **Modal:** Shown on first use (acknowledgment required)

**Text (English):**
```
⚠️ Disclaimer: This application is a tool to help organize and visualize meal plans. 
It does not replace professional nutritional advice. Always consult a qualified 
nutritionist or healthcare provider for personalized dietary recommendations.
```

**Text (Spanish):**
```
⚠️ Aviso: Esta aplicación es una herramienta para ayudar a organizar y visualizar 
planes de alimentación. No reemplaza el asesoramiento nutricional profesional. 
Siempre consulte a un nutricionista o profesional de salud para recomendaciones 
dietéticas personalizadas.
```

### Code Organization

```
server/
├── config/
│   └── env.ts              # Zod validated — validates MODE and all vars
├── ai/                     # Core AI logic — ALWAYS present (Clean: domain layer)
│   ├── types.ts
│   ├── factory.ts
│   ├── pdf-processor.ts
│   └── providers/
├── saas/                   # SaaS-only features (removable for OSS)
│   ├── auth/
│   │   ├── jwt.ts
│   │   └── middleware.ts
│   └── routes.ts
├── middleware/
│   ├── auth.ts             # No-op if MODE=oss, JWT check if MODE=saas
│   └── rateLimit.ts        # Global if oss, per-user if saas
└── server.ts               # Conditionally loads saas/ routes
```

### Conditional Loading in `server.ts`

```ts
import { isSaaS } from "./config/env.js";

// Always load core routes
app.use("/api", coreRoutes);

// Conditionally load SaaS routes
if (isSaaS) {
  const { saasRoutes } = await import("./saas/routes.js");
  app.use("/api/auth", saasRoutes);
}
```

### 6.1 Runtime Localization (AppBar Language Dropdown)

> **Problem:** `VITE_LANGUAGE` is a build-time constant — baked into the bundle, requires rebuild to change, and identical for every user. SaaS users must pick their own language at runtime.

**Design — single runtime source of truth:**

```ts
// GET /api/config — public, no auth. Served to ALL modes.
app.get("/api/config", (req, res) => {
  res.json({
    mode: env.MODE,
    appUrl: env.APP_URL,
    availableLangs: env.AVAILABLE_LANGS.split(",").map(s => s.trim()),
    defaultLang: env.DEFAULT_LANG,
    chatEnabled: env.CHAT_ENABLED,
    useOmniRoute: env.USE_OMNIROUTE,
  });
});
```

**Frontend resolution order (highest wins):**

1. `users.lang` (SaaS, authenticated) — per-user DB column
2. `localStorage["lang"]` (OSS / anonymous)
3. `?lang=es` URL param (deep-link / shareable locale)
4. Server default from `/api/config` → `DEFAULT_LANG`
5. i18n `fallbackLng` (`en`)

```ts
// src/i18n/config.ts — replace getStoredLang() with async config fetch
export async function initI18n(): Promise<void> {
  const res = await fetch("/api/config");
  const config = await res.json().catch(() => null);
  const availableLangs = config?.availableLangs?.length ? config.availableLangs : SUPPORTED_LANGS;
  const urlLang = new URLSearchParams(window.location.search).get("lang");
  const storedLang = localStorage.getItem("lang");
  const lang = [urlLang, storedLang, config?.defaultLang, DEFAULT_LANG]
    .find(l => isValidLang(l));
  await i18n.changeLanguage(lang);
  window.__AVAILABLE_LANGS = availableLangs; // AppBar dropdown options
}
```

**AppBar dropdown** (desktop + mobile, next to the dark-mode toggle in `App.tsx`):

```
[ 🌐 EN ▾ ]
  ├── English (EN)
  └── Español (ES)
```

- Options = `window.__AVAILABLE_LANGS` from `/api/config` — adding a language = edit one env var, no rebuild
- On select: `i18n.changeLanguage(lang)` + persist:
  - SaaS: `PATCH /api/user/preferences { lang }` → `users.lang`
  - OSS: `localStorage.setItem("lang", lang)`
- Router already localizes paths (`navigateTo`/`getCanonicalPath`) — unchanged

**i18n resource loading:** keep both `en.json` + `es.json` statically imported (tiny, ~2 KB each). Dropdown only shows langs the server advertises, so future langs need new JSON files + env entry.

### 6.2 SaaS Landing Page + URL Separation (`domain.com` vs `app.domain.com`)

**Decision:** Two public entry points, separated by subdomain. Landing is a standalone static build; the app is the existing SPA.

| | `domain.com` (landing) | `app.domain.com` (app) |
|---|---|---|
| **Content** | Marketing: hero, features, how-it-works, screenshots, pricing, FAQ, medical disclaimer, footer | Existing SPA (login → dashboard/calendar/recipes/chat) |
| **Auth** | None — public, indexable (SEO) | Login-gated, `noindex` |
| **Build** | `landing/` (static React/Vite or plain HTML) | Existing `src/` (React/Vite) |
| **i18n** | Same dropdown, same JSON files | Same as §6.1 |

**Routing — reverse proxy by `Host` header (nginx example):**

```nginx
server {
    listen 80;
    server_name domain.com www.domain.com;
    root /srv/vitalitynutri/landing;            # static landing build
    location / { try_files $uri /index.html; }   # SPA fallback
}

server {
    listen 80;
    server_name app.domain.com;
    # App + API behind the same subdomain → no CORS needed
    location /api/   { proxy_pass http://vitalitynutri:5027; }
    location /       { proxy_pass http://vitalitynutri:5027; }  # app SPA
}
```

**TLS:** one wildcard cert `*.domain.com` (Let's Encrypt `--certbot certonly --manual --preferred-challenges dns` or DNS-01 via Caddy/Traefik). Both subdomains covered by one cert.

**Auth across subdomains:** not needed. Landing is public; its CTA buttons link to `app.domain.com/login`, `app.domain.com/register`. The app never reads cookies from `domain.com`. No `Domain=` cookie scoping = no cross-subdomain cookie exposure (stronger security posture, zero config).

**Deployment topology (SaaS):**

```
                        ┌──────────────────────────┐
 Internet ──→ 443 ──→   │  Reverse proxy (nginx)   │
                        │  cert: *.domain.com      │
                        └──┬──────────────┬────────┘
                    Host:  │              │ Host:
                 domain.com│              │ app.domain.com
                           ▼              ▼
                ┌─────────────┐   ┌───────────────────┐
                │  landing    │   │  vitalitynutri    │
                │  (static)   │   │  (app + /api)     │
                └─────────────┘   └─────────┬─────────┘
                                            ▼
                                        PostgreSQL
```

**Complexity assessment:**

| Work item | Effort | Notes |
|---|---|---|
| Extract landing build | Low-Med | New `landing/` dir in same repo, own `index.html` + entry. Reuses i18n JSON + theme CSS |
| Reverse proxy config | Low | One nginx/traefik/caddy config block per host (2 blocks) |
| Wildcard SSL | Low (ops) | DNS-01 challenge; one-time + auto-renew |
| Landing → app links | Trivial | Absolute links `https://app.domain.com/login` |
| Docker | Low | Add `landing` nginx container to compose; proxy container on top |
| **Total** | **~2-3 days** | No backend changes; app unchanged; auth untouched |

> **Simpler alternative (skip subdomains):** single SPA, route-based — `domain.com/` = landing, `domain.com/app/*` = app. Zero infra change, but landing shares the login-gated bundle and app paths gain a prefix. Subdomain split recommended for SaaS marketing/SEO; route split fine for OSS.

### Why No License Key

The SaaS value is operational, not code-based:

| If OSS user sets `MODE=saas` | What happens |
|---|---|
| No `JWT_SECRET` | Zod crash on startup |
| No auth provider configured | Auth routes return 401 |
| They configure everything themselves | That's fine — they're doing your job |

**You're selling:** managed hosting, pre-configured AI keys, auth/billing infrastructure, support. Not code.

---

## 💬 7. Chat Module (Optional)

> **Conditional:** Works with SQLite (OSS) and PostgreSQL (SaaS). Uses the same `diets` and `chat_messages` tables.

### Token Cost Analysis (why limits exist)

The naive approach embeds the **full diet JSON** in the system prompt on every message:

- Diet JSON (7 days × 4 meals × ~28 recipes) ≈ **5,500-10,500 tokens** of context
- Plus 6-message history + user message ≈ **10-15K input tokens per message**

| Model | Per message | 20-msg session | 100 users × 20 msgs/day |
|---|---|---|---|
| Llama-3.3-70b (default chain) | ~$0.009 | ~$0.18 | ~$180/day |
| Llama-3.1-8b-instant (chat-dedicated) | ~$0.0008 | ~$0.016 | ~$1.60/day |

**Decision: KEEP chat, but constrain it** — it's ~2-3× the token cost of one PDF processing *per message*. Four levers bring cost to near-zero.

### Chat Cost Controls (Env Config)

```env
# .env — chat limits (all configurable)
CHAT_ENABLED=true                 # Feature flag to disable chat entirely
CHAT_MAX_MESSAGES=20              # Max messages per conversation (sliding count)
CHAT_MAX_USER_CHARS=500           # Max chars per user message (truncated/rejected)
CHAT_MAX_CONTEXT_TOKENS=4000      # Diet context budget (below)
CHAT_MODEL=llama-3.1-8b-instant   # Dedicated cheap model, NOT the 70b chain
```

### 1. Diet Context Summary (instead of full JSON)

The #1 cost driver is re-sending full recipe JSON. Instead, extract a compact summary — meals, calories, and macro targets — and send only that.

```ts
// server/ai/chat-context.ts
// DRY: single function builds the diet summary for chat
export function buildDietContext(dietData: any): string {
  // Extract ONLY: day, meal type, recipe name, calories, servings
  // Output ~400-800 chars (~100-200 tokens) vs full JSON (5-10K tokens)
  const summary: string[] = ["Meal plan summary (days/meals/calories):"];
  for (const day of Object.keys(dietData.days || {})) {
    for (const meal of Object.keys(dietData.days[day] || {})) {
      const recipe = dietData.days[day][meal];
      if (recipe) {
        summary.push(`${day}/${meal}: ${recipe.recipeName} (~${recipe.calories ?? "?"} kcal)`);
      }
    }
  }
  return summary.join("\n");
}
```

### 2. Message Limits (server-enforced, not client)

```ts
// POST /api/chat
app.post("/api/chat", async (req, res) => {
  const { dietId, userMessage } = req.body;

  // --- Enforce limits BEFORE any AI call (cheap, no tokens spent) ---
  if (!env.CHAT_ENABLED) return res.status(403).json({ error: "Chat disabled" });

  if (typeof userMessage !== "string" || userMessage.trim().length === 0) {
    return res.status(400).json({ error: "Message required" });
  }
  if (userMessage.length > env.CHAT_MAX_USER_CHARS) {
    return res.status(400).json({ error: `Message too long (max ${env.CHAT_MAX_USER_CHARS} chars)` });
  }

  const count = await db.query(
    "SELECT COUNT(*) as count FROM chat_messages WHERE diet_id = ?",
    [dietId]
  );
  if (count.count >= env.CHAT_MAX_MESSAGES * 2) { // user + assistant rows
    return res.status(429).json({ error: "Conversation limit reached" });
  }

  // 1. Load saved diet JSON
  const diet = await db.query("SELECT diet_data FROM diets WHERE id = ?", [dietId]);

  // 2. Compact system prompt (cost control — summary, not full JSON)
  const systemPrompt = `You are an assistant nutritionist. Answer questions regarding the following user diet plan:
${buildDietContext(diet.diet_data)}

Rules:
- Be concise and answer strictly about this meal plan.
- If food substitutions are requested, suggest alternatives with similar macronutrients.
- Do not invent nutritional data not present in the summary. If asked, say it's not in the plan.

Medical disclaimer: This tool does not replace professional nutritional advice.`;

  // 3. History: last 6 messages (sliding window)
  const history = await db.query(
    "SELECT role, content FROM chat_messages WHERE diet_id = ? ORDER BY created_at DESC LIMIT 6",
    [dietId]
  );

  // 4. Use the "chat" alias through the single AI entry point.
  //    Gateway mode → MODEL_CHAT (nutri-chat) combo.
  //    Direct mode  → env.CHAT_MODEL pinned (llama-3.1-8b-instant), cheap.
  const response = await generateAIResponse("chat", {
    systemPrompt,
    prompt: userMessage,
    responseFormat: "text",
    maxTokens: 300, // short answers
  });

  // 5. Save both user + assistant messages
  await db.query(
    "INSERT INTO chat_messages (diet_id, role, content) VALUES (?, 'user', ?), (?, 'assistant', ?)",
    [dietId, userMessage, dietId, response.text]
  );

  res.json({ reply: response.text });
});
```

### Why These Limits

| Leak | Limit | Effect |
|---|---|---|
| Full diet JSON per message | Diet summary (~100-200 tokens) | ~50-100× fewer input tokens |
| 70b model per message | Chat-dedicated 8b model | ~11× cheaper per token |
| Unbounded conversation | 20 msg cap + 500 char cap | Bounded max cost/user/session |
| Hidden cost spikes | `CHAT_MAX_CONTEXT_TOKENS` budget check | Fails fast before AI call |

### Frontend Notes

- Character counter on input (500 char limit)
- Disabled input + "Limit reached" message at 20 messages
- Chat hidden entirely when `CHAT_ENABLED=false` (feature flag)
- Conversation history persisted per diet (switching diets = separate thread)

---

## 🐳 8. Docker Compose

### OSS Version

```yaml
version: '3.8'

services:
  vitalitynutri:
    image: ${IMAGE_NAME:-ghcr.io/eljorgit/vitalitynutri:latest}
    container_name: vitalitynutri
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "5027:5027"
    environment:
      - MODE=oss
      - NODE_ENV=production
      - PORT=5027
      - APP_URL=${APP_URL:-}
      - SITE_VISIBILITY=${SITE_VISIBILITY:-}
      - AVAILABLE_LANGS=${AVAILABLE_LANGS:-en,es}
      - DEFAULT_LANG=${DEFAULT_LANG:-en}
      - AI_PROVIDERS=${AI_PROVIDERS:-groq,gemini}
      - AI_MODELS=${AI_MODELS:-}
      - GROQ_API_KEY=${GROQ_API_KEY:-}
      - GEMINI_API_KEY=${GEMINI_API_KEY:-}
      - UNSPLASH_ACCESS_KEY=${UNSPLASH_ACCESS_KEY:-}
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

### SaaS Version

```yaml
version: '3.8'

services:
  vitalitynutri:
    image: ${IMAGE_NAME:-ghcr.io/eljorgit/vitalitynutri:latest}
    container_name: vitalitynutri-saas
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "5027:5027"
    environment:
      - MODE=saas
      - NODE_ENV=production
      - PORT=5027
      - APP_URL=${APP_URL}
      - DATABASE_URL=${DATABASE_URL}
      - AVAILABLE_LANGS=${AVAILABLE_LANGS:-en,es}
      - DEFAULT_LANG=${DEFAULT_LANG:-en}
      - AI_PROVIDERS=${AI_PROVIDERS:-groq,gemini}
      - AI_MODELS=${AI_MODELS:-}
      - GROQ_API_KEY=${GROQ_API_KEY:-}
      - GEMINI_API_KEY=${GEMINI_API_KEY:-}
      - JWT_SECRET=${JWT_SECRET}
    volumes:
      - ./data:/app/data
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: vitalitynutri
      POSTGRES_USER: ${DB_USER:-vitalitynutri}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  pgdata:
```

---

## 🏥 9. Health Checks & Operations

### Health Endpoints

```ts
// server/middleware/health.ts
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    version: process.env.npm_package_version,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get("/health/ready", async (req, res) => {
  const checks = {
    database: await checkDatabase(),
    ai_providers: await checkAIProviders(),
    memory: checkMemory(),
  };
  
  const healthy = Object.values(checks).every(c => c.status === "ok");
  res.status(healthy ? 200 : 503).json({ status: healthy ? "ok" : "degraded", checks });
});

async function checkDatabase(): Promise<{ status: string; latency?: number }> {
  try {
    const start = Date.now();
    await db.query("SELECT 1");
    return { status: "ok", latency: Date.now() - start };
  } catch {
    return { status: "error" };
  }
}

async function checkAIProviders(): Promise<{ status: string; providers: string[] }> {
  const available = getAvailableProviders();
  return { status: available.length > 0 ? "ok" : "error", providers: available };
}

function checkMemory(): { status: string; used: number; total: number } {
  const used = process.memoryUsage().heapUsed / 1024 / 1024;
  const total = 1024; // 1GB VPS
  return {
    status: used < total * 0.8 ? "ok" : "warning",
    used: Math.round(used),
    total,
  };
}
```

### Graceful Shutdown

```ts
// server/shutdown.ts
import { Server } from "http";
import { logger } from "./logger.js";

export function setupGracefulShutdown(server: Server, db: any) {
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received. Starting graceful shutdown...`);
    
    // Stop accepting new connections
    server.close(async () => {
      logger.info("HTTP server closed");
      
      // Close database connections
      await db.end();
      logger.info("Database connections closed");
      
      // Flush logs
      logger.info("Graceful shutdown complete");
      process.exit(0);
    });
    
    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 30000);
  };
  
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
```

### Structured Logging

```ts
// server/logger.ts
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      latency: Date.now() - start,
      ip: req.ip,
    });
  });
  next();
});
```

### Database Migrations (Drizzle ORM)

```ts
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./server/db/schema.ts",
  out: "./server/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
});
```

```ts
// package.json scripts
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

### Backup Strategy (SaaS)

```bash
# Automated daily backups (cron)
0 2 * * * pg_dump -U vitalitynutri vitalitynutri | gzip > /backups/vitalitynutri_$(date +\%Y\%m\%d).sql.gz

# Retain 30 days
find /backups -name "*.sql.gz" -mtime +30 -delete
```

### Monitoring & Error Tracking

```ts
// server/middleware/errorHandler.ts
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  logger.error({ err, req }, "Unhandled error");
  
  // Don't leak error details in production
  const message = process.env.NODE_ENV === "production" 
    ? "Internal server error" 
    : err.message;
  
  res.status(err.status || 500).json({ error: message });
}

// Optional: Sentry for error tracking (SaaS)
// import * as Sentry from "@sentry/node";
// Sentry.init({ dsn: env.SENTRY_DSN });
```

---

## 📖 10. API Documentation (OpenAPI/Swagger)

### Auto-generated from Zod Schemas

```ts
// server/api/openapi.ts
import { z } from "zod";
import { extendZodWithOpenApi, createDocument } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const openApiDocument = createDocument({
  openapi: "3.1.0",
  info: {
    title: "VitalityNutri API",
    version: "1.0.0",
    description: "AI-powered meal planning API",
  },
  servers: [
    { url: "http://localhost:5027", description: "OSS Local" },
    { url: "https://api.vitalitynutri.com", description: "SaaS Production" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
});

// Swagger UI endpoint
app.get("/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
```

### Endpoint Documentation

```ts
// Example: Document upload endpoint
const UploadSchema = z.object({
  type: z.enum(["diet", "recipe", "recipe-improve"]).openapi({ example: "diet" }),
  lang: z.enum(["en", "es"]).openapi({ example: "en" }),
  force: z.boolean().optional().openapi({ example: false }),
});

app.post("/api/upload", async (req, res) => {
  // Implementation
});
```

### CLI Documentation

```bash
# Generate docs from code
npm run docs:generate

# Validate OpenAPI spec
npm run docs:validate
```

---

## ⚡ 11. Performance Optimizations

### Response Compression

```ts
// server/middleware/compression.ts
import compression from "compression";

app.use(compression({
  level: 6, // Balance between speed and compression
  threshold: 1024, // Only compress responses >1KB
  filter: (req, res) => {
    if (req.headers["x-no-compression"]) return false;
    return compression.filter(req, res);
  },
}));
```

### Static Asset Caching

```ts
// server/middleware/cache.ts
app.use(express.static("dist", {
  maxAge: "1y", // Cache static assets for 1 year
  immutable: true,
  etag: true,
}));

// API response caching (for non-AI endpoints)
app.use("/api/cache", cacheMiddleware({
  ttl: 5 * 60 * 1000, // 5 minutes
  key: (req) => `${req.user?.id}-${req.url}`,
}));
```

### Database Connection Pooling

```ts
// server/db/pool.ts (PostgreSQL)
import { Pool } from "pg";

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20, // Max connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// SQLite: Already uses WAL mode + connection pooling via better-sqlite3
```

### AI Response Streaming

```ts
// Optional: Stream responses for better UX
app.post("/api/stream-upload", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  
  // Stream progress updates
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(`data: ${JSON.stringify({ status: "processing" })}\n\n`);
      // ... process
      controller.enqueue(`data: ${JSON.stringify({ status: "complete", result })}\n\n`);
      controller.close();
    },
  });
  
  stream.pipe(res);
});
```

### Memory Management

```ts
// server/middleware/memory.ts
const MAX_HEAP = 800 * 1024 * 1024; // 800MB (leave 200MB buffer on 1GB VPS)

app.use((req, res, next) => {
  const used = process.memoryUsage().heapUsed;
  if (used > MAX_HEAP) {
    logger.warn({ heapUsed: used / 1024 / 1024 }, "High memory usage");
    // Optionally trigger garbage collection
    if (global.gc) global.gc();
  }
  next();
});
```

### Request Deduplication

```ts
// Prevent duplicate AI processing for same upload
const processingJobs = new Map<string, Promise<any>>();

app.post("/api/upload", async (req, res) => {
  const hash = await computeHash(req.file.buffer);
  
  // If already processing, wait for existing job
  if (processingJobs.has(hash)) {
    const result = await processingJobs.get(hash);
    return res.json(result);
  }
  
  // Start new job
  const job = processUpload(req.file.buffer, hash);
  processingJobs.set(hash, job);
  
  try {
    const result = await job;
    res.json(result);
  } finally {
    processingJobs.delete(hash);
  }
});
```

---

### Step 1: Add Zod, Create `env.ts`
- Install `zod`
- Create `server/config/env.ts` with schema
- Replace all `process.env.*` reads with `env.*`
- Add to `package.json` scripts: `"validate-env": "tsx server/config/validate.ts"`

### Step 2: Create `AIClient` Interface
- Create `server/ai/types.ts`
- Extract `generateContentWithRetry` logic into interface
- Create `server/ai/fallback.ts` with generic retry + provider iteration

### Step 3: Move Gemini to `providers/gemini.ts`
- Adapt existing `generateContentWithRetry` code
- Implement `AIClient` interface
- Keep existing fallback models as Gemini-specific chain

### Step 4: Add Groq Provider
- Install `openai` SDK (Groq uses OpenAI-compatible API)
- Implement `GroqClient` with text-only support
- Configure text models: Llama 3.3 → Qwen 3.6 → Llama 8B

### Step 5: Build `pdf-processor.ts`
- Implement auto-detect (text extraction threshold)
- Route selectable PDFs → text chain (Groq first)
- Route non-selectable PDFs → multimodal chain (Gemini only)

### Step 6: Wire Factory + Fallback
- Replace all call sites in `server.ts` with `generateAIResponse(alias, req)` (single entry point; dual-mode internal routing)
- Remove `generateContentWithRetry`, `isRetryableGeminiError`, `isUnsupportedModelError`
- Update `friendlyGeminiError` → `friendlyAIError` (provider-agnostic)

### Step 7: Add SaaS Infrastructure
- Create `server/saas/` directory
- Add JWT auth middleware (access + refresh tokens)
- Add `MODE` conditional loading in `server.ts`
- Billing: stub only (no-op functions) — implement when first paying user arrives

### Step 8: Auth System (SaaS)
**Email/Password + OAuth (Google, GitHub). Full flow.**

```
server/saas/auth/
├── jwt.ts              # Sign/verify access + refresh tokens
├── middleware.ts        # Auth middleware (extracts user from token)
├── password.ts         # Hash (bcrypt) + verify passwords
├── oauth.ts            # OAuth provider callbacks (Google, GitHub)
├── routes.ts           # Auth endpoints (see below)
└── byok.ts             # BYOK: check user api_keys, fallback to platform
```

**Auth Endpoints:**
| Endpoint | Method | Description |
|---|---|---|
| `/api/auth/register` | POST | Create account (email + password) |
| `/api/auth/login` | POST | Login (email + password), returns JWT pair |
| `/api/auth/logout` | POST | Revoke refresh token |
| `/api/auth/refresh` | POST | Exchange refresh token for new access token |
| `/api/auth/forgot-password` | POST | Send password reset email (token via email) |
| `/api/auth/reset-password` | POST | Set new password with reset token |
| `/api/auth/profile` | GET | Get current user profile |
| `/api/auth/profile` | PATCH | Update name, avatar |
| `/api/auth/preferences` | PATCH | Update UI preferences (e.g. `lang`) → `users.lang` |
| `/api/auth/api-keys` | GET | Get user's BYOK keys (masked) |
| `/api/auth/api-keys` | PUT | Set/update BYOK keys (AES-256 encrypted) |
| `/api/auth/api-keys` | DELETE | Remove BYOK key |
| `/api/auth/oauth/:provider` | GET | Redirect to OAuth provider (Google, GitHub) |
| `/api/auth/oauth/:provider/callback` | GET | Handle OAuth callback, create/link account |

**BYOK Flow (Optional per User):**
```
1. User sets API keys in Profile → Settings → API Keys
2. Keys encrypted with AES-256 before DB storage
3. On AI request: check user.api_keys[provider]
   ├── Has key? → Decrypt + use user's key (user gets their rate limits)
   └── No key? → Use platform key (platform's rate limits apply)
4. Rate limits: tighter for platform keys (protect your quota), standard for BYOK
```

**OAuth Flow:**
```
1. User clicks "Sign in with Google"
2. Redirect to Google → callback with auth code
3. Exchange code for tokens → fetch user profile
4. Find or create user (link by email or provider_id)
5. Issue JWT pair → redirect to app with tokens
```

**Dependencies (SaaS auth):**
```json
{
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2"
  }
}
```

### MFA: TOTP (Authenticator Apps — Authy, Google Authenticator)

> **Decision:** TOTP via `otplib` (v13, actively maintained, TS-first, audited crypto). **NOT SMS** (SIM-swap risk, costs money) and **not** speakeasy (unmaintained since ~2021). Passkeys/WebAuthn are future work — TOTP is the free, offline, universally compatible default.

#### MFA Env Config

```env
MFA_REQUIRED=false                # Force MFA for all SaaS users
MFA_ISSUER=VitalityNutri          # Shown in authenticator app
MFA_WINDOW=1                      # TOTP clock-drift tolerance (steps ±30s)
MFA_MAX_ATTEMPTS=5                # Failed code attempts before lockout
MFA_ATTEMPT_WINDOW=15m            # Lockout window after max attempts
MFA_TOKEN_TTL=5m                  # Temporary MFA challenge token expiry
```

#### DB Schema (users table additions)

```sql
ALTER TABLE users ADD COLUMN mfa_secret TEXT;          -- encrypted at rest (AES-256-GCM)
ALTER TABLE users ADD COLUMN mfa_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN mfa_verified_at TIMESTAMP;
ALTER TABLE users ADD COLUMN mfa_recovery_codes JSONB; -- 10 hashed single-use codes

-- Attempt tracking (reuse login_attempts with action column)
-- audit_logs records: mfa_setup, mfa_login_success, mfa_login_failed, mfa_disabled
```

> **Security:** `mfa_secret` and `mfa_recovery_codes` encrypted at rest using the same AES-256-GCM infra as BYOK keys. Recovery codes stored **hashed** (bcrypt or SHA-256), never plaintext.

#### Dependencies

```json
{
  "dependencies": {
    "otplib": "^13.4.1",
    "qrcode": "^1.5.4"
  }
}
```

#### MFA Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/auth/mfa/setup` | POST | Generate secret + return otpauth:// URI + QR data URL |
| `/api/auth/mfa/enable` | POST | Verify first code, enable MFA, return 10 recovery codes |
| `/api/auth/mfa/disable` | POST | Re-auth required; disable MFA |
| `/api/auth/mfa/recovery` | POST | Exchange a recovery code for login (single-use) |
| `/api/auth/mfa/verify` | POST | Login step 2: verify TOTP code from challenge token |

#### Setup Flow (Profile → Security → Enable 2FA)

```ts
// server/saas/auth/mfa.ts
import { authenticator } from "otplib";
import QRCode from "qrcode";

const otp = authenticator;
otp.options = { window: env.MFA_WINDOW, step: 30 };

// 1. Generate secret (returns base32)
export async function setupMFA(user: User): Promise<{ secret: string; otpauthUrl: string; qrDataUrl: string }> {
  const secret = authenticator.generateSecret();
  
  // Encrypt before persisting — store pending (mfa_enabled=false)
  await saveEncrypted(user.id, "mfa_secret", secret);
  
  const otpauthUrl = authenticator.keyuri(user.email, env.MFA_ISSUER, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
  
  return { secret, otpauthUrl, qrDataUrl }; // secret shown once for manual entry
}

// 2. Enable — verify first code, then activate
export async function enableMFA(user: User, code: string): Promise<string[]> {
  const secret = await getDecrypted(user.id, "mfa_secret");
  
  if (!authenticator.verify({ token: code, secret })) {
    throw new MFAAttemptError("Invalid code");
  }
  
  // Generate 10 recovery codes (hashed for storage)
  const recoveryCodes = Array.from({ length: 10 }, () =>
    crypto.randomBytes(8).toString("hex").toUpperCase()
  );
  const hashed = recoveryCodes.map((c) => hash(c)); // SHA-256 + salt
  
  await db.query(
    "UPDATE users SET mfa_enabled = TRUE, mfa_verified_at = NOW(), mfa_recovery_codes = ? WHERE id = ?",
    [JSON.stringify(hashed), user.id]
  );
  
  return recoveryCodes; // shown ONCE — user must save them
}
```

#### Login Flow (2-Step Challenge)

```ts
// POST /api/auth/login
const user = await findUserByEmail(email);
const ok = await verifyPassword(user, password);
if (!ok) return res.status(401).json({ error: "Invalid credentials" });

if (user.mfa_enabled) {
  // Step 1: credentials OK → issue SHORT-LIVED challenge token (NOT session token)
  const challengeToken = jwt.sign(
    { sub: user.id, purpose: "mfa", ver: user.tokenVersion },
    env.JWT_SECRET,
    { expiresIn: env.MFA_TOKEN_TTL }
  );
  // Store hash of issued challenge to prevent replay
  await storeChallenge(challengeToken);
  return res.json({ mfaRequired: true, challengeToken });
}

// No MFA → normal JWT pair
return issueSessionTokens(user);
```

```ts
// POST /api/auth/mfa/verify
const { challengeToken, code } = req.body;

// Replay protection: challenge must be unused + not expired
if (!(await isChallengeValid(challengeToken))) {
  return res.status(401).json({ error: "Challenge expired or already used" });
}

// Rate limit attempts (MFA_MAX_ATTEMPTS / MFA_ATTEMPT_WINDOW)
await assertMFAAttemptsWithinLimit(user.id);

const secret = await getDecrypted(user.id, "mfa_secret");
if (!authenticator.verify({ token: code, secret })) {
  await logAudit(user.id, "mfa_login_failed", req);
  await recordMFAAttempt(user.id);
  return res.status(401).json({ error: "Invalid code" });
}

await markChallengeUsed(challengeToken);   // single-use
await logAudit(user.id, "mfa_login_success", req);
return issueSessionTokens(user);           // now full JWT pair
```

#### Recovery Code Login (lost phone)

```ts
// POST /api/auth/mfa/recovery
const { email, password, recoveryCode } = req.body;
// 1. Verify credentials (like step 1 of login)
// 2. Hash incoming code, compare against stored hashes
// 3. If match → mark that code as used (remove from array)
// 4. Optionally force MFA re-enrollment (best practice: invalidate secret)
// 5. Issue session tokens + audit log
```

#### Security Notes

| Concern | Mitigation |
|---|---|
| Secret leak (DB breach) | AES-256-GCM encryption at rest |
| Replay attack | Challenge token single-use + short TTL (5m) |
| Brute force 6-digit code | Rate limit 5 attempts/15min + audit log failures |
| Clock drift on device | `window: 1` tolerance (±60s) |
| Lost phone / no codes | Manual identity-verified recovery by support (no automated bypass) |
| Session theft after MFA enable | `token_version` increment → invalidates all existing sessions |
| Phishing | TOTP is relay-phishable; future work = WebAuthn/passkeys (origin-bound) |

**MFA + OAuth note:** OAuth (Google/GitHub) already provides strong auth via the provider. MFA is offered for **email/password** accounts. If a user has both (linked accounts), MFA applies to password login; OAuth login keeps provider-level 2FA.

---

## ⚠️ 12. Key Decisions & Trade-offs

| Decision | Choice | Principle | Rationale |
|---|---|---|---|
| **PDF detection** | Auto-detect (text extraction first) | KISS | No user friction, works for both types |
| **Config validation** | Zod (crash on startup) | Clean | Fail-fast, typed config at boundary |
| **Provider abstraction** | Interface + factory | Clean | Contract at boundary, implementations behind |
| **AI execution mode** | Dual-mode: `USE_OMNIROUTE` gateway (default) vs Direct BYOK | KISS | One codebase, zero-config gateway for SaaS/self-host; BYOK escape hatch for power users |
| **Retry/fallback** | Single `generateWithFallback()` + gateway no-local-retry | DRY | One retry path, no duplication |
| **OSS vs SaaS** | Same repo, `MODE` flag | KISS | No branch conflicts, clean separation |
| **SaaS gating** | No license key | KISS | Value is operational, not code |
| **DB for OSS** | SQLite | KISS | Zero config, single file, single user |
| **DB for SaaS** | PostgreSQL | Clean | Multi-tenant, JSONB, row-level security |
| **Billing** | None yet (YAGNI) | KISS | Implement when first paying user arrives |
| **Model config** | `AI_PROVIDERS` + `AI_MODELS` | KISS | Two env vars, no config files |
| **Hash check** | Upload checks, reprocess skips | KISS | Cheap cache hit vs explicit re-run |
| **Error messages** | Provider-agnostic i18n | DRY | Rename `error.gemini_*` → `error.ai_*` |
| **Default providers** | Groq + Gemini only | KISS | Both free forever, no trial expiration |
| **Prompts** | 1 file per type + lang suffix | DRY | No duplicated prompt files per language |
| **Prompt management** | Markdown files in git | KISS | No LangSmith, no external service |
| **Fresh DB** | New schema, no migration | KISS | Clean start, no legacy baggage |
| **Recipe flows** | Separate per source type | Clean | PDF/image/text/mejora each optimized |
| **Unsplash** | Keep | KISS | Users rely on it for recipe images |
| **Backup/export** | Keep | KISS | Portable JSON snapshot, users love it |
| **SaaS BYOK** | Optional per user | KISS | Saves platform costs, users get better limits |
| **Auth system** | Email/password + OAuth | Clean | No third-party dependency for core auth |
| **OAuth provider** | Google + GitHub (self-hosted) | KISS | Most common, no Clerk/Auth0 dependency |
| **BYOK encryption** | AES-256 at rest | Security | Keys encrypted in DB, decrypted on request |
| **Chat cost** | Keep, but constrained (summary context + dedicated cheap model + msg/char caps) | KISS | Full diet JSON per message = ~$0.18/session; summary + 8b = ~$0.016 |
| **Nutritional info** | Optional `nutrition` field + placeholder if absent | KISS | `NULL` ≠ `0`; never show fake zeroes; absent → "not available" |
| **MFA** | TOTP via otplib (app-based, no SMS) | Security | Actively maintained; SMS = SIM-swap risk; speakeasy unmaintained |
| **UI language** | Runtime selection (AppBar dropdown) via `AVAILABLE_LANGS` + `GET /api/config` | KISS | `VITE_LANGUAGE` is build-time and global; per-user runtime choice removes rebuilds |
| **SaaS URLs** | Landing `domain.com` + app `app.domain.com` (subdomain split) | Clean | Marketing/SEO isolated from login-gated app; no cross-subdomain cookies; ~2-3 days effort |

---

## 🧪 13. Testing Strategy

### Overview

| Type | Framework | What | When | Coverage |
|---|---|---|---|---|
| **Unit** | Vitest | Backend functions, utilities, providers | Every PR | ~80% |
| **Unit** | Vitest | React components, hooks, utils | Every PR | ~80% |
| **Integration** | Vitest | API endpoints, DB queries, AI factory | Every PR | ~80% |
| **E2E** | Playwright | Full user flows (upload → results → chat) | Every PR | Critical paths |
| **Eval** | Vitest + Gemini | Prompt quality scoring | Every commit | 100% of prompts |

### Test Structure

```
__tests__/
├── unit/
│   ├── server/
│   │   ├── config/
│   │   │   └── env.test.ts           # Zod schema validation
│   │   ├── ai/
│   │   │   ├── providers/
│   │   │   │   ├── groq.test.ts       # Groq client
│   │   │   │   ├── gemini.test.ts     # Gemini client
│   │   │   │   ├── openai.test.ts     # OpenAI client
│   │   │   │   └── anthropic.test.ts  # Anthropic client
│   │   │   ├── factory.test.ts        # createClient + generateWithFallback + generateAIResponse
│   │   │   └── pdf-processor.test.ts  # Hash, auto-detect, routing
│   │   └── utils/
│   │       └── helpers.test.ts
│   └── src/
│       ├── components/
│       │   ├── Dashboard.test.tsx
│       │   ├── PdfUpload.test.tsx
│       │   └── ChatWidget.test.tsx
│       └── hooks/
│           └── useAI.test.ts
├── integration/
│   ├── api/
│   │   ├── upload.test.ts             # POST /api/upload
│   │   ├── reprocess.test.ts          # POST /api/reprocess
│   │   ├── recipe-ai.test.ts          # POST /api/recipes/process-ai
│   │   ├── chat.test.ts               # POST /api/chat (incl. cost limits: char cap, msg cap)
│   │   ├── auth.test.ts               # POST /api/auth/*
│   │   ├── mfa.test.ts                # TOTP setup/enable/verify/recovery/disable
│   │   └── backup.test.ts             # GET/POST /api/backup/*
│   └── db/
│       ├── sqlite.test.ts             # SQLite queries (OSS)
│       └── postgres.test.ts           # PostgreSQL queries (SaaS)
├── e2e/
│   ├── upload-flow.spec.ts            # Upload PDF → view results
│   ├── recipe-flow.spec.ts            # Process recipe → save to book
│   ├── chat-flow.spec.ts              # Ask question → get answer
│   ├── auth-flow.spec.ts              # Register → login → logout
│   ├── mfa-flow.spec.ts               # Enable 2FA → login with code → recovery
│   └── batch-cooking.spec.ts          # Generate batch plan
└── prompts/                           # (already defined in eval section)
    ├── prompt.test.ts                 # L1: Static
    ├── eval.schema.test.ts            # L2: Schema
    ├── eval.regression.test.ts        # L3: Regression
    └── eval.quality.ts                # L4: Quality (manual)
```

### Unit Tests

#### Backend

```ts
// __tests__/unit/server/ai/factory.test.ts
import { describe, test, expect, vi } from "vitest";
import { createClient, generateWithFallback, generateAIResponse } from "../../../../server/ai/factory.js";

describe("createClient", () => {
  test("creates GroqClient for groq provider", () => {
    const client = createClient("groq");
    expect(client.name).toBe("groq");
    expect(client.supportsMultimodal).toBe(false);
  });

  test("creates GeminiClient for gemini provider", () => {
    const client = createClient("gemini");
    expect(client.name).toBe("gemini");
    expect(client.supportsMultimodal).toBe(true);
  });

  test("throws for unknown provider", () => {
    expect(() => createClient("unknown")).toThrow("Unknown provider");
  });
});

describe("generateWithFallback", () => {
  test("falls back to next provider on retryable error", async () => {
    // Mock first provider to fail, second to succeed
    // Verify fallback works
  });

  test("skips non-multimodal providers when image provided", async () => {
    // Verify Groq is skipped for multimodal requests
  });

  test("throws after all providers exhausted", async () => {
    // Verify error propagation
  });
});

// ─── Dual-Mode (OmniRoute vs Direct BYOK) ────────────────────────────────
// Scenario matrix: mode × config → which code path runs.

describe("generateAIResponse (dual-mode routing)", () => {
  test("Branch A: USE_OMNIROUTE=true → gateway call with alias, no local retries", async () => {
    vi.stubEnv("USE_OMNIROUTE", "true");
    // Mock OpenAI client pointed at OMNIROUTE_URL
    // Assert: model === MODEL_RECIPE_AI ("nutri-recipe"), baseURL === env.OMNIROUTE_URL
    // Assert: generateWithFallback is NEVER called
  });

  test("Branch A: gateway mode ignores missing provider keys", async () => {
    vi.stubEnv("USE_OMNIROUTE", "true");
    vi.stubEnv("GROQ_API_KEY", "");       // no direct keys needed
    vi.stubEnv("OPENAI_API_KEY", "");     // unselected providers optional
    // Assert: no validation error, call routes to gateway
  });

  test("Branch B: direct mode with Groq-only → chat pinned to CHAT_MODEL", async () => {
    vi.stubEnv("USE_OMNIROUTE", "false");
    vi.stubEnv("AI_PROVIDERS", "groq");
    vi.stubEnv("GROQ_API_KEY", "gsk_test");
    vi.stubEnv("CHAT_MODEL", "llama-3.1-8b-instant");
    // Assert: generateAIResponse("chat", ...) → GroqClient with [llama-3.1-8b-instant]
    // Assert: generateViaGateway is NEVER called
  });

  test("Branch B: direct mode skips providers without keys in fallback loop", async () => {
    vi.stubEnv("USE_OMNIROUTE", "false");
    vi.stubEnv("AI_PROVIDERS", "groq,gemini");
    vi.stubEnv("GROQ_API_KEY", "gsk_test");
    vi.stubEnv("GEMINI_API_KEY", "");     // gemini listed but no key
    // Assert: only Groq is attempted for "recipe-ai" text request
  });

  test("Branch B: multimodal request skips non-multimodal providers", async () => {
    vi.stubEnv("USE_OMNIROUTE", "false");
    vi.stubEnv("AI_PROVIDERS", "groq,gemini");
    vi.stubEnv("GROQ_API_KEY", "gsk_test");
    vi.stubEnv("GEMINI_API_KEY", "test");
    // Assert: groq skipped for "recipe-ai" + image, gemini called
  });
});
```

#### Frontend

```ts
// __tests__/unit/src/components/PdfUpload.test.tsx
import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PdfUpload from "../../../src/components/PdfUpload";

describe("PdfUpload", () => {
  test("renders upload button", () => {
    render(<PdfUpload />);
    expect(screen.getByRole("button", { name: /upload/i })).toBeInTheDocument();
  });

  test("shows file input on click", async () => {
    render(<PdfUpload />);
    // Click upload button, verify file input appears
  });

  test("validates PDF file type", async () => {
    // Upload non-PDF file, verify error message
  });
});
```

### Integration Tests

```ts
// __tests__/integration/api/upload.test.ts
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../../../server/server.js";

describe("POST /api/upload", () => {
  let server: any;

  beforeAll(async () => {
    server = app.listen();
  });

  afterAll(async () => {
    server.close();
  });

  test("uploads PDF and returns diet data", async () => {
    const pdfBuffer = fs.readFileSync("__tests__/fixtures/sample.pdf");
    
    const response = await request(server)
      .post("/api/upload")
      .send({
        fileName: "test-diet.pdf",
        fileData: pdfBuffer.toString("base64"),
        lang: "en",
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("planData");
    expect(response.body.planData).toHaveProperty("meals");
  });

  test("returns cached result for duplicate hash", async () => {
    // Upload same PDF twice, verify second returns cached
  });

  test("rejects non-PDF files", async () => {
    // Upload .txt file, verify 400 error
  });
});
```

### E2E Tests (Playwright)

```ts
// __tests__/e2e/upload-flow.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Upload Flow", () => {
  test("uploads PDF and displays diet results", async ({ page }) => {
    await page.goto("/");
    
    // 1. Click upload button
    await page.click('[data-testid="upload-button"]');
    
    // 2. Upload PDF file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles("__tests__/fixtures/sample.pdf");
    
    // 3. Wait for processing
    await expect(page.locator('[data-testid="loading"]')).toBeVisible();
    await expect(page.locator('[data-testid="loading"]')).toBeHidden({ timeout: 30000 });
    
    // 4. Verify results displayed
    await expect(page.locator('[data-testid="diet-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="meal-list"]')).toBeVisible();
  });

  test("shows disclaimer on first use", async ({ page }) => {
    await page.goto("/");
    
    // Verify disclaimer modal appears
    await expect(page.locator('[data-testid="disclaimer-modal"]')).toBeVisible();
    await expect(page.locator("text=does not replace")).toBeVisible();
    
    // Accept disclaimer
    await page.click('[data-testid="accept-disclaimer"]');
    await expect(page.locator('[data-testid="disclaimer-modal"]')).toBeHidden();
  });
});
```

### Test Configuration

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["__tests__/unit/**/*.test.ts", "__tests__/integration/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
```

```ts
// playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "__tests__/e2e",
  timeout: 30000,
  retries: 2,
  use: {
    baseURL: "http://localhost:5027",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    port: 5027,
    reuseExistingServer: true,
  },
});
```

### CI Pipeline

```yaml
# .github/workflows/test.yml
name: Tests
on: [pull_request]

jobs:
  unit-integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "npm"
      - run: npm ci
      - run: npm run test:unit -- --coverage
      - run: npm run test:integration
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage
          path: coverage/

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "npm"
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/

  eval:
    runs-on: ubuntu-latest
    env:
      GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
      GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "npm"
      - run: npm ci
      - run: npm run test:eval
```

### Package.json Scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:unit": "vitest run __tests__/unit",
    "test:integration": "vitest run __tests__/integration",
    "test:e2e": "playwright test",
    "test:eval": "vitest run __tests__/prompts",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest watch",
    "test:ui": "vitest --ui"
  }
}
```

---

## 🪝 14. Git Hooks (Husky)

### Pre-Commit Hooks

```bash
# Install
npm install -D husky lint-staged
npx husky init
```

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "vitest run --bail --reporter=verbose"],
    "*.{json,md}": ["prettier --write"],
    "*.test.{ts,tsx}": []  # Don't lint test files twice
  }
}
```

```bash
# .husky/pre-commit
npx lint-staged
```

```bash
# .husky/commit-msg
npx commitlint --edit $1
```

### What Pre-Commit Does

| Check | Tool | Blocks Commit? |
|---|---|---|
| Lint TypeScript | ESLint | Yes (errors) |
| Format code | Prettier | No (auto-fix) |
| Run unit tests | Vitest | Yes (failures) |
| Type check | TypeScript | Yes (errors) |
| Validate env schema | Zod | Yes (invalid config) |
| Check no secrets in code | git-secrets | Yes (leaked keys) |

### Commit Message Convention

```
feat(auth): add OAuth login flow
fix(upload): handle empty PDF gracefully
refactor(ai): extract provider interface
test(eval): add regression tests for prompts
```

---

## 🔒 15. Cybersecurity (SaaS Critical)

### OWASP Top 10 (2021) Mapping

| OWASP | Vulnerability | Our Mitigation | Status |
|---|---|---|---|
| **A01** | Broken Access Control | Row-level security, JWT auth, tenant isolation, CORS | ✅ |
| **A02** | Cryptographic Failures | AES-256-GCM for BYOK, bcrypt for passwords, HTTPS | ✅ |
| **A03** | Injection | Zod validation, parameterized queries, sanitize-html | ✅ |
| **A04** | Insecure Design | Threat modeling, security-first architecture,最小权限 | ✅ |
| **A05** | Security Misconfiguration | Helmet.js, env validation, no defaults in prod | ✅ |
| **A06** | Vulnerable Components | npm audit CI, Dependabot, lockfile | ✅ |
| **A07** | Auth Failures | Account lockout, JWT rotation, email verification | ✅ |
| **A08** | Data Integrity Failures | Refresh token rotation, signed JWTs, lockfile | ✅ |
| **A09** | Logging Failures | Audit logs, failed login tracking, error monitoring | ✅ |
| **A10** | SSRF | No user-controlled URLs in server requests | ✅ |

### MITRE ATT&CK Mapping (Web Application)

| Tactic | Technique | ID | Our Defense |
|---|---|---|---|
| **Reconnaissance** | Active Scanning | T1595 | Rate limiting, WAF, no verbose errors |
| **Initial Access** | Exploit Public App | T1190 | Input validation, Helmet headers, HTTPS |
| **Initial Access** | Valid Accounts | T1078 | Strong passwords, MFA (TOTP) optional or required, account lockout |
| **Execution** | Exploitation for Client Exec | T1203 | No eval(), CSP headers, no inline scripts |
| **Persistence** | Account Manipulation | T1098 | Audit logs, email verification, token rotation |
| **Persistence** | Server Software Component | T1505 | No plugins, minimal dependencies, npm audit |
| **Privilege Escalation** | Abuse Elevation Mechanism | T1548 | Role-based access, no admin endpoints exposed |
| **Defense Evasion** | Obfuscated Files | T1027 | Source maps disabled in prod, minification |
| **Credential Access** | Brute Force | T1110 | Account lockout, rate limiting, CAPTCHA-ready |
| **Credential Access** | Credential Stuffing | T1110 | Rate limiting, breach detection, password policy |
| **Discovery** | Network Service Scan | T1046 | Minimal exposed ports, no debug endpoints |
| **Collection** | Data from Cloud Storage | T1005 | Encrypted storage, access controls, audit logs |
| **Exfiltration** | Exfil Over Web Service | T1041 | No external data uploads, BYOK is opt-in |
| **Impact** | Data Destruction | T1485 | Backups, soft deletes, recovery procedures |
| **Impact** | Service Denial | T1499 | Rate limiting, DDoS protection, auto-scaling |

### Security Layers

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: Transport (HTTPS/TLS)                         │
├─────────────────────────────────────────────────────────┤
│  Layer 2: HTTP Security Headers (Helmet.js)             │
├─────────────────────────────────────────────────────────┤
│  Layer 3: Rate Limiting (per-IP + per-user)             │
├─────────────────────────────────────────────────────────┤
│  Layer 4: Input Validation (Zod + sanitization)         │
├─────────────────────────────────────────────────────────┤
│  Layer 5: Authentication (JWT + OAuth + bcrypt)         │
├─────────────────────────────────────────────────────────┤
│  Layer 6: Authorization (row-level, tenant isolation)   │
├─────────────────────────────────────────────────────────┤
│  Layer 7: Data Protection (encryption at rest)          │
├─────────────────────────────────────────────────────────┤
│  Layer 8: Monitoring (audit logs, alerts)               │
└─────────────────────────────────────────────────────────┘
```

### OWASP Application Security Verification Standard (ASVS)

| Level | Requirement | Our Status |
|---|---|---|
| **V1** | Architecture, Design and Threat Modeling | ✅ Documented in plan |
| **V2** | Authentication | ✅ bcrypt, JWT, lockout, verification |
| **V3** | Session Management | ✅ Refresh token rotation, secure cookies |
| **V4** | Access Control | ✅ Row-level security, tenant isolation |
| **V5** | Input Validation | ✅ Zod schemas, parameterized queries |
| **V6** | Cryptography | ✅ AES-256-GCM, bcrypt, HTTPS |
| **V7** | Error Handling and Logging | ✅ Audit logs, no verbose errors |
| **V8** | Data Protection | ✅ Encryption at rest, secure deletion |
| **V9** | Communication | ✅ HTTPS, HSTS, secure cookies |
| **V10** | Malicious Code | ✅ No eval(), CSP, input sanitization |
| **V11** | Business Logic | ✅ Rate limiting, workflow validation |
| **V12** | Files and Resources | ✅ File type validation, size limits |
| **V13** | API and Web Service | ✅ Rate limiting, input validation, auth |
| **V14** | Configuration | ✅ Zod env, no defaults in prod |

### HTTP Security Headers

```ts
// server/middleware/security.ts
import helmet from "helmet";

export function securityHeaders(app: Express) {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],  // Required for Tailwind
        imgSrc: ["'self'", "data:", "https://images.unsplash.com"],
        connectSrc: ["'self'", "https://api.groq.com", "https://generativelanguage.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.googleapis.com"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    crossOriginEmbedderPolicy: false,  // Allow Unsplash images
  }));
}
```

### Rate Limiting

```ts
// server/middleware/rateLimit.ts
import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";

// Global: 100 requests per 15 minutes per IP
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth: 5 attempts per 15 minutes per IP (brute force protection)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many attempts. Please try again later." },
  skipSuccessfulRequests: true,
});

// AI: 10 requests per minute per user (protect API quota)
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.id || req.ip,
});

// Upload: 5 uploads per hour per user
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.user?.id || req.ip,
});
```

### Input Validation & Sanitization

```ts
// server/middleware/validation.ts
import { z } from "zod";
import sanitizeHtml from "sanitize-html";

// Validate and sanitize all inputs
export function validateBody(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: result.error.issues.map(i => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    }
    req.body = result.data;
    next();
  };
}

// Sanitize HTML inputs (prevent XSS)
export function sanitizeInput(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: [],  // No HTML allowed
    allowedAttributes: {},
  });
}

// Validate file uploads
export const uploadSchema = z.object({
  fileName: z.string().max(255).regex(/^[a-zA-Z0-9_-]+\.pdf$/),
  fileData: z.string().max(50 * 1024 * 1024), // 50MB max base64
  lang: z.enum(["en", "es"]),
});
```

### Authentication Security

```ts
// server/saas/auth/security.ts

// 1. Password hashing (bcrypt, 12 rounds)
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// 2. Account lockout (5 failed attempts → 15 min lock)
export async function checkAccountLockout(userId: string): Promise<boolean> {
  const attempts = await db.query(
    "SELECT COUNT(*) as count FROM login_attempts WHERE user_id = ? AND created_at > NOW() - INTERVAL '15 minutes'",
    [userId]
  );
  return attempts.count >= 5;
}

// 3. JWT token rotation (refresh token used once)
export async function rotateRefreshToken(oldToken: string): Promise<string> {
  // Verify old token exists and hasn't been used
  const stored = await db.query(
    "SELECT * FROM refresh_tokens WHERE token_hash = ? AND used = false",
    [sha256(oldToken)]
  );
  
  if (!stored) throw new Error("Invalid refresh token");
  
  // Mark old token as used
  await db.query(
    "UPDATE refresh_tokens SET used = true WHERE token_hash = ?",
    [sha256(oldToken)]
  );
  
  // Issue new pair
  return generateTokenPair(stored.user_id);
}

// 4. Email verification (required for registration)
export async function sendVerificationEmail(userId: string, email: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  
  await db.query(
    "INSERT INTO email_verifications (user_id, token, expires_at) VALUES (?, ?, ?)",
    [userId, sha256(token), expires]
  );
  
  await sendEmail(email, "Verify your account", `Click: ${APP_URL}/verify?token=${token}`);
}

// 5. Password reset (token expires in 1 hour)
export async function requestPasswordReset(email: string) {
  const user = await db.query("SELECT id FROM users WHERE email = ?", [email]);
  if (!user) return; // Don't reveal if email exists
  
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  
  await db.query(
    "INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
    [user.id, sha256(token), expires]
  );
  
  await sendEmail(email, "Reset password", `Click: ${APP_URL}/reset?token=${token}`);
}
```

### BYOK Encryption

```ts
// server/saas/auth/byok.ts
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY = Buffer.from(env.BYOK_ENCRYPTION_KEY, "hex"); // 32 bytes from env

export function encryptApiKey(apiKey: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  
  let encrypted = cipher.update(apiKey, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:encrypted
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

export function decryptApiKey(encrypted: string): string {
  const [ivHex, authTagHex, data] = encrypted.split(":");
  
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(data, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}
```

### SQL Injection Prevention

```ts
// All queries use parameterized statements
// NEVER: `SELECT * FROM users WHERE id = '${userId}'`
// ALWAYS: db.query("SELECT * FROM users WHERE id = ?", [userId])

// Safe example:
const user = await db.query(
  "SELECT id, email, name FROM users WHERE id = $1",
  [userId]
);
```

### File Upload Security

```ts
// server/middleware/fileSecurity.ts

// 1. Validate file type (magic bytes, not just extension)
import fileType from "file-type";

export async function validateFileType(buffer: Buffer): Promise<boolean> {
  const type = await fileType.fromBuffer(buffer);
  return type?.mime === "application/pdf";
}

// 2. Validate file size
export function validateFileSize(buffer: Buffer, maxSizeMB: number = 10): boolean {
  return buffer.length <= maxSizeMB * 1024 * 1024;
}

// 3. Scan for malware (optional, for SaaS)
// Use ClamAV or VirusTotal API if handling untrusted uploads
```

### Audit Logging

```ts
// server/saas/auth/audit.ts

export interface AuditEvent {
  userId?: string;
  action: string;
  ip: string;
  userAgent: string;
  details?: Record<string, any>;
}

export async function logAuditEvent(event: AuditEvent) {
  await db.query(
    `INSERT INTO audit_logs (user_id, action, ip_address, user_agent, details, created_at)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [event.userId, event.action, event.ip, event.userAgent, JSON.stringify(event.details)]
  );
}

// Track sensitive events
// - Login/logout
// - Password changes
// - API key changes
// - Failed auth attempts
// - File uploads
// - AI requests (cost tracking)
```

### CORS Configuration

```ts
// server/middleware/cors.ts
import cors from "cors";

export function configureCORS(app: Express) {
  if (isSaaS) {
    // SaaS: strict CORS
    app.use(cors({
      origin: env.APP_URL,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }));
  } else {
    // OSS: permissive (local development)
    app.use(cors());
  }
}
```

### Security Checklist (SaaS)

| Category | Item | Priority |
|---|---|---|
| **Transport** | HTTPS enforced (redirect HTTP → HTTPS) | Critical |
| **Transport** | HSTS headers (1 year, includeSubDomains) | High |
| **Auth** | Passwords hashed with bcrypt (12 rounds) | Critical |
| **Auth** | Account lockout after 5 failed attempts | High |
| **Auth** | Email verification required | High |
| **Auth** | JWT access token short-lived (15 min) | High |
| **Auth** | Refresh token rotation (one-time use) | High |
| **Auth** | Password reset token expires in 1 hour | High |
| **Input** | Zod validation on all endpoints | Critical |
| **Input** | HTML sanitization (prevent XSS) | High |
| **Input** | File type validation (magic bytes) | High |
| **Input** | File size limits (10MB max) | Medium |
| **DB** | Parameterized queries (prevent SQL injection) | Critical |
| **DB** | Row-level security (users can only see own data) | Critical |
| **API** | Rate limiting (global + per-endpoint) | High |
| **API** | CORS properly configured | High |
| **Data** | API keys encrypted at rest (AES-256-GCM) | High |
| **Data** | No secrets in code or logs | Critical |
| **Monitoring** | Audit logs for sensitive events | High |
| **Monitoring** | Failed login attempt tracking | High |
| **Dependencies** | npm audit in CI (block on vulnerabilities) | High |
| **Dependencies** | Dependabot for automated updates | Medium |

### Dependencies (Security)

```json
{
  "dependencies": {
    "helmet": "^7.1.0",
    "express-rate-limit": "^7.2.0",
    "rate-limit-redis": "^4.2.0",
    "sanitize-html": "^2.13.0",
    "file-type": "^19.0.0",
    "cors": "^2.8.5"
  }
}
```

---

**Not adding:** LangSmith (prompt versioning via git).

Remove after refactor:
- `@google/genai` → wrapped by `server/ai/providers/gemini.ts` (still uses same SDK)

---

*Last updated: 2026-08-11 (v14 — added: runtime language selector (AppBar dropdown + /api/config + users.lang), SaaS marketing landing page, subdomain split domain.com / app.domain.com with complexity assessment)*
*Principles: Clean Architecture (deps inward, typed boundary), DRY (one retry path, one PDF flow, one hash function, one prompt per type), KISS (env vars over config files, SQLite for OSS, Groq+Gemini defaults — both free forever, no LangSmith, no billing yet).*
