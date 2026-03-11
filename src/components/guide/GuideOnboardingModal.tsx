"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { GuideCarousel, type GuideSlide } from "./GuideCarousel";

const STORAGE_KEY = "guide_onboarding_dismissed";

// ─────────────────────────────────────────────
// 슬라이드 데이터 (GuideCarousel과 동일)
// ─────────────────────────────────────────────
const TOURNAMENT_SLIDES: GuideSlide[] = [
  {
    title: "대회 목록 확인",
    description:
      "상단 내비게이션의 대회를 클릭하면 전체 목록이 나타납니다. 상태 배지(접수중 · 예정 · 마감 · 진행중)로 지금 신청 가능한 대회를 바로 파악하세요.",
    screenshot: "tournament-list.png",
    screenshotAlt: "대회 목록 화면",
  },
  {
    title: "대회 상세 확인",
    description:
      "대회 카드를 클릭하면 일시 · 장소 · 참가비 · 부서 정보 · 요강을 확인할 수 있습니다. 포스터와 지도도 함께 제공됩니다.",
    screenshot: "tournament-detail.png",
    screenshotAlt: "대회 상세 화면",
  },
  {
    title: "참가 신청 & 결제",
    description:
      "우측 참가 신청 버튼 → 부서 선택 → 정보 입력 순으로 진행합니다. 참가비가 있는 경우 카드 결제 또는 계좌이체 후 주최측 확인을 기다리세요.",
    screenshot: "tournament-apply.png",
    screenshotAlt: "참가 신청 버튼 위치",
  },
];

const CLUB_SLIDES: GuideSlide[] = [
  {
    title: "클럽 찾기",
    description:
      "상단 내비게이션의 클럽을 클릭합니다. 이름 검색 또는 지역 필터로 원하는 클럽을 탐색하세요.",
    screenshot: "club-list.png",
    screenshotAlt: "클럽 목록 화면",
  },
  {
    title: "클럽 가입",
    description:
      "클럽 카드를 클릭해 상세 페이지로 이동합니다. 가입 유형(자유 · 승인제 · 초대 전용)을 확인하고 가입 버튼을 누르세요.",
    screenshot: "club-detail.png",
    screenshotAlt: "클럽 상세 화면",
  },
  {
    title: "모임 참석 응답",
    description:
      "클럽 상세의 모임 탭에서 예정된 모임을 선택하고 참석 / 불참 / 가능 시간을 응답해두세요.",
    screenshot: "club-session.png",
    screenshotAlt: "클럽 모임 탭 화면",
  },
  {
    title: "순위 확인",
    description:
      "클럽 상세의 순위 탭에서 클럽 내 종합 순위를 확인합니다. 기간과 경기 방식별로 필터링할 수 있습니다.",
    screenshot: "club-ranking.png",
    screenshotAlt: "클럽 순위 탭 화면",
  },
];

const CHAT_SLIDES: GuideSlide[] = [
  {
    title: "대회 검색",
    description:
      '"지금 신청 가능한 대회 알려줘", "마포구 대회 있어?", "6월에 열리는 테니스 대회 보여줘" — 지역, 날짜, 상태 조건을 자유롭게 조합해 물어보세요.',
    screenshot: "chat-tournament-search-desktop.png",
    screenshotMobile: "chat-tournament-search-mobile.png",
    screenshotAlt: "AI 채팅 — 대회 검색 결과",
  },
  {
    title: "나의 참가 신청 확인",
    description:
      '"내가 신청한 대회 목록 보여줘", "다음 내 경기 언제야?" — AI가 내 신청 내역과 경기 일정을 한눈에 정리해 드립니다.',
    screenshot: "chat-my-application-desktop.png",
    screenshotMobile: "chat-my-application-mobile.png",
    screenshotAlt: "AI 채팅 — 나의 참가 신청 조회",
  },
  {
    title: "우승자 · 입상 기록 조회",
    description:
      '"최근 우승자 누구야?", "○○대회 단식 우승자 알려줘", "올해 입상 기록 보여줘" — 대회별 입상 기록을 바로 확인할 수 있습니다.',
    screenshot: "chat-winners-desktop.png",
    screenshotMobile: "chat-winners-mobile.png",
    screenshotAlt: "AI 채팅 — 우승자 및 입상 기록 조회",
  },
  {
    title: "클럽 모임 일정 조회",
    description:
      '"이번 주 클럽 모임 일정 알려줘", "내가 신청한 모임 보여줘" — 가입한 클럽의 모임 일정과 내 참석 현황을 바로 조회할 수 있습니다.',
    screenshot: "chat-club-schedule-desktop.png",
    screenshotMobile: "chat-club-schedule-mobile.png",
    screenshotAlt: "AI 채팅 — 클럽 모임 일정 조회",
  },
];

const SECTIONS = [
  {
    label: "대회 참가",
    slides: TOURNAMENT_SLIDES,
    accentColor: "#ccff00",
    accentBorder: "rgba(204,255,0,0.2)",
  },
  {
    label: "클럽 이용",
    slides: CLUB_SLIDES,
    accentColor: "rgba(255,255,255,0.75)",
    accentBorder: "rgba(255,255,255,0.1)",
  },
  {
    label: "AI 채팅",
    slides: CHAT_SLIDES,
    accentColor: "#3B82F6",
    accentBorder: "rgba(59,130,246,0.2)",
  },
];

// ─────────────────────────────────────────────
// 모달 컴포넌트
// ─────────────────────────────────────────────
export function GuideOnboardingModal() {
  const [visible, setVisible] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) setVisible(true);
  }, []);

  useEffect(() => {
    if (visible) dialogRef.current?.focus();
  }, [visible]);

  useEffect(() => {
    document.body.style.overflow = visible ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [visible]);

  const handleClose = () => setVisible(false);
  const handleDismissPermanently = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* 딤 배경 */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* 바텀 시트 */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="서비스 이용 안내"
        tabIndex={-1}
        className="relative flex flex-col outline-none rounded-t-3xl"
        style={{
          height: "75vh",
          backgroundColor: "var(--bg-primary)",
          border: "1px solid var(--border-color)",
          borderBottom: "none",
        }}
      >
        {/* 드래그 핸들 */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div
            className="w-10 h-1 rounded-full"
            style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
            aria-hidden="true"
          />
        </div>

        {/* ── 3개 섹션 전체 표시 (스크롤) ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 py-8 space-y-14">
            {SECTIONS.map((section) => (
              <div key={section.label}>
                <GuideCarousel
                  slides={section.slides}
                  accentColor={section.accentColor}
                  accentBorder={section.accentBorder}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── 하단 푸터 ── */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0 border-t"
          style={{ borderColor: "var(--border-color)" }}
        >
          <button
            type="button"
            onClick={handleDismissPermanently}
            className="text-sm transition-colors hover:text-white"
            style={{ color: "var(--text-muted)" }}
          >
            다시 보지 않기
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-white"
            style={{ color: "var(--text-secondary)" }}
          >
            <X size={14} aria-hidden="true" />
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
