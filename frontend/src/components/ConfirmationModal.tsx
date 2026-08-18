import React, { useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";

export type ConfirmationVariant = "danger" | "warning" | "success" | "info";

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  cancelLabel?: string;
  icon?: string;
  showCancel?: boolean;
  variant?: ConfirmationVariant;
}

const variantStyles: Record<ConfirmationVariant, { icon: string; confirm: string }> = {
  danger: {
    icon: "bg-red-50 text-red-700 border-red-100 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/40",
    confirm: "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500/30"
  },
  warning: {
    icon: "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/40",
    confirm: "bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500/30"
  },
  success: {
    icon: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/40",
    confirm: "bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-500/30"
  },
  info: {
    icon: "bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-900/40",
    confirm: "bg-sky-600 hover:bg-sky-700 text-white focus:ring-sky-500/30"
  }
};

export default function ConfirmationModal({
  isOpen,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  cancelLabel,
  icon = "warning",
  showCancel = true,
  variant = "danger"
}: ConfirmationModalProps) {
  const { t } = useTranslation();
  const resolvedCancelLabel = cancelLabel ?? t("general.cancel");
  const modalRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!modalRef.current) return [];
    return Array.from(
      modalRef.current.querySelectorAll<HTMLElement>(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
      )
    );
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    prevFocusRef.current = document.activeElement as HTMLElement;
    const timer = setTimeout(() => {
      const focusables = getFocusableElements();
      if (focusables.length > 0) focusables[0].focus();
    }, 50);
    return () => {
      clearTimeout(timer);
      prevFocusRef.current?.focus();
      prevFocusRef.current = null;
    };
  }, [isOpen, getFocusableElements]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
        return;
      }
      if (event.key === "Tab") {
        const focusables = getFocusableElements();
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel, getFocusableElements]);

  if (!isOpen) return null;

  const styles = variantStyles[variant];

  return (
    <div
      className="modal-overlay fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in no-print !mt-0"
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-modal-title"
      style={{ marginTop: 0 }}
    >
      <div className="w-full max-w-md rounded-3xl border border-gray-100 bg-white p-6 text-center shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border ${styles.icon}`}>
          <span className="material-symbols-outlined text-[30px]">{icon}</span>
        </div>

        <h3 id="confirmation-modal-title" className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-zinc-400">
          {description}
        </p>

        <div className={`mt-6 grid grid-cols-1 gap-3 ${showCancel ? "sm:grid-cols-2" : ""}`}>
          {showCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-500/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
            >
              {resolvedCancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-colors focus:outline-none focus:ring-4 cursor-pointer ${styles.confirm}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
