<div align="center">
  <img width="1200" height="400" alt="VitalityNutri Banner" src="https://images.unsplash.com/photo-1498837167922-ddd27525d352?q=80&w=1200&auto=format&fit=crop&q=80" style="border-radius: 12px; object-fit: cover;" />
  
  # 🥦 VitalityNutri 🥑
  ### Planificación de Alimentación Inteligente, Consciente y Saludable
  
  [![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vite.dev/)
  [![React](https://img.shields.io/badge/React-19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
  [![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
  [![Gemini AI](https://img.shields.io/badge/Gemini_AI-3.5_Flash-4285F4?style=for-the-badge&logo=google-gemini&logoColor=white)](https://ai.google.dev/)
  [![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org/)
  [![Docker](https://img.shields.io/badge/Docker-Supported-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
</div>

---

## 📝 Descripción del Proyecto

**VitalityNutri** es una aplicación web full-stack de planificación nutricional que automatiza la conversión de guías de alimentación en formato PDF a menús estructurados semanales mediante Inteligencia Artificial.

La aplicación utiliza el modelo **Gemini 3.5 Flash** de Google mediante el nuevo SDK `@google/genai` para extraer y mapear con alta fidelidad ingredientes, instrucciones y tablas calóricas. Toda la información y estados de la aplicación se guardan localmente en una base de datos **SQLite**, ofreciendo una interfaz fluida e intuitiva con un calendario interactivo y una lista de compras dinámica y parametrizable.

---

## ✨ Características Principales

*   **⚡ Extracción Automática con IA**: Carga planes de alimentación en formato PDF (de nutricionistas, médicos o entrenadores) y la IA extraerá de forma inteligente la agenda de comidas de lunes a domingo.
*   **📅 Calendario Semanal Interactivo**: Visualización clara del plan de alimentación dividido en 4 comidas diarias: **Desayuno, Almuerzo/Comida, Merienda y Cena**.
*   **🍲 Recetario y Ficha Detallada**:
    *   Ingredientes clasificados por platos (Primer Plato, Segundo Plato, Postre) o unificados en General.
    *   Instrucciones de preparación paso a paso.
    *   Estimaciones de calorías, tiempos de cocción y tips personalizados.
    *   Imágenes dinámicas autogeneradas a través de la integración estética con Unsplash.
    *   Edición manual de recetas directamente desde el calendario.
*   **🛒 Lista de Compras Inteligente y Agrupada**:
    *   Agrupación automática de ingredientes por categorías de supermercado (*verduras, carnes, pescados, lácteos, despensa*, etc.).
    *   Normalización inteligente (ej: agrupa variaciones de aceites a *"aceite de oliva virgen extra"* o huevos a *"huevo"*, moviendo especificaciones a campos de preparación).
    *   Generación selectiva: lista completa semanal, de un único día o rango de 3 días.
    *   Multiplicadores de cantidad (escalado de recetas para varias personas).
    *   Exclusión de comidas específicas para depurar la lista.
    *   Persistencia local del estado de las casillas verificadas.
*   **📜 Historial de Planes y Rollback**: Acceso rápido a todos los PDFs procesados previamente. Puedes alternar entre ellos, restaurar un plan anterior como el activo, eliminarlos o reprocesarlos en caso de cambios en el prompt.
*   **💾 Almacenamiento Local Robusto**: Persistencia de datos inmediata usando SQLite con la librería de alto rendimiento `better-sqlite3`.

---

## 🏗️ Arquitectura y Estructura del Código

La aplicación está diseñada bajo una arquitectura moderna monorepo que integra un cliente en React y un servidor en Express/TypeScript:

```
VitalityNutry/
├── data/                 # Directorio de persistencia (SQLite DB y cargas de PDF)
├── src/                  # Código fuente del Frontend (React + TS)
│   ├── components/       # Componentes de la interfaz de usuario
│   │   ├── CalendarGrid.tsx   # Cuadrícula semanal del menú
│   │   ├── Dashboard.tsx      # Panel de control de subida de archivos e historial
│   │   ├── GroceryList.tsx    # Interfaz interactiva de la lista de compras
│   │   └── RecipeDetail.tsx   # Modal detallado con la preparación del plato
│   ├── defaultData.ts    # Datos iniciales/demo de la aplicación
│   ├── db.ts             # Lógica de conexión y queries SQL a SQLite
│   ├── types.ts          # Definiciones de tipos e interfaces de TypeScript
│   ├── main.tsx          # Punto de entrada de React
│   └── index.css         # Estilos globales y tokens de Tailwind CSS v4
├── server.ts             # Servidor Express, API REST y configuración de Gemini AI
├── promt.md              # Prompt del sistema para el modelado de datos de Gemini
├── vite.config.ts        # Configuración del empaquetado del frontend (Vite v6)
├── tsconfig.json         # Configuración del compilador de TypeScript
├── Dockerfile            # Configuración para despliegues contenerizados
└── package.json          # Dependencias y scripts del proyecto
```

---

## 🛠️ Tecnologías Utilizadas

### Frontend:
*   **React 19** & **TypeScript**
*   **Tailwind CSS v4** (utilizando el compilador nativo `@tailwindcss/vite`)
*   **Motion** (animaciones micro-interactivas fluidas)
*   **Lucide React** & **Material Symbols** (iconografía premium)

### Backend:
*   **Node.js** & **Express**
*   **Google GenAI SDK** (`@google/genai`) con llamadas optimizadas a `gemini-3.5-flash`
*   **SQLite** a través de `better-sqlite3` (base de datos relacional ligera y rápida)
*   **esbuild** (compilación optimizada para producción del servidor)

---

## 🚀 Instalación y Configuración Local

### Requisitos Previos:
*   [Node.js](https://nodejs.org/) (Versión 18 o superior recomendada)
*   Una API Key de Google Gemini (puedes obtenerla gratis en [Google AI Studio](https://aistudio.google.com/))

### 1. Clonar el repositorio e instalar dependencias
```bash
cd VitalityNutry
npm install
```

### 2. Configurar las variables de entorno
Crea un archivo `.env` en la raíz del proyecto y añade tu clave de API de Gemini:
```env
GEMINI_API_KEY=tu_clave_de_api_de_gemini
```

### 3. Ejecutar en modo desarrollo
Para levantar el servidor Express y el servidor de desarrollo de Vite de forma conjunta con Hot Module Replacement (HMR):
```bash
npm run dev
```
La aplicación estará disponible en: **http://localhost:3000**

---

## 🐳 Despliegue con Docker

El proyecto incluye soporte listo para producción mediante Docker en dos etapas (multi-stage build) para mantener una imagen final ligera y segura.

### Construir la imagen de Docker:
```bash
docker build -t vitality-nutri .
```

### Ejecutar el contenedor:
```bash
docker run -d -p 3000:3000 --env GEMINI_API_KEY="tu_api_key_aqui" -v vitality_data:/app/data vitality-nutri
```
> [!TIP]
> Se recomienda usar un volumen (`-v vitality_data:/app/data`) para asegurar que la base de datos SQLite y los archivos PDF subidos persistan si el contenedor se reinicia o se actualiza.

---

## 📊 Diseño de la Base de Datos (Esquema SQLite)

El archivo de base de datos se guarda en `data/database.sqlite` con la siguiente estructura:

### Tabla `plans`
Almacena los menús semanales extraídos de los PDFs y su estado:
*   `id`: Clave primaria autoincremental.
*   `file_name`: Nombre original del archivo PDF subido.
*   `saved_file_name`: Nombre único guardado físicamente en el servidor para evitar colisiones.
*   `plan_json`: JSON serializado con la estructura completa de días y comidas.
*   `metadata_json`: Metadatos del procesamiento.
*   `is_active`: Flag booleano (`1` o `0`) para identificar cuál es el plan actual en pantalla.
*   `created_at`: Fecha y hora de procesamiento.

### Tabla `grocery_list_state`
Persiste las interacciones del usuario con la lista de compras:
*   `id`: Clave primaria fija con restricción (`CHECK (id = 1)`) para asegurar una sola fila de estado global.
*   `checked_items_json`: JSON con las casillas de verificación marcadas.
*   `list_type`: Tipo de vista (semanal, un día, o tres días).
*   `selected_single_day` / `selected_3days_start`: Parámetros de filtrado temporal.
*   `excluded_meals_json`: Lista de comidas excluidas del cálculo de ingredientes.
*   `multipliers_json`: Escala de porciones para cada día de la semana.
*   `updated_at`: Última actualización.

---

## ⚙️ Scripts de npm Disponibles

*   `npm run dev`: Ejecuta el servidor y la interfaz React en modo desarrollo mediante `tsx` y Vite.
*   `npm run build`: Compila la UI de producción y empaqueta el backend Express en un único archivo modular (`dist/server.cjs`) usando `esbuild`.
*   `npm run start`: Inicia el servidor empaquetado de producción (`dist/server.cjs`).
*   `npm run clean`: Limpia los directorios compilados (`dist`).
*   `npm run lint`: Ejecuta el verificador de tipos de TypeScript sin emitir archivos.
