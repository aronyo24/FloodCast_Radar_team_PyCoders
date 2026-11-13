/**
 * Inline SVG icons. Inline rather than an icon package so the demo has no
 * runtime network dependency and the bundle stays small.
 */

type IconProps = { className?: string; strokeWidth?: number };

const base = (className?: string) => ["shrink-0", className].filter(Boolean).join(" ");

/** The mark: a radar sweep over water lines. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={base(className)} fill="none">
      <circle cx="16" cy="16" r="14.2" stroke="currentColor" strokeOpacity=".28" strokeWidth="1.4" />
      <circle cx="16" cy="16" r="9" stroke="currentColor" strokeOpacity=".4" strokeWidth="1.4" />
      <path d="M16 16 16 3.2A12.8 12.8 0 0 1 27.4 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M4.6 19.6c2.6 0 2.6 2 5.2 2s2.6-2 5.2-2 2.6 2 5.2 2 2.6-2 5.2-2M4.6 24.4c2.6 0 2.6 2 5.2 2s2.6-2 5.2-2 2.6 2 5.2 2 2.6-2 5.2-2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PlayIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={base(className)} fill="currentColor">
      <path d="M8 5.2c0-.9 1-1.5 1.8-1l9 6.3c.7.5.7 1.5 0 2l-9 6.3c-.8.5-1.8-.1-1.8-1V5.2Z" />
    </svg>
  );
}

export function PauseIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={base(className)} fill="currentColor">
      <rect x="6" y="5" width="4.2" height="14" rx="1.4" />
      <rect x="13.8" y="5" width="4.2" height="14" rx="1.4" />
    </svg>
  );
}

export function ChevronLeft({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={base(className)} fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 5-7 7 7 7" />
    </svg>
  );
}

export function ChevronRight({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={base(className)} fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

export function SearchIcon({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={base(className)} fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}

export function AlertIcon({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={base(className)} fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.3 3.9 2.5 17.4A2 2 0 0 0 4.2 20.5h15.6a2 2 0 0 0 1.7-3.1L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9.3v4.2M12 17h.01" />
    </svg>
  );
}

export function CheckIcon({ className, strokeWidth = 2.4 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={base(className)} fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="m4.5 12.5 5 5 10-11" />
    </svg>
  );
}

export function InfoIcon({ className, strokeWidth = 1.9 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={base(className)} fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9.2" />
      <path d="M12 10.8v5.4M12 7.8h.01" />
    </svg>
  );
}

export function DownloadIcon({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={base(className)} fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3.5v11M7.5 10.5 12 15l4.5-4.5M4.5 19.5h15" />
    </svg>
  );
}

export function LinkIcon({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={base(className)} fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13.6a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 0 0-5.7-5.7L11.5 6.4" />
      <path d="M14 10.4a4 4 0 0 0-5.7 0l-2.8 2.8a4 4 0 0 0 5.7 5.7l1.3-1.3" />
    </svg>
  );
}

export function SatelliteIcon({ className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={base(className)} fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="m6.4 10.3 3.9-3.9 3.3 3.3-3.9 3.9z" />
      <path d="m3.6 7.5 2.8-2.8 2 2-2.8 2.8zM13.6 17.5l2.8-2.8 2 2-2.8 2.8z" />
      <path d="M14.5 13.2 17 15.7M12.6 20.4a8 8 0 0 0 7.8-7.8" />
    </svg>
  );
}

export function RefreshIcon({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={base(className)} fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20.3 4.2v4.3h-4.3" />
    </svg>
  );
}

export function LayersIcon({ className, strokeWidth = 1.9 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={base(className)} fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3.6 8.4 4.2-8.4 4.2-8.4-4.2z" />
      <path d="m3.6 12.6 8.4 4.2 8.4-4.2" />
    </svg>
  );
}

export function ArrowRight({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={base(className)} fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 12h15M13.5 6l6 6-6 6" />
    </svg>
  );
}
