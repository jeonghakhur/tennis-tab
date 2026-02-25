"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

type FontSize = "normal" | "large";

interface FontSizeContextType {
  fontSize: FontSize;
  toggleFontSize: () => void;
  isLarge: boolean;
  mounted: boolean;
}

const FontSizeContext = createContext<FontSizeContextType | undefined>(
  undefined
);

export function useFontSize() {
  const context = useContext(FontSizeContext);
  if (!context) {
    throw new Error("useFontSize must be used within a FontSizeProvider");
  }
  return context;
}

export function FontSizeProvider({ children }: { children: ReactNode }) {
  const [fontSize, setFontSizeState] = useState<FontSize>("normal");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("font-size") as FontSize | null;
      // "large"만 유효값 — 그 외(null, 오염된 값)는 "normal"
      const initial: FontSize = saved === "large" ? "large" : "normal";
      setFontSizeState(initial);
      document.documentElement.setAttribute("data-font-size", initial);
    } catch {
      // localStorage 접근 불가 환경 (보안 정책 등)
      document.documentElement.setAttribute("data-font-size", "normal");
    } finally {
      setMounted(true);
    }
  }, []);

  const applyFontSize = (size: FontSize) => {
    setFontSizeState(size);
    try {
      localStorage.setItem("font-size", size);
    } catch {
      // DOM 반영만으로 충분
    }
    document.documentElement.setAttribute("data-font-size", size);
  };

  const toggleFontSize = () => {
    applyFontSize(fontSize === "normal" ? "large" : "normal");
  };

  return (
    <FontSizeContext.Provider
      value={{
        fontSize,
        toggleFontSize,
        isLarge: fontSize === "large",
        mounted,
      }}
    >
      {children}
    </FontSizeContext.Provider>
  );
}
