const IS_DEV = typeof process !== "undefined"
  ? process.env.NODE_ENV !== "production"
  : true;

const logStyles = {
  info: "color: #3b82f6; font-weight: bold;",
  warn: "color: #f59e0b; font-weight: bold;",
  error: "color: #ef4444; font-weight: bold;",
  success: "color: #10b981; font-weight: bold;",
};

function shouldLog(level: "debug" | "info" | "warn" | "error"): boolean {
  if (level === "error") return true;
  if (IS_DEV) return true;
  return level === "warn";
}

export const logger = {
  debug: (...args: any[]) => {
    if (shouldLog("debug")) {
      if (typeof window !== "undefined") {
        console.debug("%c[DEBUG]", logStyles.info, ...args);
      } else {
        console.debug("[DEBUG]", ...args);
      }
    }
  },

  info: (...args: any[]) => {
    if (shouldLog("info")) {
      if (typeof window !== "undefined") {
        console.info("%c[INFO]", logStyles.info, ...args);
      } else {
        console.info("[INFO]", ...args);
      }
    }
  },

  warn: (...args: any[]) => {
    if (shouldLog("warn")) {
      if (typeof window !== "undefined") {
        console.warn("%c[WARN]", logStyles.warn, ...args);
      } else {
        console.warn("[WARN]", ...args);
      }
    }
  },

  error: (...args: any[]) => {
    if (shouldLog("error")) {
      if (typeof window !== "undefined") {
        console.error("%c[ERROR]", logStyles.error, ...args);
      } else {
        console.error("[ERROR]", ...args);
      }
    }
  },
};
