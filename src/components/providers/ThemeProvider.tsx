"use client";

import * as React from "react";

type ThemeMode = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemeMode) => void;
}

interface ThemeProviderProps {
  children: React.ReactNode;
  attribute?: "class";
  defaultTheme?: ThemeMode;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
}

const STORAGE_KEY = "quantvn-theme";
const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  enableSystem = true,
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<ThemeMode>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>("light");

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const initialTheme = normalizeThemeMode(stored) ?? defaultTheme;
    setThemeState(initialTheme);
  }, [defaultTheme]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const updateResolvedTheme = () => {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      const nextResolved = theme === "system" ? (enableSystem ? systemTheme : "light") : theme;
      setResolvedTheme(nextResolved);
      document.documentElement.classList.toggle("dark", nextResolved === "dark");
    };

    updateResolvedTheme();

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onMediaChange = () => updateResolvedTheme();
    media.addEventListener("change", onMediaChange);
    return () => media.removeEventListener("change", onMediaChange);
  }, [theme, enableSystem]);

  const setTheme = React.useCallback((nextTheme: ThemeMode) => {
    setThemeState(nextTheme);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, nextTheme);
    }
  }, []);

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
    }),
    [theme, resolvedTheme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

function normalizeThemeMode(value: string | null): ThemeMode | null {
  if (value === "light" || value === "dark" || value === "system") return value;
  return null;
}
