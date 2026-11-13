"use client";

/**
 * Language state for the whole app (F13).
 *
 * `localStorage` is an external store, so it is read through
 * `useSyncExternalStore` rather than by setting state from an effect. The
 * server snapshot is always English, which matches the HTML Next.js sends, so
 * there is no hydration mismatch; the stored preference is picked up on the
 * client's first commit. The choice is mirrored onto `<html lang>` so screen
 * readers announce Bangla with a Bangla voice.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { translate, type Lang, type StringKey } from "./i18n";

const STORAGE_KEY = "floodwatch.lang";

// ---- the tiny store ------------------------------------------------------

const listeners = new Set<() => void>();
let snapshot: Lang | null = null;

function read(): Lang {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "bn" ? "bn" : "en";
  } catch {
    // Private mode or blocked storage - English is a fine default.
    return "en";
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab changing the language should change this one too.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      snapshot = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Cached so repeated reads return a stable value, as the hook requires. */
function getSnapshot(): Lang {
  snapshot ??= read();
  return snapshot;
}

function getServerSnapshot(): Lang {
  return "en";
}

function write(next: Lang): void {
  snapshot = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Not fatal: the toggle still works for this session.
  }
  for (const listener of listeners) listener();
}

// ---- context -------------------------------------------------------------

interface LanguageValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggle: () => void;
  t: (key: StringKey, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dataset.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => write(next), []);

  const value = useMemo<LanguageValue>(
    () => ({
      lang,
      setLang,
      toggle: () => setLang(lang === "en" ? "bn" : "en"),
      t: (key, vars) => translate(key, lang, vars),
    }),
    [lang, setLang],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used inside <LanguageProvider>");
  }
  return ctx;
}
