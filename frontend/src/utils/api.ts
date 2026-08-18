/**
 * API client utilities for resolving API URLs and performing requests.
 * Supports both relative local paths (/api/...) and dedicated cross-origin
 * production subdomains (https://api.vitalitynutri.com/api/...).
 */

export function getApiBaseUrl(): string {
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
 * Performs a fetch request using the resolved API endpoint.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), init);
}
