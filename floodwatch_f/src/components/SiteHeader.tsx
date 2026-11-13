"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useLanguage } from "@/lib/language";
import { useOfficer } from "@/lib/officer";

import { AlertSignup } from "./AlertSignup";
import { DistrictSearch } from "./DistrictSearch";
import { Logo } from "./Icons";
import { LanguageToggle } from "./LanguageToggle";

const NAV = [
  { href: "/explorer", key: "nav.explorer" },
  { href: "/bmd", key: "nav.bmd" },
  { href: "/how-it-works", key: "nav.howItWorks" },
  { href: "/about", key: "nav.about" },
] as const;

export function SiteHeader() {
  const { t } = useLanguage();
  const { officer } = useOfficer();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the drawer whenever the route changes (back button, search result, ...).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMenuOpen(false);
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 border-b border-ink-700/80 bg-ink-900/85 backdrop-blur-md">
      <div className="shell flex h-16 items-center gap-3">
        <Link href="/" className="group flex shrink-0 items-center gap-2.5" aria-label={t("app.name")}>
          <Logo className="size-8 text-accent transition group-hover:text-sky-300" />
          <span className="hidden text-[15px] font-extrabold tracking-tight text-text sm:block">
            FloodCast<span className="text-accent"> Radar</span>
          </span>
        </Link>

        {/* Desktop: full nav. Below lg there is not room for four links plus search. */}
        <nav aria-label="Main" className="ml-2 hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={`whitespace-nowrap rounded-full px-3 py-2 text-[13px] font-semibold transition
                          ${isActive(item.href) ? "bg-ink-700 text-text" : "text-text-dim hover:bg-ink-800 hover:text-text"}`}
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
          <div className="hidden sm:block">
            <DistrictSearch />
          </div>
          <div className="hidden sm:block">
            <AlertSignup />
          </div>
          {officer && (
            <Link
              href="/bmd/"
              title={`${officer.name} · ${officer.designation}`}
              className="hidden size-9 shrink-0 place-items-center rounded-full border border-accent/60 bg-accent/15
                         text-[12px] font-extrabold text-accent transition hover:bg-accent/25 xl:grid"
            >
              {initials(officer.name)}
            </Link>
          )}
          <LanguageToggle />
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            aria-label={t("nav.menu")}
            onClick={() => setMenuOpen((v) => !v)}
            className="tap grid place-items-center rounded-full border border-ink-600 bg-ink-850/80 px-3 lg:hidden"
          >
            <span aria-hidden className="flex flex-col gap-[4px]">
              <span className={`block h-0.5 w-4 rounded bg-text-dim transition ${menuOpen ? "translate-y-[6px] rotate-45" : ""}`} />
              <span className={`block h-0.5 w-4 rounded bg-text-dim transition ${menuOpen ? "opacity-0" : ""}`} />
              <span className={`block h-0.5 w-4 rounded bg-text-dim transition ${menuOpen ? "-translate-y-[6px] -rotate-45" : ""}`} />
            </span>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div id="site-menu" className="border-t border-ink-700 bg-ink-850 lg:hidden fw-enter">
          <div className="shell space-y-3 py-4">
            <div className="sm:hidden">
              <DistrictSearch compact />
            </div>
            <nav aria-label="Main" className="grid gap-1 sm:grid-cols-2">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={`tap flex items-center rounded-lg px-3 text-sm font-semibold transition
                              ${isActive(item.href) ? "bg-ink-700 text-text" : "text-text-dim hover:bg-ink-800"}`}
                >
                  {t(item.key)}
                </Link>
              ))}
            </nav>
            {officer && (
              <p className="border-t border-ink-700 pt-3 text-[12px] text-text-faint">
                {t("bmd.signedInAs")} <span className="font-bold text-text">{officer.name}</span>
              </p>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
