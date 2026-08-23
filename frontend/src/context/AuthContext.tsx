import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { User, AuthResponse } from "../types";
import { apiFetch } from "../utils/api";

interface AuthCapabilities {
  googleEnabled: boolean;
  appleEnabled: boolean;
  demoEnabled: boolean;
}

interface AuthContextType {
  user: User | null;
  appMode: "Oss" | "SaaS";
  isOssMode: boolean;
  authCapabilities: AuthCapabilities;
  isAuthenticated: boolean;
  isLoading: boolean;
  isDemo: boolean;
  login: (email: string, password: string) => Promise<AuthResponse>;
  register: (email: string, password: string, firstName: string, surname: string) => Promise<AuthResponse>;
  demoLogin: () => Promise<AuthResponse>;
  googleLogin: (idToken: string) => Promise<AuthResponse>;
  appleLogin: (idToken: string, fullName?: string) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [appMode, setAppMode] = useState<"Oss" | "SaaS">("SaaS");
  const [authCapabilities, setAuthCapabilities] = useState<AuthCapabilities>({
    googleEnabled: false,
    appleEnabled: false,
    demoEnabled: true,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 1. Detect platform mode and capabilities from /api/app-info or config.js
  const detectPlatformMode = useCallback(async () => {
    let detectedMode: "Oss" | "SaaS" = "SaaS";

    // First check window config or environment variable
    if (typeof window !== "undefined" && window.__VITALITYNUTRI_CONFIG__?.appMode) {
      const modeStr = window.__VITALITYNUTRI_CONFIG__.appMode.toLowerCase();
      if (modeStr === "oss") {
        detectedMode = "Oss";
      }
    } else if (import.meta.env.VITE_APP_MODE) {
      const envMode = String(import.meta.env.VITE_APP_MODE).toLowerCase();
      if (envMode === "oss") {
        detectedMode = "Oss";
      }
    }

    try {
      const infoRes = await apiFetch("/api/app-info");
      if (infoRes.ok) {
        const infoData = await infoRes.json();
        if (infoData.mode && (infoData.mode === "Oss" || infoData.mode === "SaaS")) {
          detectedMode = infoData.mode;
        }
        if (infoData.auth) {
          setAuthCapabilities({
            googleEnabled: Boolean(infoData.auth.googleEnabled),
            appleEnabled: Boolean(infoData.auth.appleEnabled),
            demoEnabled: Boolean(infoData.auth.demoEnabled),
          });
        }
      }
    } catch {
      // Fall back to detected mode from config
    }

    setAppMode(detectedMode);
    return detectedMode;
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const currentMode = await detectPlatformMode();

      // If running in OSS mode, zero-auth is enabled by design: no /api/auth/me required
      if (currentMode === "Oss") {
        setUser(null);
        setIsLoading(false);
        return;
      }

      // In SaaS mode, verify session cookie or bearer token
      const res = await apiFetch("/api/auth/me");
      if (res.ok) {
        const userData: User = await res.json();
        setUser(userData);
      } else {
        setUser(null);
        if (typeof window !== "undefined") {
          localStorage.removeItem("vitality_token");
          localStorage.removeItem("vitality_refresh_token");
        }
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [detectPlatformMode]);

  const initializationRef = React.useRef<boolean>(false);

  useEffect(() => {
    if (!initializationRef.current) {
      initializationRef.current = true;
      refreshUser();
    }

    // Security event listener: when a 401 is received from any protected endpoint, reset auth state
    const handleUnauthorized = () => {
      setUser(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("vitality_token");
        localStorage.removeItem("vitality_refresh_token");
        sessionStorage.removeItem("demo_completed_recipes");
        sessionStorage.removeItem("demo_grocery_state");
      }
    };

    window.addEventListener("vitality_unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("vitality_unauthorized", handleUnauthorized);
    };
  }, [refreshUser]);

  const handleAuthSuccess = (data: AuthResponse) => {
    if (typeof window !== "undefined") {
      if (data.token) {
        localStorage.setItem("vitality_token", data.token);
      }
      if (data.refreshToken) {
        localStorage.setItem("vitality_refresh_token", data.refreshToken);
      }
    }
    setUser(data.user);
    return data;
  };

  const login = async (email: string, password: string): Promise<AuthResponse> => {
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ detail: "Login failed" }));
      throw new Error(errorData.detail || errorData.message || "Invalid credentials");
    }

    const data: AuthResponse = await res.json();
    return handleAuthSuccess(data);
  };

  const register = async (email: string, password: string, firstName: string, surname: string): Promise<AuthResponse> => {
    const res = await apiFetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, firstName, surname }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ detail: "Registration failed" }));
      throw new Error(errorData.detail || errorData.message || "Registration failed");
    }

    const data: AuthResponse = await res.json();
    return handleAuthSuccess(data);
  };

  const demoLogin = async (): Promise<AuthResponse> => {
    const res = await apiFetch("/api/auth/demo-login", {
      method: "POST",
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ detail: "Demo login failed" }));
      throw new Error(errorData.detail || errorData.message || "Demo login failed");
    }

    const data: AuthResponse = await res.json();
    return handleAuthSuccess(data);
  };

  const googleLogin = async (idToken: string): Promise<AuthResponse> => {
    const res = await apiFetch("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ detail: "Google login failed" }));
      throw new Error(errorData.detail || errorData.message || "Google login failed");
    }

    const data: AuthResponse = await res.json();
    return handleAuthSuccess(data);
  };

  const appleLogin = async (idToken: string, fullName?: string): Promise<AuthResponse> => {
    const res = await apiFetch("/api/auth/apple", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, fullName }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ detail: "Apple login failed" }));
      throw new Error(errorData.detail || errorData.message || "Apple login failed");
    }

    const data: AuthResponse = await res.json();
    return handleAuthSuccess(data);
  };

  const logout = async (): Promise<void> => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("vitality_token");
        localStorage.removeItem("vitality_refresh_token");
        sessionStorage.removeItem("demo_completed_recipes");
        sessionStorage.removeItem("demo_grocery_state");
        if (window.location.pathname !== "/") {
          window.history.pushState(null, "", "/");
        }
      }
      setUser(null);
    }
  };

  const isOssMode = appMode === "Oss";
  const isDemo = Boolean(user && (user.isDemo || user.role === "Demo"));
  // In OSS mode: always authenticated as local user. In SaaS mode: requires user profile.
  const isAuthenticated = isOssMode || Boolean(user);

  return (
    <AuthContext.Provider
      value={{
        user,
        appMode,
        isOssMode,
        authCapabilities,
        isAuthenticated,
        isLoading,
        isDemo,
        login,
        register,
        demoLogin,
        googleLogin,
        appleLogin,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
