"use client";

/**
 * The signed-in BMD officer, shared by the header and the portal pages.
 * Fetched once on load; sign-in, registration and sign-out update it in place.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { BmdOfficer, BmdSession } from "@/types/bmd";

import { bmdLogout, bmdMe } from "./bmd";

interface OfficerValue {
  officer: BmdOfficer | null;
  /** True until the first /api/bmd/me/ answer arrives. */
  loading: boolean;
  setSession: (session: BmdSession) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const OfficerContext = createContext<OfficerValue | null>(null);

export function OfficerProvider({ children }: { children: ReactNode }) {
  const [officer, setOfficer] = useState<BmdOfficer | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const s = await bmdMe();
      setOfficer(s.authenticated ? s.officer : null);
    } catch {
      setOfficer(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    bmdMe()
      .then((s) => alive && setOfficer(s.authenticated ? s.officer : null))
      .catch(() => alive && setOfficer(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const setSession = useCallback((s: BmdSession) => {
    setOfficer(s.authenticated ? s.officer : null);
    setLoading(false);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await bmdLogout();
    } finally {
      setOfficer(null);
    }
  }, []);

  const value = useMemo(
    () => ({ officer, loading, setSession, refresh, signOut }),
    [officer, loading, setSession, refresh, signOut],
  );
  return <OfficerContext.Provider value={value}>{children}</OfficerContext.Provider>;
}

export function useOfficer(): OfficerValue {
  const ctx = useContext(OfficerContext);
  if (!ctx) throw new Error("useOfficer must be used inside <OfficerProvider>");
  return ctx;
}
