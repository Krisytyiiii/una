"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";

/**
 * Appearance is intentionally fixed to light. The product is a single, calm
 * cream/ink surface and the old light/dark/system switch was removed so the
 * workspace, charts, and printed records always read the same way.
 *
 * `useTheme` is kept as a compatible read-only surface because the chart and
 * calendar components use `resolvedTheme` to pick their tick/grid colours.
 * They now always receive "light".
 */
export type ThemeMode = "light";
export type ResolvedTheme = "light";

/** Legacy key. Cleared on mount so previously-saved dark preferences die. */
export const THEME_STORAGE_KEY = "chekie-theme";

type ThemeContextValue = {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemeMode) => void;
};

const NOOP = () => {};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Defensive cleanup: a stale `.dark` class or saved preference from an older
  // build would otherwise keep the old palette on screen.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark");
    root.dataset.theme = "light";
    root.style.colorScheme = "light";
    try {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } catch {
      // Storage can be blocked in private mode; forcing the class is enough.
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme: "light", resolvedTheme: "light", setTheme: NOOP }),
    []
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a <ThemeProvider />");
  return context;
}
