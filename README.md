<div align="center">
  <img width="1200" height="400" alt="VitalityNutri Banner" src="https://images.unsplash.com/photo-1498837167922-ddd27525d352?q=80&w=1200&auto=format&fit=crop&q=80" style="border-radius: 12px; object-fit: cover;" />
  
  # 🥦 VitalityNutri 🥑
  ### Smart, Mindful & Healthy Meal Planning
  
  [![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vite.dev/)
  [![React](https://img.shields.io/badge/React-19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
  [![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
  [![Gemini AI](https://img.shields.io/badge/Gemini_AI-3.5_Flash-4285F4?style=for-the-badge&logo=google-gemini&logoColor=white)](https://ai.google.dev/)
  [![i18next](https://img.shields.io/badge/i18n-react--i18next-26A69A?style=for-the-badge&logo=i18next&logoColor=white)](https://react.i18next.com/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org/)
  [![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
  
  **🌐 English** · [Español](README.es.md)
</div>

---

## 📝 Description

VitalityNutri is a full-stack nutritional planning web application that automates the conversion of PDF meal guides into structured weekly menus using Artificial Intelligence. It uses Google's **Gemini 3.5 Flash** model to extract and map ingredients, instructions, and calorie tables with high fidelity. All data is stored locally in **SQLite**. Fully internationalized with English and Spanish support.

---

## 📸 Screenshots

<img src="docs/screenshot-calendar.png" alt="Weekly Calendar" width="49%" /> <img src="docs/screenshot-grocery-list.png" alt="Grocery List" width="49%" />
<img src="docs/screenshot-recipe-detail.png" alt="Recipe Detail" width="49%" /> <img src="docs/screenshot-batch-cooking.png" alt="Batch Cooking" width="49%" />

---

## ✨ Features

* **🤖 AI-Powered Extraction** — Upload PDF meal plans and let Gemini AI extract structured weekly menus automatically
* **📅 Interactive Weekly Calendar** — Clear view of 4 daily meals: Breakfast, Lunch, Snack, Dinner
* **🍲 Recipe Book & Detail View** — Ingredients by course, step-by-step instructions, calorie estimates, Unsplash images
* **🛒 Smart Grocery List** — Auto-grouped by supermarket categories, intelligent normalization, day/range selection, multipliers
* **📜 Plan History & Rollback** — Browse past plans, switch between them, restore or reprocess
* **🌐 Dual Language** — Full English/Spanish interface with react-i18next
* **🥘 Batch Cooking Guide** — AI-generated optimized cooking plan based on your kitchen appliances
* **📱 Share & Export** — Share recipes via WhatsApp, Telegram, email, or export to Keep Notes

---

## 🏗️ Architecture

```
vitalitynutri/
├── data/                 # Persistence (SQLite DB + PDF uploads)
├── prompts/              # AI system prompts (EN/ES)
│   ├── recipe-ai/
│   ├── batch-cooking/
│   └── plan-analysis/
├── src/                  # React Frontend (TypeScript)
│   ├── components/       # UI components
│   ├── i18n/             # Translation files (en.json, es.json) + config.ts
│   ├── utils/            # Helpers (routes, siteVisibility, searchHelpers)
│   ├── types.ts          # TypeScript type definitions
│   ├── db.ts             # SQLite database logic
│   ├── main.tsx          # React entry point
│   └── index.css         # Global styles (Tailwind CSS v4)
├── server.ts             # Express server, API, Gemini AI integration
├── .github/              # CI/CD workflows & templates
├── Dockerfile            # Multi-stage container build
├── docker-compose.yml    # Container orchestration
├── .nvmrc                # Node.js version pinning
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 🛠️ Tech Stack

### Frontend:
* **React 19** & **TypeScript**
* **Tailwind CSS v4** (with `@tailwindcss/vite`)
* **react-i18next** + **i18next** (internationalization)
* **Motion** (animations)
* **Lucide React** & **Material Symbols** (icons)

### Backend:
* **Node.js** & **Express**
* **Google GenAI SDK** (`@google/genai`) with `gemini-3.5-flash`
* **SQLite** via `better-sqlite3`
* **esbuild** (server bundling)

### DevOps:
* **Docker** multi-stage builds
* **GitHub Actions** CI/CD (lint, build, deploy)
* **rimraf** (cross-platform clean)

---

## 🚀 Local Setup

### Prerequisites:
*   [Node.js](https://nodejs.org/) (Node 18 or later recommended)
*   A Google Gemini API key (free at [Google AI Studio](https://aistudio.google.com/))

### 1. Clone and install dependencies
```bash
cd vitalitynutri
npm install
```

### 2. Configure environment variables

Create a `.env` file in the project root:

```env
GEMINI_API_KEY=your_gemini_api_key
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | ✅ Yes | — | Google Gemini AI API key |
| `PORT` | ❌ No | `5027` | HTTP server port |
| `NODE_ENV` | ❌ No | `development` | `development` or `production` |
| `APP_URL` | ❌ No | auto-detected | Public URL (for OG meta tags, share links) |
| `SITE_VISIBILITY` | ❌ No | auto-detected | `public` or `local` (shows share warning when local) |
| `UNSPLASH_ACCESS_KEY` | ❌ No | — | Unsplash API key for recipe image search |

### 3. Run in development mode

Starts both the Express server and Vite dev server with Hot Module Replacement (HMR):

```bash
npm run dev
```

The app is available at: **http://localhost:5027**

---

## 🐳 Docker Deployment

Multi-stage Docker build for a lightweight production image.

### Build:
```bash
docker build -t vitalitynutri .
```

### Run with docker-compose (recommended):
```bash
docker compose up -d
```

### Run manually:
```bash
docker run -d -p 5027:5027 --env GEMINI_API_KEY="your_api_key" -v vitality_data:/app/data vitalitynutri
```

> [!TIP]
> Use a volume (`-v vitality_data:/app/data`) to persist the SQLite database and uploaded PDFs across container restarts and updates.

---

## 📊 Database Design (SQLite Schema)

The database file is stored at `data/database.sqlite`.

### Table `plans`
Stores extracted weekly menus and their status:
*   `id`: Auto-increment primary key.
*   `file_name`: Original uploaded PDF file name.
*   `saved_file_name`: Unique server-side file name to avoid collisions.
*   `plan_json`: Serialized JSON with full day/meal structure.
*   `metadata_json`: Processing metadata.
*   `is_active`: Boolean flag (`1` or `0`) identifying the currently displayed plan.
*   `created_at`: Processing timestamp.
*   `file_hash`: SHA-256 hash for duplicate detection.
*   `batch_cooking_json` / `batch_cooking_params`: Cached batch cooking guide.

### Table `grocery_list_state`
Persists user interactions with the grocery list:
*   `id`: Fixed primary key (`CHECK (id = 1)`) enforcing a single global state row.
*   `checked_items_json`: JSON with checked checkbox states.
*   `list_type`: View type (weekly, single day, or three days).
*   `selected_single_day` / `selected_3days_start`: Temporal filter parameters.
*   `excluded_meals_json`: List of meals excluded from ingredient calculation.
*   `multipliers_json`: Portion scale for each day of the week.
*   `updated_at`: Last update timestamp.

### Table `completed_recipes_state`
Tracks which recipes in the active plan have been cooked:
*   `plan_id`: Foreign key to `plans.id`.
*   `completed_json`: JSON mapping recipe identifiers to boolean completion states.

### Table `recipes`
Recipe book database:
*   Standard recipe fields (name, calories, time, tag, image, ingredients, steps, tips).
*   `source`: Origin (`manual`, `plan`, `ocr`, `text`, `document`).
*   `source_plan_id`: Reference to originating plan.
*   `is_ai_generated`, `is_favorite`: Boolean flags.
*   `season`: Season filter (`Todas`, `Primavera`, `Verano`, `Otoño`, `Invierno`).

### Table `search_history`
Stores recipe search click history (capped at 10 entries).

### Table `ingredients`
Dictionary of known ingredients with categories for smart grocery list grouping.

---

## ⚙️ npm Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with HMR |
| `npm run build` | Build frontend + bundle backend |
| `npm run start` | Run production server (`dist/server.cjs`) |
| `npm run clean` | Remove `dist/` build artifacts |
| `npm run lint` | TypeScript type-check (`tsc --noEmit`) |
| `npm test` | Run Vitest test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:e2e` | Run Playwright e2e tests |

---

## 🤖 CI/CD Pipeline

The project uses a single GitHub Actions workflow (`.github/workflows/ci.yml`) with the following stages:

| Job | Description | Requires secrets | Blocks build |
|-----|-------------|-----------------|:---:|
| `lint` | TypeScript type-check | — | ✅ |
| `test` | Vitest unit tests + coverage | — | ✅ |
| `codeql` | CodeQL security analysis | — (solo en repo público) | ✅ |
| `snyk` | Snyk dependency scan | `SNYK_TOKEN` | ✅ |
| `e2e` | Playwright smoke tests | — | ✅ |
| `sonar` | SonarQube quality gate | `SONAR_TOKEN` | ✅ |
| `build` | Compile frontend + backend | — | ✅ |
| `docker` | Build & push image to GHCR | — (uses `GITHUB_TOKEN`) | push only |
| `deploy` | Deploy via SSH to server | `SSH_HOST`, `SSH_KEY`, `DEPLOY_PATH` | push only |

### 🔧 Forking / Self-hosting

Jobs that require external services (`snyk`, `sonar`, `deploy`) are automatically **skipped** if their required secrets are not configured. To enable them, add these **repository secrets** (`Settings → Secrets and variables → Actions`):

| Secret | Used by | Purpose |
|--------|---------|---------|
| `SNYK_TOKEN` | `snyk` | Snyk API token for dependency scanning |
| `SONAR_TOKEN` | `sonar` | SonarQube project token |
| `SONAR_HOST_URL` | `sonar` | Your SonarQube server URL (or use `vars`) |
| `TAILSCALE_AUTHKEY` | `sonar`, `deploy` | Tailscale auth key (optional — skip if server is public) |
| `SSH_HOST` | `deploy` | Deployment server hostname |
| `SSH_USER` | `deploy` | SSH user |
| `SSH_KEY` | `deploy` | SSH private key |
| `SSH_PORT` | `deploy` | SSH port (default: 22) |
| `DEPLOY_PATH` | `deploy` | Server path for deployment |

To run the full pipeline, make the repository **public** (required for CodeQL code scanning on forks).
