"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Variant = "full" | "icon" | "animated";

interface NudgeLogoProps {
  variant?: Variant;
  size?: number;
  urgent?: boolean;
  className?: string;
}

/**
 * The Nudge owl — an original, minimal geometric owl.
 * - lavender→violet gradient body, big circular eyes with amber pupils,
 *   small feather-tuft ears.
 * - The pupils follow the pointer when the logo is used as a small welcome touch.
 */
export function OwlMark({
  size = 40,
  urgent = false,
  blinking = false,
  speaking = false,
  gaze,
  className,
}: {
  size?: number;
  /** Tints the eyes amber, used only when something urgent was found. */
  urgent?: boolean;
  /** Slow blink while an agent is working. */
  blinking?: boolean;
  animated?: boolean;
  /** Small beak open/close while Nudge is talking. */
  speaking?: boolean;
  /** Fixed pupil offset (each axis -1.5…1.5), e.g. looking up while thinking. Overrides the pointer. */
  gaze?: { x: number; y: number };
  className?: string;
}) {
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const uid = urgent ? "u" : "n";
  const look = gaze ?? pointer;
  const pupilTransform = `translate(${look.x} ${look.y})`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label="Nudge owl"
      className={className}
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setPointer({
          x: Math.max(-1.5, Math.min(1.5, ((event.clientX - rect.left) / rect.width - 0.5) * 3)),
          y: Math.max(-1.5, Math.min(1.5, ((event.clientY - rect.top) / rect.height - 0.5) * 3)),
        });
      }}
    >
      <defs>
        <linearGradient id={`owl-body-${uid}`} x1="12" y1="6" x2="52" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A79BFF" />
          <stop offset="0.55" stopColor="#6D5BF6" />
          <stop offset="1" stopColor="#4C5BD4" />
        </linearGradient>
        <linearGradient id={`owl-belly-${uid}`} x1="32" y1="26" x2="32" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1A2250" stopOpacity="0.55" />
          <stop offset="1" stopColor="#1A2250" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* feather-tuft ears */}
      <path d="M17 13 L23 5 L26 16 Z" fill={`url(#owl-body-${uid})`} />
      <path d="M47 13 L41 5 L38 16 Z" fill={`url(#owl-body-${uid})`} />

      {/* body / head */}
      <path
        d="M32 8 C46 8 54 18 54 33 C54 49 45 58 32 58 C19 58 10 49 10 33 C10 18 18 8 32 8 Z"
        fill={`url(#owl-body-${uid})`}
      />
      {/* soft belly shading */}
      <path
        d="M32 26 C41 26 47 33 47 44 C47 52 40 57 32 57 C24 57 17 52 17 44 C17 33 23 26 32 26 Z"
        fill={`url(#owl-belly-${uid})`}
      />

      {/* eyes */}
      <g className={cn("transition-transform duration-150", blinking && "owl-blink")}>
        <circle cx="24" cy="28" r="9.5" fill={urgent ? "#FDE68A" : "#EEF0FF"} className="transition-[fill] duration-500" />
        <circle cx="40" cy="28" r="9.5" fill={urgent ? "#FDE68A" : "#EEF0FF"} className="transition-[fill] duration-500" />
        <circle
          cx="24"
          cy="28"
          r="4.6"
          fill={urgent ? "#D97706" : "#FBBF24"}
          transform={pupilTransform}
        />
        <circle
          cx="40"
          cy="28"
          r="4.6"
          fill={urgent ? "#D97706" : "#FBBF24"}
          transform={pupilTransform}
        />
        <circle cx="25.6" cy="26.4" r="1.4" fill="#0A0F25" opacity="0.6" transform={pupilTransform} />
        <circle cx="41.6" cy="26.4" r="1.4" fill="#0A0F25" opacity="0.6" transform={pupilTransform} />
      </g>

      {/* beak */}
      <path d="M32 33 L35.4 38 L28.6 38 Z" fill="#FBBF24" opacity="0.9" className={cn(speaking && "owl-speak")} />
    </svg>
  );
}

export function NudgeLogo({ variant = "full", size = 40, urgent = false, className }: NudgeLogoProps) {
  if (variant === "full") {
    return (
      <div className={cn("flex items-center gap-2.5", className)}>
        <OwlMark size={size} urgent={urgent} />
        <span
          className="text-[1.45rem] font-extrabold tracking-tight"
          style={{
            background: "linear-gradient(90deg, #EEF0FF, #A79BFF)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Nudge
        </span>
      </div>
    );
  }
  return <OwlMark size={size} urgent={urgent} animated={variant === "animated"} className={className} />;
}
