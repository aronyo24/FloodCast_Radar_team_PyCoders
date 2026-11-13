"use client";

/**
 * The small "i" next to a number.
 *
 * The acceptance checklist says every number on screen must have a source line
 * or a tooltip explaining it, and that the keyboard must be able to reach the
 * controls. A hover-only tooltip fails both touch and keyboard, so this is a
 * real button: click or Enter toggles, Escape closes, and the panel is wired up
 * with aria-describedby.
 */

import { useEffect, useId, useRef, useState } from "react";

import { InfoIcon } from "./Icons";

export function InfoTip({
  label,
  className = "",
  align = "end",
}: {
  label: string;
  className?: string;
  /** Which edge the panel lines up with, so it never leaves the viewport. */
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <span ref={wrap} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="grid size-6 place-items-center rounded-full text-text-faint transition
                   hover:bg-ink-600 hover:text-text focus-visible:text-text"
      >
        <InfoIcon className="size-[15px]" />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className={`pointer-events-none absolute top-[calc(100%+8px)] z-50 w-64 rounded-xl border
                      border-ink-500 bg-ink-850/98 p-3 text-[12px] leading-relaxed text-text-dim
                      shadow-[0_22px_46px_-22px_#000] backdrop-blur fw-enter
                      ${align === "end" ? "right-0" : "left-0"}`}
        >
          {label}
        </span>
      )}
    </span>
  );
}
