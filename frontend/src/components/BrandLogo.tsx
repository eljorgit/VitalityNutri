interface BrandLogoProps {
  className?: string;
  alt?: string;
}

export default function BrandLogo({ className = "w-8 h-8", alt = "VitalityNutri" }: BrandLogoProps) {
  return (
    <img
      src="/icons/app_icon.png"
      alt={alt}
      draggable={false}
      className={`${className} object-contain shrink-0 select-none`}
    />
  );
}
