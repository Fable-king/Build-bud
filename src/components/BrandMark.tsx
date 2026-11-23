import { useState } from "react";
import { Brain, Cpu } from "lucide-react";

export const LOGO_SRC =
  "/assets/aistudio/Screenshot_20261121_224221_Samsung_Browser_1028ff74.jpg";

interface BrandLogoProps {
  size?: "xs" | "sm" | "lg";
  className?: string;
}

export function BrandLogo({ size = "sm", className = "" }: BrandLogoProps) {
  const [imgError, setImgError] = useState(false);

  const dimensions =
    size === "lg"
      ? "w-48 h-48 sm:w-56 sm:h-56"
      : size === "xs"
      ? "w-9 h-9"
      : "w-11 h-11";

  if (imgError) {
    return (
      <div
        className={`${dimensions} ${className} rounded-xl bg-[#090A0F] border border-white/10 flex items-center justify-center gap-1 shrink-0`}
        aria-label="Build Buds logo"
      >
        <Brain
          className={
            size === "lg"
              ? "w-12 h-12 text-[#FFC800]"
              : "w-4 h-4 text-[#FFC800]"
          }
        />
        <Cpu
          className={
            size === "lg"
              ? "w-12 h-12 text-[#F01271]"
              : "w-4 h-4 text-[#F01271]"
          }
        />
      </div>
    );
  }

  return (
    <div
      className={`${dimensions} ${className} relative overflow-hidden rounded-xl bg-[#090A0F] shrink-0 flex items-center justify-center`}
    >
      <img
        src={LOGO_SRC}
        alt="Build Buds"
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className="w-full h-full object-contain"
      />
    </div>
  );
}

export function BrandWordmark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const textSize =
    size === "lg"
      ? "text-3xl sm:text-4xl"
      : size === "sm"
      ? "text-base"
      : "text-xl";

  return (
    <span
      className={`font-display font-extrabold tracking-tight leading-none whitespace-nowrap shrink-0 select-none ${textSize}`}
    >
      <span className="text-[#FFC800]">Build</span>{" "}
      <span className="text-[#F01271]">buds</span>
    </span>
  );
}
