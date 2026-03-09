"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  mounted: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

interface ThemeProviderProps {
  children: ReactNode;
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  // Tailwind dark: prefix 호환을 위해 .dark 클래스도 동시 적용
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("theme") as Theme | null;
      if (savedTheme) {
        setThemeState(savedTheme);
        applyTheme(savedTheme);
      } else {
        const prefersDark = window.matchMedia(
          "(prefers-color-scheme: dark)"
        ).matches;
        const defaultTheme = prefersDark ? "dark" : "light";
        setThemeState(defaultTheme);
        applyTheme(defaultTheme);
      }
    } catch (error) {
      console.error("[ThemeProvider] initialization error:", error);
      applyTheme("dark");
    } finally {
      setMounted(true);
    }
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("theme", newTheme);
    applyTheme(newTheme);
  };

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, mounted }}>
      <div className="flex-1 flex flex-col" suppressHydrationWarning>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
