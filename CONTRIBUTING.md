# Contributing to VitalityNutri

Thank you for your interest in contributing! Here's how you can help.

## Code Style

- Follow the existing code patterns (React + TypeScript + Tailwind)
- Use `react-i18next` `t()` for all user-facing strings
- Never hardcode Spanish or English strings in components

## Adding Translations

1. Add keys to `src/i18n/es.json` and `src/i18n/en.json`
2. Use the key as `t("namespace.key")` in components
3. See [TRANSLATING.md](./TRANSLATING.md) for details

## Pull Request Process

1. Create a feature branch
2. Make your changes
3. Run `npm run lint` and `npm run typecheck`
4. Submit a PR with a clear description
