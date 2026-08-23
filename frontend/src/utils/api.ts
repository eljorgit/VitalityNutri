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
 */
export function apiUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}${cleanPath}`;
}

function getRequestTimeoutMs(): number {
  const raw = import.meta.env.VITE_API_TIMEOUT_MS;
  const parsed = typeof raw === "string" ? Number(raw) : Number(raw);
  if (Number.isFinite(parsed) && parsed >= 1000) {
    return parsed;
  }
  return 12000;
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), getRequestTimeoutMs());

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

/**
 * Silent session refresh: exchanges the stored refresh token for a fresh JWT.
 * Concurrent 401s share a single in-flight refresh attempt.
 */
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const refreshToken = localStorage.getItem("vitality_refresh_token");
        if (!refreshToken) return false;
        const res = await fetchWithTimeout(apiUrl("/api/auth/refresh"), {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Accept-Language": i18n.language || "en",
          },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) {
          localStorage.removeItem("vitality_refresh_token");
          return false;
        }
        const data = await res.json();
        if (data.token) localStorage.setItem("vitality_token", data.token);
        if (data.refreshToken) localStorage.setItem("vitality_refresh_token", data.refreshToken);
        return Boolean(data.token);
      } catch {
        return false;
      } finally {
        setTimeout(() => {
          refreshPromise = null;
        }, 0);
      }
    })();
  }
  return refreshPromise;
}

/**
 * Performs a fetch request with credentials, Accept-Language, and Bearer token fallback.
 * On 401 it silently refreshes the session once and retries the original request.
 */
export async function apiFetch(path: string, init?: RequestInit, opts?: { _retried?: boolean }): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Accept-Language")) {
    headers.set("Accept-Language", i18n.language || "en");
  }

  if (typeof window !== "undefined") {
    const token = localStorage.getItem("vitality_token");
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetchWithTimeout(apiUrl(path), {
    credentials: "include",
    ...init,
    headers,
  });

  const isAuthEndpoint =
    path.includes("/api/auth/login") ||
    path.includes("/api/auth/register") ||
    path.includes("/api/auth/demo-login") ||
    path.includes("/api/auth/google") ||
    path.includes("/api/auth/apple") ||
    path.includes("/api/auth/me") ||
    path.includes("/api/auth/refresh") ||
    path.includes("/api/auth/verify-email-change");

  // Zero-Trust Security Interceptor: if a protected endpoint returns 401, dispatch unauthorized event
  if (response.status === 401 && typeof window !== "undefined" && !isAuthEndpoint) {
    if (!opts?._retried && (await tryRefreshSession())) {
      return apiFetch(path, init, { _retried: true });
    }
    window.dispatchEvent(new CustomEvent("vitality_unauthorized"));
  }

  return response;
}
