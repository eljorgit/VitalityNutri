export type SiteVisibility = "public" | "local";

export function getSiteVisibility(): SiteVisibility {
  if (typeof window !== "undefined" && window.__VITALITYNUTRI_CONFIG__?.siteVisibility === "public") {
    return "public";
  }
  return "local";
}

export function getShareWarning(t: (key: string) => string): string | null {
  if (getSiteVisibility() === "public") return null;
  return t("general.share_local_warning");
}
