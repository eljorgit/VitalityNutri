<div align="center">
  <img width="1200" height="400" alt="VitalityNutri Banner" src="https://images.unsplash.com/photo-1498837167922-ddd27525d352?q=80&w=1200&auto=format&fit=crop&q=80" style="border-radius: 12px; object-fit: cover;" />
  
  # 🥦 VitalityNutri 🥑
  ### Planificación de Alimentación Inteligente, Consciente y Saludable
  
  [![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vite.dev/)
  [![React](https://img.shields.io/badge/React-19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
  [![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
  [![Gemini AI](https://img.shields.io/badge/Gemini_AI-3.5_Flash-4285F4?style=for-the-badge&logo=google-gemini&logoColor=white)](https://ai.google.dev/)
  [![i18next](https://img.shields.io/badge/i18n-react--i18next-26A69A?style=for-the-badge&logo=i18next&logoColor=white)](https://react.i18next.com/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org/)
  [![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
  
  **🌐 Español** · [English](README.md)
</div>

---

## 📝 Descripción

VitalityNutri es una aplicación web full-stack de planificación nutricional que automatiza la conversión de guías de alimentación en formato PDF a menús estructurados semanales mediante Inteligencia Artificial. Utiliza el modelo **Gemini 3.5 Flash** de Google para extraer ingredientes, instrucciones y tablas calóricas con alta fidelidad. Toda la información se guarda en **SQLite**. Completamente internacionalizada con soporte para inglés y español.

---

## ✨ Características

* **🤖 Extracción Automática con IA** — Carga planes PDF y la IA extrae menús semanales estructurados automáticamente
* **📅 Calendario Semanal Interactivo** — Visualización clara con 4 comidas diarias: Desayuno, Almuerzo, Merienda, Cena
* **🍲 Recetario y Ficha Detallada** — Ingredientes por plato, instrucciones paso a paso, calorías estimadas, imágenes Unsplash
* **🛒 Lista de Compras Inteligente** — Agrupada automáticamente por categorías, normalización inteligente, selección por día/rango, multiplicadores
* **📜 Historial de Planes y Restauración** — Navega entre planes anteriores, cámbialos, restáuralos o reprocésalos
* **🌐 Idioma Dual** — Interfaz completa en inglés y español con react-i18next
* **🥘 Guía de Batch Cooking** — Plan de cocinado optimizado generado por IA según tus electrodomésticos
* **📱 Compartir y Exportar** — Comparte recetas por WhatsApp, Telegram, correo o expórtalas a Keep Notes

---

## 🏗️ Arquitectura

```
vitalitynutri/
├── data/                 # Persistencia (BD SQLite + PDFs subidos)
├── prompts/              # Prompts de IA (EN/ES)
│   ├── recipe-ai/
│   ├── batch-cooking/
│   └── plan-analysis/
├── src/                  # Frontend React (TypeScript)
│   ├── components/       # Componentes UI
│   ├── i18n/             # Traducciones (en.json, es.json) + config.ts
│   ├── utils/            # Utilidades (routes, siteVisibility, searchHelpers)
│   ├── types.ts          # Definiciones de tipos TypeScript
│   ├── db.ts             # Lógica de base de datos SQLite
│   ├── main.tsx          # Punto de entrada React
│   └── index.css         # Estilos globales (Tailwind CSS v4)
├── server.ts             # Servidor Express, API, integración Gemini AI
├── .github/              # Workflows CI/CD y plantillas
├── Dockerfile            # Build multi-etapa para contenedor
├── docker-compose.yml    # Orquestación de contenedores
├── .nvmrc                # Versión de Node.js fijada
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 🛠️ Tecnologías

### Frontend:
* **React 19** y **TypeScript**
* **Tailwind CSS v4** (con `@tailwindcss/vite`)
* **react-i18next** + **i18next** (internacionalización)
* **Motion** (animaciones)
* **Lucide React** y **Material Symbols** (iconos)

### Backend:
* **Node.js** y **Express**
* **Google GenAI SDK** (`@google/genai`) con `gemini-3.5-flash`
* **SQLite** mediante `better-sqlite3`
* **esbuild** (empaquetado del servidor)

### DevOps:
* **Docker** builds multi-etapa
* **GitHub Actions** CI/CD (lint, build, deploy)
* **rimraf** (limpieza multiplataforma)

---

## 🚀 Instalación y Configuración Local

### Requisitos Previos:
*   [Node.js](https://nodejs.org/) (Versión 18 o superior recomendada)
*   Una API Key de Google Gemini (gratis en [Google AI Studio](https://aistudio.google.com/))

### 1. Clonar e instalar dependencias
```bash
cd vitalitynutri
npm install
```

### 2. Configurar variables de entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
GEMINI_API_KEY=tu_clave_de_api_de_gemini
```

| Variable | Obligatoria | Por defecto | Descripción |
|----------|-------------|-------------|-------------|
| `GEMINI_API_KEY` | ✅ Sí | — | Clave de API de Google Gemini AI |
| `PORT` | ❌ No | `5027` | Puerto del servidor HTTP |
| `NODE_ENV` | ❌ No | `development` | `development` o `production` |
| `APP_URL` | ❌ No | auto-detectada | URL pública (para meta tags OG, enlaces compartidos) |
| `SITE_VISIBILITY` | ❌ No | auto-detectada | `public` o `local` (muestra advertencia al compartir si es local) |
| `UNSPLASH_ACCESS_KEY` | ❌ No | — | Clave de API de Unsplash para búsqueda de imágenes de recetas |

### 3. Ejecutar en modo desarrollo

Inicia el servidor Express y el servidor de desarrollo de Vite conjuntamente con Hot Module Replacement (HMR):

```bash
npm run dev
```

La aplicación estará disponible en: **http://localhost:5027**

---

## 🐳 Despliegue con Docker

Build multi-etapa para una imagen de producción ligera.

### Construir:
```bash
docker build -t vitalitynutri .
```

### Ejecutar con docker-compose (recomendado):
```bash
docker compose up -d
```

### Ejecutar manualmente:
```bash
docker run -d -p 5027:5027 --env GEMINI_API_KEY="tu_clave_api" -v vitality_data:/app/data vitalitynutri
```

> [!TIP]
> Usa un volumen (`-v vitality_data:/app/data`) para que la base de datos SQLite y los PDFs subidos persistan aunque el contenedor se reinicie o actualice.

---

## 📊 Diseño de la Base de Datos (Esquema SQLite)

El archivo de base de datos se guarda en `data/database.sqlite`.

### Tabla `plans`
Almacena los menús semanales extraídos y su estado:
*   `id`: Clave primaria autoincremental.
*   `file_name`: Nombre original del archivo PDF subido.
*   `saved_file_name`: Nombre único guardado en el servidor para evitar colisiones.
*   `plan_json`: JSON serializado con la estructura completa de días y comidas.
*   `metadata_json`: Metadatos del procesamiento.
*   `is_active`: Flag booleano (`1` o `0`) que identifica el plan actual en pantalla.
*   `created_at`: Fecha y hora de procesamiento.
*   `file_hash`: Hash SHA-256 para detección de duplicados.
*   `batch_cooking_json` / `batch_cooking_params`: Guía de batch cooking en caché.

### Tabla `grocery_list_state`
Persiste las interacciones del usuario con la lista de compra:
*   `id`: Clave primaria fija (`CHECK (id = 1)`) que asegura una sola fila de estado global.
*   `checked_items_json`: JSON con las casillas de verificación marcadas.
*   `list_type`: Tipo de vista (semanal, un día o tres días).
*   `selected_single_day` / `selected_3days_start`: Parámetros de filtrado temporal.
*   `excluded_meals_json`: Lista de comidas excluidas del cálculo de ingredientes.
*   `multipliers_json`: Escala de porciones para cada día de la semana.
*   `updated_at`: Última actualización.

### Tabla `completed_recipes_state`
Recetas marcadas como cocinadas en el plan activo:
*   `plan_id`: Clave foránea a `plans.id`.
*   `completed_json`: JSON que mapea identificadores de recetas a estados booleanos de completado.

### Tabla `recipes`
Recetario:
*   Campos estándar de receta (nombre, calorías, tiempo, etiqueta, imagen, ingredientes, pasos, consejos).
*   `source`: Origen (`manual`, `plan`, `ocr`, `text`, `document`).
*   `source_plan_id`: Referencia al plan de origen.
*   `is_ai_generated`, `is_favorite`: Flags booleanos.
*   `season`: Filtro de temporada (`Todas`, `Primavera`, `Verano`, `Otoño`, `Invierno`).

### Tabla `search_history`
Historial de clics en búsqueda de recetas (limitado a 10 entradas).

### Tabla `ingredients`
Diccionario de ingredientes conocidos con categorías para el agrupamiento inteligente de la lista de la compra.

---

## ⚙️ npm Scripts

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Inicia servidor de desarrollo con HMR |
| `npm run build` | Compila frontend + empaqueta backend |
| `npm run start` | Ejecuta servidor de producción (`dist/server.cjs`) |
| `npm run clean` | Elimina artefactos de `dist/` |
| `npm run lint` | Verificación de tipos TypeScript (`tsc --noEmit`) |
| `npm test` | Ejecuta la suite de tests Vitest |
| `npm run test:watch` | Ejecuta tests en modo watch |
