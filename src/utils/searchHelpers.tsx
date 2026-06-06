import React from "react";

// Helper: normalize search text so comparisons ignore case, accents and punctuation.
export function normalizeSearchText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function compactSearchText(text: string): string {
  return normalizeSearchText(text).replace(/\s+/g, "");
}

export function buildCompactIndex(text: string): { value: string; sourceIndexes: number[] } {
  const valueParts: string[] = [];
  const sourceIndexes: number[] = [];

  let sourceIndex = 0;
  for (const char of text) {
    const normalizedChar = char
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[\p{P}\p{S}\s]+/gu, "");

    for (const normalizedPart of Array.from(normalizedChar)) {
      valueParts.push(normalizedPart);
      sourceIndexes.push(sourceIndex);
    }
    sourceIndex += char.length;
  }

  return { value: valueParts.join(""), sourceIndexes };
}

export function matchesSearchText(text: string, normalizedQuery: string, compactQuery: string): boolean {
  const normalizedText = normalizeSearchText(text);
  return normalizedText.includes(normalizedQuery) || compactSearchText(text).includes(compactQuery);
}

export function getRecipeNameSearchScore(recipeName: string, normalizedQuery: string, compactQuery: string): number {
  const normalizedName = normalizeSearchText(recipeName);
  const compactName = compactSearchText(recipeName);

  if (normalizedName === normalizedQuery || compactName === compactQuery) return 100;
  if (normalizedName.startsWith(normalizedQuery) || compactName.startsWith(compactQuery)) return 80;
  if (normalizedName.includes(normalizedQuery) || compactName.includes(compactQuery)) return 50;
  return 0;
}

// Helper: split text and wrap matching parts in emerald span
export function highlightText(text: string, query: string): React.ReactNode {
  const compactQuery = compactSearchText(query);
  if (!compactQuery) return text;

  const compactText = buildCompactIndex(text);
  const matchStart = compactText.value.indexOf(compactQuery);
  if (matchStart === -1) return text;

  const matchEnd = matchStart + compactQuery.length - 1;
  const sourceStart = compactText.sourceIndexes[matchStart];
  const sourceEnd = compactText.sourceIndexes[matchEnd] + 1;

  return (
    <>
      <span>{text.slice(0, sourceStart)}</span>
      <mark className="bg-transparent text-emerald-600 dark:text-emerald-400 font-extrabold not-italic">{text.slice(sourceStart, sourceEnd)}</mark>
      <span>{text.slice(sourceEnd)}</span>
    </>
  );
}

export const MEAL_LABELS: Record<string, string> = {
  desayuno: "Desayuno",
  almuerzo: "Almuerzo",
  merienda: "Merienda",
  cena: "Cena",
};

export const DAY_LABELS: Record<string, string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miércoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
  domingo: "Domingo",
};
