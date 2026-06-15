import React from "react";
import { useTranslation } from "react-i18next";

interface ImagePlaceholderProps {
  text?: string;
  icon?: string;
  className?: string;
  iconSizeClass?: string;
  textSizeClass?: string;
  animate?: boolean;
}

export default function ImagePlaceholder({
  text,
  icon = "restaurant",
  className = "",
  iconSizeClass = "text-4xl",
  textSizeClass = "text-[10px]",
  animate = false,
}: ImagePlaceholderProps) {
  const { t } = useTranslation();
  const displayText = text ?? t("general.no_image");
  return (
    <div className={`flex flex-col items-center justify-center gap-1.5 text-slate-350 dark:text-zinc-650 select-none ${className}`}>
      <span className={`material-symbols-outlined ${iconSizeClass} ${animate ? "transform group-hover:rotate-12 group-hover:scale-110 transition-transform duration-300" : ""}`}>
        {icon}
      </span>
      <span className={`${textSizeClass} font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500`}>
        {displayText}
      </span>
    </div>
  );
}
