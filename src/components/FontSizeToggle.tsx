"use client";

import { useFontSize } from "./FontSizeProvider";

export function FontSizeToggle() {
  const { isLarge, toggleFontSize } = useFontSize();

  return (
    <button
      type="button"
      onClick={toggleFontSize}
      className="relative w-11 h-11 flex items-center justify-center rounded-full transition-all duration-300 hover:bg-white/10"
      aria-label={isLarge ? "기본 글씨 크기로 변경" : "큰 글씨 모드로 변경"}
      aria-pressed={isLarge}
      title={isLarge ? "기본 글씨" : "큰 글씨"}
    >
      {/* Normal 상태: 작은 '가' */}
      <span
        aria-hidden="true"
        className="select-none font-display font-bold leading-none transition-all duration-300"
        style={{
          fontSize: "14px", // px 고정 — 버튼이 rem으로 스케일되므로 이중 적용 방지
          opacity: isLarge ? 0 : 1,
          transform: isLarge ? "scale(0.7)" : "scale(1)",
          position: "absolute",
          color: "var(--text-secondary)",
        }}
      >
        가
      </span>

      {/* Large 상태: 큰 '가' + accent 색상 */}
      <span
        aria-hidden="true"
        className="select-none font-display font-bold leading-none transition-all duration-300"
        style={{
          fontSize: "18px", // px 고정
          opacity: isLarge ? 1 : 0,
          transform: isLarge ? "scale(1)" : "scale(0.7)",
          position: "absolute",
          color: "var(--accent-color)",
        }}
      >
        가
      </span>
    </button>
  );
}
