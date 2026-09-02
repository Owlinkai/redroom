import React, { createContext, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "navy";

interface ThemeContextType {
  theme: Theme;
  toggleTheme?: () => void;
  toggleNavy?: () => void;
  setTheme?: (theme: Theme) => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (switchable) {
      const stored = localStorage.getItem("theme");
      return (stored as Theme) || defaultTheme;
    }
    return defaultTheme;
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark", "navy");
    root.classList.add(theme);
    root.dataset.theme = theme;

    if (switchable) {
      localStorage.setItem("theme", theme);
    }
  }, [theme, switchable]);

  const toggleTheme = switchable
    ? () => {
        setTheme(prev => {
          if (prev === "navy") {
            try {
              return localStorage.getItem("redroom_theme_before_navy") === "light" ? "light" : "dark";
            } catch {
              return "dark";
            }
          }
          return prev === "light" ? "dark" : "light";
        });
      }
    : undefined;

  const toggleNavy = switchable
    ? () => {
        setTheme(prev => {
          if (prev === "navy") {
            try {
              return localStorage.getItem("redroom_theme_before_navy") === "light" ? "light" : "dark";
            } catch {
              return "dark";
            }
          }
          try { localStorage.setItem("redroom_theme_before_navy", prev); } catch {}
          return "navy";
        });
      }
    : undefined;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, toggleNavy, setTheme, switchable }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
