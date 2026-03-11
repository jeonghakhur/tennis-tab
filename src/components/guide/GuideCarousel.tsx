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
  cta?: { label: string; href: string };
  ctaStyle?: React.CSSProperties;
}

export function GuideCarousel({ slides, accentColor, accentBorder, cta, ctaStyle }: Props) {
  const [current, setCurrent] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const mouseStartX = useRef(0);
  const isDragging = useRef(false);
  const mouseDelta = useRef(0);
  const isHorizontalSwipe = useRef<boolean | null>(null);

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

  // 터치 — 세로 스크롤 차단
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      if (isHorizontalSwipe.current) e.preventDefault();
    };
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", onTouchMove);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isHorizontalSwipe.current = null;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (isHorizontalSwipe.current === null) {
      isHorizontalSwipe.current = Math.abs(dx) > Math.abs(dy);
    }
    if (isHorizontalSwipe.current) e.preventDefault();
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isHorizontalSwipe.current) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) dx < 0 ? goNext() : goPrev();
    isHorizontalSwipe.current = null;
  };

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

  // 카드 너비: 컨테이너의 82%, 양옆 peek ~9%
  const CARD_WIDTH_PERCENT = 82;
  const GAP = 16; // px

  return (
    <div className="select-none" style={{ cursor: "grab" }}>
      {/* 바깥 래퍼 — 양쪽 peek 영역 노출용 */}
      <div
        ref={containerRef}
        className="overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* 트랙 */}
        <div
          className="flex"
          style={{
            gap: `${GAP}px`,
            // 현재 카드 중앙 정렬: 왼쪽 오프셋 = (100 - CARD_WIDTH_PERCENT) / 2 %
            // 슬라이드 이동 = current * (CARD_WIDTH_PERCENT % + GAP)
            transform: `translateX(calc(${(100 - CARD_WIDTH_PERCENT) / 2}% - ${current} * (${CARD_WIDTH_PERCENT}% + ${GAP}px)))`,
            transition: "transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
            willChange: "transform",
          }}
        >
          {slides.map((s, i) => {
            const isActive = i === current;
            return (
              <div
                key={i}
                aria-hidden={!isActive}
                className="shrink-0 rounded-2xl overflow-hidden transition-all duration-400"
                style={{
                  width: `${CARD_WIDTH_PERCENT}%`,
                  border: `1.5px solid ${isActive ? accentBorder : "rgba(255,255,255,0.06)"}`,
                  backgroundColor: "var(--bg-secondary, #18181b)",
                  transform: isActive ? "scale(1)" : "scale(0.96)",
                  opacity: isActive ? 1 : 0.5,
                  boxShadow: isActive
                    ? `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${accentBorder}`
                    : "none",
                  transition: "transform 0.4s ease, opacity 0.4s ease, box-shadow 0.4s ease",
                }}
              >
                {/* 스크린샷 영역 */}
                <div
                  className="relative overflow-hidden"
                  style={{ borderBottom: `1px solid ${accentBorder}` }}
                >
                  {/* 브라우저 크롬 바 */}
                  <div
                    className="flex items-center gap-1.5 px-3 py-2"
                    style={{ backgroundColor: "rgba(20,20,22,0.98)" }}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                    <span
                      className="ml-2 text-xs px-2 py-0.5 rounded flex-1 max-w-[160px] text-center truncate"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.05)",
                        color: "rgba(255,255,255,0.2)",
                        fontSize: "10px",
                      }}
                    >
                      tennistab.com
                    </span>
                  </div>

                  {/* 데스크탑 이미지: 16:10 비율, md 이상에서 표시 */}
                  <div
                    className={s.screenshotMobile ? "hidden md:block" : "block"}
                    style={{ aspectRatio: "16 / 10", position: "relative", overflow: "hidden" }}
                  >
                    <Image
                      src={`/guide/screenshots/${s.screenshot}`}
                      alt={s.screenshotAlt}
                      fill
                      sizes="(min-width: 768px) 80vw, 0px"
                      style={{ objectFit: "cover", objectPosition: "top" }}
                      priority={i === 0}
                      draggable={false}
                    />
                  </div>

                  {/* 모바일 이미지: 9:19 비율(세로 스크린샷), md 미만에서 표시 */}
                  {s.screenshotMobile && (
                    <div
                      className="block md:hidden"
                      style={{ aspectRatio: "9 / 19", position: "relative", overflow: "hidden" }}
                    >
                      <Image
                        src={`/guide/screenshots/${s.screenshotMobile}`}
                        alt={s.screenshotAlt}
                        fill
                        sizes="(max-width: 767px) 82vw, 0px"
                        style={{ objectFit: "cover", objectPosition: "top" }}
                        priority={i === 0}
                        draggable={false}
                      />
                    </div>
                  )}
                </div>

                {/* 텍스트 + 버튼 영역 */}
                <div className="px-5 py-4">
                  <h3
                    className="font-black mb-1.5 leading-tight"
                    style={{
                      fontFamily: "Paperlogy, sans-serif",
                      fontSize: "clamp(15px, 2.5vw, 18px)",
                      color: "var(--text-primary)",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {s.title}
                  </h3>
                  <p
                    className="text-sm leading-relaxed mb-4"
                    style={{
                      color: "var(--text-muted)",
                      fontSize: "clamp(12px, 1.8vw, 13px)",
                    }}
                  >
                    {s.description}
                  </p>

                  {/* 슬라이드 카운터 + 진행 바 */}
                  <div className="flex items-center gap-3">
                    <span
                      className="text-xs font-bold tabular-nums"
                      style={{ color: accentColor, opacity: 0.8 }}
                    >
                      {String(i + 1).padStart(2, "0")}{" "}
                      <span style={{ opacity: 0.4 }}>/ {String(total).padStart(2, "0")}</span>
                    </span>
                    {/* 얇은 프로그레스 바 */}
                    <div
                      className="flex-1 h-0.5 rounded-full overflow-hidden"
                      style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-400"
                        style={{
                          width: `${((i + 1) / total) * 100}%`,
                          backgroundColor: accentColor,
                          opacity: isActive ? 0.7 : 0.3,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 도트 인디케이터 */}
      {total > 1 && (
        <div className="flex justify-center gap-1.5 mt-4">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === current ? "20px" : "6px",
                height: "6px",
                backgroundColor: i === current ? accentColor : "rgba(255,255,255,0.2)",
              }}
              aria-label={`${i + 1}번째 슬라이드`}
              aria-current={i === current ? "true" : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
