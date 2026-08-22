import i18n from "../i18n/config";

/**
 * API client utilities for resolving API URLs and performing requests.
 * Supports both relative local paths (/api/...) and dedicated cross-origin
 * production subdomains (https://api.vitalitynutri.com/api/...).
 */

export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const userOverride = localStorage.getItem("vitalitynutri_api_url");
    if (userOverride && userOverride.trim()) {
      return userOverride.trim().replace(/\/+$/, "");
    }
  }

  if (typeof window !== "undefined" && window.__VITALITYNUTRI_CONFIG__?.apiUrl) {
    return window.__VITALITYNUTRI_CONFIG__.apiUrl.replace(/\/+$/, "");
  }

  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && typeof envUrl === "string") {
    return envUrl.replace(/\/+$/, "");
  }

  return "";
}

/**
 * Builds the full URL for a given API path.
 * Example:
 *   apiUrl('/api/recipes') -> '/api/recipes' (locally)
 *   apiUrl('/api/recipes') -> 'https://api.vitalitynutri.com/api/recipes' (with custom VITE_API_URL)
 */
export function apiUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}${cleanPath}`;
}

/**
 * Performs a fetch request using the resolved API endpoint and attaches Accept-Language.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Accept-Language")) {
    headers.set("Accept-Language", i18n.language || "en");
  }

  return fetch(apiUrl(path), {
    ...init,
    headers,
  });
}
