"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";

export interface GuideSlide {
  title: string;
  description: string;
  screenshot: string;
  screenshotMobile?: string;
  screenshotAlt: string;
}

interface Props {
  slides: GuideSlide[];
  accentColor: string;
  accentBorder: string;
}

export function GuideCarousel({ slides, accentColor, accentBorder }: Props) {
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const mouseStartX = useRef(0);
  const isDragging = useRef(false);
  const mouseDelta = useRef(0);

  const total = slides.length;

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= total) return;
      setCurrent(index);
    },
    [total]
  );

  const goNext = useCallback(() => goTo(current + 1), [current, goTo]);
  const goPrev = useCallback(() => goTo(current - 1), [current, goTo]);

  // 키보드
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);

  // 터치
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      dx < 0 ? goNext() : goPrev();
    }
  };

  // 마우스 드래그
  const handleMouseDown = (e: React.MouseEvent) => {
    mouseStartX.current = e.clientX;
    isDragging.current = true;
    mouseDelta.current = 0;
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    mouseDelta.current = e.clientX - mouseStartX.current;
  };
  const handleMouseUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (Math.abs(mouseDelta.current) > 50) {
      mouseDelta.current < 0 ? goNext() : goPrev();
    }
    mouseDelta.current = 0;
  };

  return (
    <div
      className="select-none"
      style={{ cursor: "grab" }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* 도트 인디케이터 — 상단 */}
      {total > 1 && (
        <div className="flex justify-center gap-2 mb-5">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === current ? "24px" : "8px",
                height: "8px",
                backgroundColor:
                  i === current ? "var(--text-primary)" : "var(--text-muted)",
                opacity: i === current ? 0.8 : 0.4,
              }}
              aria-label={`${i + 1}번째 슬라이드`}
              aria-current={i === current ? "true" : undefined}
            />
          ))}
        </div>
      )}

      {/* 슬라이드 트랙 */}
      <div className="overflow-hidden">
        <div
          className="flex"
          style={{
            transform: `translateX(-${current * 100}%)`,
            transition: "transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
          }}
        >
          {slides.map((s, i) => (
            <div
              key={i}
              className="min-w-full"
              aria-hidden={i !== current}
            >
              {/* 타이틀 & 설명 */}
              <div className="text-center mb-6 px-6">
                <h3
                  className="font-black mb-2.5 leading-tight"
                  style={{
                    fontFamily: "Paperlogy, sans-serif",
                    fontSize: "clamp(20px, 3.5vw, 28px)",
                    color: "var(--text-primary)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {s.title}
                </h3>
                <p
                  className="text-sm leading-relaxed max-w-md mx-auto"
                  style={{ color: "var(--text-muted)" }}
                >
                  {s.description}
                </p>
              </div>

              {/* 스크린샷 — 브라우저 프레임 */}
              <div
                className="mx-auto rounded-2xl overflow-hidden"
                style={{
                  maxWidth: "700px",
                  border: `1px solid ${accentBorder}`,
                  boxShadow: `0 20px 60px rgba(0,0,0,0.55), 0 0 0 1px ${accentBorder}`,
                }}
              >
                {/* 브라우저 크롬 */}
                <div
                  className="flex items-center gap-1.5 px-3 py-2.5"
                  style={{ backgroundColor: "rgba(28,28,30,0.95)" }}
                >
                  <span className="w-3 h-3 rounded-full bg-red-500/70" />
                  <span className="w-3 h-3 rounded-full bg-yellow-400/70" />
                  <span className="w-3 h-3 rounded-full bg-green-500/70" />
                  <span
                    className="ml-2 text-xs px-2.5 py-0.5 rounded flex-1 max-w-[180px] text-center truncate"
                    style={{
                      backgroundColor: "rgba(255,255,255,0.06)",
                      color: "rgba(255,255,255,0.25)",
                    }}
                  >
                    tennistab.com
                  </span>
                </div>
                {/* 이미지 — 데스크탑/모바일 반응형 */}
                <div className="overflow-hidden" style={{ maxHeight: "380px" }}>
                  {/* 데스크탑 이미지 (md 이상) */}
                  <Image
                    src={`/guide/screenshots/${s.screenshot}`}
                    alt={s.screenshotAlt}
                    width={1280}
                    height={800}
                    className={`w-full h-auto${s.screenshotMobile ? " hidden md:block" : " block"}`}
                    style={{ maxHeight: "380px", objectFit: "cover", objectPosition: "top" }}
                    priority={i === 0}
                    draggable={false}
                  />
                  {/* 모바일 이미지 (md 미만) */}
                  {s.screenshotMobile && (
                    <Image
                      src={`/guide/screenshots/${s.screenshotMobile}`}
                      alt={s.screenshotAlt}
                      width={390}
                      height={844}
                      className="w-full h-auto block md:hidden"
                      style={{ maxHeight: "380px", objectFit: "cover", objectPosition: "top" }}
                      priority={i === 0}
                      draggable={false}
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
