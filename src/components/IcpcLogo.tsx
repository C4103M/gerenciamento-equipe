import { cn } from "@/lib/utils";

const SIZE_MAP = {
  sm: "h-7 w-7",
  md: "h-10 w-10",
  lg: "h-14 w-14",
} as const;

/**
 * Emblema inspirado nos 3 balões icônicos da ICPC (Azul, Ouro e Vermelho).
 */
export function IcpcBalloonsMark({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn(SIZE_MAP[size], "shrink-0", className)}
    >
      {/* Strings */}
      <path
        d="M19 37C19 45 23 50 26 57"
        stroke="#60A5FA"
        strokeOpacity="0.65"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M45 37C45 45 41 50 38 57"
        stroke="#F87171"
        strokeOpacity="0.65"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M32 34C32 43 32 50 32 58"
        stroke="#FACC15"
        strokeOpacity="0.75"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Left Blue Balloon */}
      <ellipse cx="19" cy="24" rx="11.5" ry="13.5" fill="url(#icpcBlue)" />
      <polygon points="19,37 16.8,39.5 21.2,39.5" fill="#2563EB" />
      <ellipse
        cx="15"
        cy="19"
        rx="3"
        ry="5.2"
        transform="rotate(-18 15 19)"
        fill="white"
        fillOpacity="0.28"
      />

      {/* Right Red Balloon */}
      <ellipse cx="45" cy="24" rx="11.5" ry="13.5" fill="url(#icpcRed)" />
      <polygon points="45,37 42.8,39.5 47.2,39.5" fill="#DC2626" />
      <ellipse
        cx="41"
        cy="19"
        rx="3"
        ry="5.2"
        transform="rotate(-18 41 19)"
        fill="white"
        fillOpacity="0.26"
      />

      {/* Center Gold Balloon (Foreground) */}
      <ellipse cx="32" cy="19.5" rx="12.5" ry="14.5" fill="url(#icpcGold)" />
      <polygon points="32,33.8 29.5,36.6 34.5,36.6" fill="#CA8A04" />
      <ellipse
        cx="27.5"
        cy="14"
        rx="3.3"
        ry="5.6"
        transform="rotate(-18 27.5 14)"
        fill="white"
        fillOpacity="0.34"
      />

      <defs>
        <linearGradient id="icpcBlue" x1="10" y1="10" x2="28" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#60A5FA" />
          <stop offset="1" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient id="icpcRed" x1="36" y1="10" x2="54" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F87171" />
          <stop offset="1" stopColor="#B91C1C" />
        </linearGradient>
        <linearGradient id="icpcGold" x1="22" y1="5" x2="42" y2="35" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE047" />
          <stop offset="1" stopColor="#CA8A04" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** Barra tricolor clássica da ICPC (Azul / Ouro / Vermelho). */
export function IcpcTricolorBar({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("grid h-1 w-full grid-cols-3 overflow-hidden", className)}
    >
      <span className="bg-blue-500" />
      <span className="bg-amber-400" />
      <span className="bg-red-500" />
    </div>
  );
}
