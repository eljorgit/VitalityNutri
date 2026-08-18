# Translation Guide

## File Locations

- Spanish: `frontend/src/i18n/es.json`
- English: `frontend/src/i18n/en.json`

## Key Structure

Keys are organized by component namespace:

```json
{
  "dashboard": { ... },
  "calendar": { ... },
  "recipedetail": { ... },
  "grocery": { ... },
  "batchcooking": { ... },
  "recetario": { ... },
  "recipeform": { ... },
  "weekdays": { ... },
  "meals": { ... },
  "general": { ... }
}
```

## Usage in Components

```tsx
import { useTranslation } from "react-i18next";

function MyComponent() {
  const { t } = useTranslation();
  return <p>{t("namespace.key")}</p>;
}
```

## Interpolation

```json
{ "key": "Hello {{name}}" }
```

```tsx
t("namespace.key", { name: "World" })
```

## Adding New Keys

1. Add the key to both `es.json` and `en.json`
2. Use the proper namespace
3. Follow naming conventions (snake_case)
