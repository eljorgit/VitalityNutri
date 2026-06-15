import { describe, it, expect } from "vitest";
import {
  normalizeSearchText,
  compactSearchText,
  buildCompactIndex,
  matchesSearchText,
  getRecipeNameSearchScore,
} from "./searchHelpers";

describe("normalizeSearchText", () => {
  it("lowercases and trims text", () => {
    expect(normalizeSearchText("  Hello WORLD  ")).toBe("hello world");
  });

  it("removes accents", () => {
    expect(normalizeSearchText("canción")).toBe("cancion");
    expect(normalizeSearchText("álbum")).toBe("album");
    expect(normalizeSearchText("estrés")).toBe("estres");
    expect(normalizeSearchText("índice")).toBe("indice");
  });

  it("removes punctuation and symbols", () => {
    expect(normalizeSearchText("hello, world!")).toBe("hello world");
    expect(normalizeSearchText("¿qué tal?")).toBe("que tal");
    expect(normalizeSearchText("test@#$%^&*()")).toBe("test");
  });

  it("collapses multiple spaces", () => {
    expect(normalizeSearchText("hello    world")).toBe("hello world");
  });

  it("handles empty strings", () => {
    expect(normalizeSearchText("")).toBe("");
    expect(normalizeSearchText("   ")).toBe("");
  });
});

describe("compactSearchText", () => {
  it("removes all spaces after normalization", () => {
    expect(compactSearchText("Hello World")).toBe("helloworld");
  });

  it("handles accented text", () => {
    expect(compactSearchText("canción rápida")).toBe("cancionrapida");
  });
});

describe("buildCompactIndex", () => {
  it("builds index mapping compact chars to source positions", () => {
    const result = buildCompactIndex("Hola");
    expect(result.value).toBe("hola");
    expect(result.sourceIndexes).toEqual([0, 1, 2, 3]);
  });

  it("skips punctuation in value but tracks source positions", () => {
    const result = buildCompactIndex("Héllo!");
    expect(result.value).toBe("hello");
    expect(result.sourceIndexes).toHaveLength(5);
  });

  it("handles empty string", () => {
    const result = buildCompactIndex("");
    expect(result.value).toBe("");
    expect(result.sourceIndexes).toEqual([]);
  });
});

describe("matchesSearchText", () => {
  const query = "pollo";
  const normalizedQuery = normalizeSearchText(query);
  const compactQuery = compactSearchText(query);

  it("matches exact text", () => {
    expect(matchesSearchText("Pollo", normalizedQuery, compactQuery)).toBe(true);
  });

  it("matches text with accents", () => {
    expect(matchesSearchText("Pollo al horno", normalizedQuery, compactQuery)).toBe(true);
  });

  it("matches partial text", () => {
    expect(matchesSearchText("Pollo con verduras", normalizedQuery, compactQuery)).toBe(true);
  });

  it("does not match unrelated text", () => {
    expect(matchesSearchText("Ensalada", normalizedQuery, compactQuery)).toBe(false);
  });

  it("matches with different casing", () => {
    expect(matchesSearchText("POLLO", normalizedQuery, compactQuery)).toBe(true);
  });
});

describe("getRecipeNameSearchScore", () => {
  it("returns 100 for exact match", () => {
    expect(getRecipeNameSearchScore("Pollo al horno", "pollo al horno", "polloalhorno")).toBe(100);
  });

  it("returns 80 for prefix match", () => {
    expect(getRecipeNameSearchScore("Pollo al horno", "pollo", "pollo")).toBe(80);
  });

  it("returns 50 for substring match", () => {
    expect(getRecipeNameSearchScore("Arroz con pollo", "pollo", "pollo")).toBe(50);
  });

  it("returns 0 for no match", () => {
    expect(getRecipeNameSearchScore("Ensalada", "pollo", "pollo")).toBe(0);
  });

  it("handles accent-insensitive matching", () => {
    expect(getRecipeNameSearchScore("Pollo", "pollo", "pollo")).toBe(100);
  });
});
