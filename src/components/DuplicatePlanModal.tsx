import React, { useEffect } from "react";

interface DuplicatePlanModalProps {
  isOpen: boolean;
  fileName: string;
  isActive: boolean;
  onUseExisting: () => void;
  onReprocess: () => void;
  onCancel: () => void;
}

export default function DuplicatePlanModal({
  isOpen,
  fileName,
  isActive,
  onUseExisting,
  onReprocess,
  onCancel
}: DuplicatePlanModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in no-print !mt-0"
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-modal-title"
      style={{ marginTop: 0 }}
    >
      <div className="w-full max-w-md rounded-3xl border border-gray-100 bg-white p-6 text-center shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 transition-all transform duration-350 scale-100 animate-scale-up">
        {/* Animated Icon Container */}
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-100 bg-amber-50 text-amber-600 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-400 animate-pulse">
          <span className="material-symbols-outlined text-[30px]" style={{ fontVariationSettings: "'FILL' 0" }}>
            content_copy
          </span>
        </div>

        {/* Modal Header */}
        <h3 id="duplicate-modal-title" className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          Plan ya existente
        </h3>
        
        {/* File Details Tag */}
        <div className="mt-3.5 px-3 py-2 bg-slate-50 dark:bg-zinc-950/45 rounded-xl border border-slate-100 dark:border-zinc-850 inline-flex items-center gap-2 max-w-full">
          <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">picture_as_pdf</span>
          <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300 truncate max-w-[280px]" title={fileName}>
            {fileName}
          </span>
        </div>

        {/* Modal Body Description */}
        <p className="mt-4 text-sm leading-relaxed text-gray-500 dark:text-zinc-400">
          {isActive ? (
            <>
              Este plan de alimentación ya está configurado como tu <strong>plan activo actual</strong>. No es necesario procesarlo nuevamente con IA.
            </>
          ) : (
            <>
              Se ha detectado que este plan ya fue subido y analizado con anterioridad y se encuentra guardado en tu historial.
            </>
          )}
        </p>

        {/* Modal Footer / Options Stack */}
        <div className="mt-6 flex flex-col gap-3">
          {/* Option 1: Use Existing (Only if NOT active) */}
          {!isActive && (
            <button
              type="button"
              onClick={onUseExisting}
              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white py-3 px-4 text-sm font-bold shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 focus:outline-none focus:ring-4 focus:ring-emerald-500/20"
            >
              <span className="material-symbols-outlined text-[18px]">history</span>
              Usar este plan (Restaurar)
            </button>
          )}

          {/* Option 2 & 3 Grid */}
          <div className={`grid grid-cols-1 gap-3 ${!isActive ? "grid-cols-2" : "grid-cols-2"}`}>
            <button
              type="button"
              onClick={onReprocess}
              className="rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 py-2.5 px-4 text-sm font-bold transition-all cursor-pointer active:scale-[0.98] flex items-center justify-center gap-1.5 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300 dark:hover:bg-amber-950/40 focus:outline-none focus:ring-4 focus:ring-amber-500/15"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
              Reprocesar
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 py-2.5 px-4 text-sm font-bold transition-all cursor-pointer active:scale-[0.98] flex items-center justify-center gap-1.5 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-350 dark:hover:bg-zinc-800 focus:outline-none focus:ring-4 focus:ring-gray-500/10"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
