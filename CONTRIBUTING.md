# Contributing to VitalityNutri

Thank you for your interest in contributing! Here's how you can help.

## Code Style

- Follow the existing code patterns (React + TypeScript + Tailwind)
- Use `react-i18next` `t()` for all user-facing strings
- Never hardcode Spanish or English strings in components

## Adding Translations

1. Add keys to `frontend/src/i18n/es.json` and `frontend/src/i18n/en.json`
2. Use the key as `t("namespace.key")` in components
3. See [TRANSLATING.md](./TRANSLATING.md) for details

## Pull Request Process

1. Create a feature branch
2. Make your changes
3. Run `npm --prefix frontend run lint` and `npm --prefix frontend run test`
4. Submit a PR with a clear description
