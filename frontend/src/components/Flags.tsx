import React from "react";
import ES from "country-flag-icons/react/3x2/ES";
import GB from "country-flag-icons/react/3x2/GB";

interface FlagProps {
  className?: string;
  title?: string;
}

export function SpainFlag({ className = "w-6 h-4", title = "Español" }: FlagProps) {
  return (
    <span title={title} className={`inline-block rounded-xs shadow-xs shrink-0 overflow-hidden ${className}`}>
      <ES />
    </span>
  );
}

export function UKFlag({ className = "w-6 h-4", title = "English" }: FlagProps) {
  return (
    <span title={title} className={`inline-block rounded-xs shadow-xs shrink-0 overflow-hidden ${className}`}>
      <GB />
    </span>
  );
}

export { ES, GB };
