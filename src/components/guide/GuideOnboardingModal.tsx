"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
      "상단 내비게이션의 대회를 클릭하면 전체 목록이 나타납니다. 상태 배지(모집중 · 예정 · 마감 · 진행중)로 지금 신청 가능한 대회를 바로 파악하세요.",
    screenshot: "tournament-flow/01-list-desktop.png",
    screenshotMobile: "t_01.jpg",
    screenshotAlt: "대회 목록 화면",
  },
  {
    title: "대회 상세 확인",
    description:
      "대회 카드를 클릭하면 일시 · 장소 · 참가비를 한눈에 확인할 수 있습니다. 로그인 후 우측 패널에서 참가 신청 버튼을 바로 사용할 수 있습니다.",
    screenshot: "tournament-flow/04-apply-btn-desktop.png",
    screenshotMobile: "t_02.jpg",
    screenshotAlt: "대회 상세 화면 (로그인 후)",
  },
  {
    title: "참가 신청 폼",
    description:
      "참가 신청 버튼을 클릭하면 신청 폼이 열립니다. 부서 선택 · 파트너 정보 · 환불 계좌를 입력하고 제출하면 즉시 신청이 완료됩니다.",
    screenshot: "tournament-flow/05-apply-form-desktop.png",
    screenshotMobile: "t_03.jpg",
    screenshotAlt: "참가 신청 폼 화면",
  },
  {
    title: "신청 완료 후 대회 상세",
    description:
      "신청이 완료되면 대회 상세 페이지에서 내 신청 현황(확정 · 대기)을 바로 확인할 수 있습니다. 참가비를 납부하셨다면 반드시 입금 완료 버튼을 눌러주세요.",
    screenshot: "tournament-flow/02-detail-loggedin-desktop.png",
    screenshotMobile: "t_04.jpg",
    screenshotAlt: "신청 완료 후 대회 상세 화면",
  },
  {
    title: "마이페이지로 이동",
    description:
      "우측 상단 프로필을 클릭하면 마이페이지로 바로 이동할 수 있습니다. 마이페이지에서 내 신청 현황 · 경기 기록 · 입상 내역을 한눈에 확인하세요.",
    screenshot: "tournament-flow/02-detail-loggedin-desktop.jpg",
    screenshotMobile: "t_05.jpg",
    screenshotAlt: "프로필 메뉴에서 마이페이지 이동 화면",
  },
  {
    title: "내 신청 관리",
    description:
      "마이페이지 → 신청 현황 탭에서 신청한 모든 대회를 한눈에 확인하세요. 승인 상태 · 입금 확인 · 부서 정보와 함께 대진표 보기 · 대회 보기 바로가기를 제공합니다.",
    screenshot: "tournament-flow/15-profile-entries-desktop.jpg",
    screenshotMobile: "t_06.jpg",
    screenshotAlt: "마이페이지 신청 현황 탭 화면",
  },
  {
    title: "대진표 & 결과 입력",
    description:
      "대진표에서 내 경기의 결과 입력 버튼을 클릭해 직접 점수를 입력할 수 있습니다. 조별 순위와 승 · 패 · 득실점 정보도 함께 확인하세요.",
    screenshot: "tournament-flow/17-bracket-score-entry-desktop.jpg",
    screenshotMobile: "t_07.jpg",
    screenshotAlt: "대진표 예선 조별 순위 및 결과 입력 화면",
  },
];

const CLUB_SLIDES: GuideSlide[] = [
  {
    title: "클럽 탐색",
    description:
      "상단 내비게이션의 클럽을 클릭하면 전체 클럽 목록이 나타납니다. 지역·협회별 클럽을 한눈에 탐색하고 관심 있는 클럽을 찾아보세요.",
    screenshot: "club-flow/01-club-list-desktop.png",
    screenshotMobile: "club-flow/01-club-list-mobile.png",
    screenshotAlt: "클럽 목록 화면",
  },
  {
    title: "클럽 이름으로 검색",
    description:
      "검색창에 클럽 이름을 입력하면 즉시 필터링됩니다. 원하는 클럽을 빠르게 찾을 수 있습니다.",
    screenshot: "club-flow/02-club-search-desktop.png",
    screenshotMobile: "club-flow/02-club-search-mobile.png",
    screenshotAlt: "클럽 검색 화면",
  },
  {
    title: "모임 일정 한눈에 확인",
    description:
      "클럽 상세의 모임 탭에서 예정된 정기모임 전체를 확인하세요. 상태 배지(모집중·마감)와 참석·불참·미정 현황이 카드마다 실시간으로 표시됩니다.",
    screenshot: "club-flow/sessions-01-list-desktop.png",
    screenshotMobile: "club-flow/sessions-01-list-mobile.png",
    screenshotAlt: "클럽 모임 탭 목록 화면",
  },
  {
    title: "모임 카드 선택",
    description:
      "날짜·시간·장소·참석 인원이 카드에 모두 담겨 있습니다. 원하는 모임 카드를 클릭해 상세 정보로 이동하세요.",
    screenshot: "club-flow/sessions-02-card-hover-desktop.png",
    screenshotMobile: "club-flow/sessions-02-card-hover-mobile.png",
    screenshotAlt: "모임 카드 선택 화면",
  },
  {
    title: "모임 상세 페이지",
    description:
      "모임 상세 페이지에서 일정·장소·참석자 현황을 한눈에 확인하세요. 임원은 수정·삭제·모임 관리 기능도 함께 사용할 수 있습니다.",
    screenshot: "club-flow/sessions-03-detail-desktop.png",
    screenshotMobile: "club-flow/sessions-03-detail-mobile.png",
    screenshotAlt: "모임 상세 페이지 화면",
  },
  {
    title: "경기 대진표 & 댓글",
    description:
      "모임 하단에서 당일 경기 대진표를 확인하고 결과를 입력할 수 있습니다. 댓글로 준비물·코트 상황·카풀 등 실용적인 정보를 멤버끼리 공유하세요.",
    screenshot: "club-flow/sessions-08-comments-desktop.png",
    screenshotMobile: "club-flow/sessions-08-comments-mobile.png",
    screenshotAlt: "경기 대진표 및 댓글 화면",
  },
  {
    title: "클럽 종합 순위",
    description:
      "순위 탭에서 클럽 멤버 전체의 성적을 비교하세요. 경기 수·승·패·득실점·승률·승점이 한 화면에 모두 표시됩니다.",
    screenshot: "club-flow/rankings-01-default-desktop.png",
    screenshotMobile: "club-flow/rankings-01-default-mobile.png",
    screenshotAlt: "클럽 순위 탭 화면",
  },
  {
    title: "승률 기준 정렬",
    description:
      "승률 컬럼을 클릭하면 승률 순으로 랭킹이 재정렬됩니다. 다시 클릭하면 오름차순·내림차순으로 자유롭게 전환할 수 있습니다.",
    screenshot: "club-flow/rankings-03-sort-winrate-desktop.png",
    screenshotMobile: "club-flow/rankings-03-sort-winrate-mobile.png",
    screenshotAlt: "승률 정렬 화면",
  },
  {
    title: "개인 상세 전적 조회",
    description:
      "순위표에서 이름을 클릭하면 상대별 전적과 경기별 스코어가 담긴 상세 모달이 열립니다. 기간 필터를 바꾸며 성장 추이를 추적하세요.",
    screenshot: "club-flow/rankings-07-member-modal-desktop.png",
    screenshotMobile: "club-flow/rankings-07-member-modal-mobile.png",
    screenshotAlt: "개인 상세 전적 모달 화면",
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
    title: "대화로 간편하게 참가 신청",
    description:
      '"○○대회 신청하고 싶어"라고 입력하면 AI가 단계별로 안내합니다. 부서 선택 → 신청 확인 순으로 진행되며 "취소"를 입력하면 언제든 중단할 수 있습니다.',
    screenshot: "chat-tournament-registration-desktop.png",
    screenshotMobile: "chat-tournament-registration-mobile.png",
    screenshotAlt: "AI 채팅 — 대회 참가 신청 플로우",
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
    description: "대회 검색부터 신청·대진표 확인까지",
    icon: "🎾",
    slides: TOURNAMENT_SLIDES,
    accentColor: "#ccff00",
    accentBorder: "rgba(204,255,0,0.2)",
    accentBg: "rgba(204,255,0,0.08)",
  },
  {
    label: "클럽 이용",
    description: "클럽 탐색·가입·모임 참여 전 과정",
    icon: "🏅",
    slides: CLUB_SLIDES,
    accentColor: "rgba(255,255,255,0.85)",
    accentBorder: "rgba(255,255,255,0.12)",
    accentBg: "rgba(255,255,255,0.04)",
  },
  {
    label: "AI 채팅",
    description: "자연어로 대회·클럽 정보 즉시 조회",
    icon: "💬",
    slides: CHAT_SLIDES,
    accentColor: "#3B82F6",
    accentBorder: "rgba(59,130,246,0.2)",
    accentBg: "rgba(59,130,246,0.08)",
  },
];

// ─────────────────────────────────────────────
// 모달 컴포넌트
// ─────────────────────────────────────────────
const DRAG_CLOSE_THRESHOLD = 150; // 이 거리 이상 내리면 닫힘

export function GuideOnboardingModal() {
  const [visible, setVisible] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragYRef = useRef(0); // 최신 dragY를 document 핸들러에서 읽기 위한 ref
  const isDragging = useRef(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) setVisible(true);
  }, []);

  useEffect(() => {
    if (visible) dialogRef.current?.focus();
  }, [visible]);

  useEffect(() => {
    document.body.style.overflow = visible ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [visible]);

  const closeWithAnimation = () => {
    setIsClosing(true);
    setDragY(window.innerHeight);
    setTimeout(() => setVisible(false), 350);
  };

  const handleClose = () => closeWithAnimation();
  const handleDismissPermanently = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    closeWithAnimation();
  };

  // ── 터치 드래그 핸들러 ──
  const onTouchDragMove = (clientY: number) => {
    if (!isDragging.current || dragStartY.current === null) return;
    const delta = Math.max(0, clientY - dragStartY.current);
    dragYRef.current = delta;
    setDragY(delta);
  };

  const onTouchDragEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    dragStartY.current = null;
    if (dragYRef.current >= DRAG_CLOSE_THRESHOLD) {
      closeWithAnimation();
    } else {
      dragYRef.current = 0;
      setDragY(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 마우스 드래그 — document 레벨 처리 (핸들 영역 밖으로 이동해도 유지) ──
  const onMouseDragStart = useCallback((clientY: number) => {
    dragStartY.current = clientY;
    isDragging.current = true;
    dragYRef.current = 0;

    const handleMove = (e: MouseEvent) => {
      if (!isDragging.current || dragStartY.current === null) return;
      const delta = Math.max(0, e.clientY - dragStartY.current);
      dragYRef.current = delta;
      setDragY(delta);
    };

    const handleUp = () => {
      isDragging.current = false;
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
      dragStartY.current = null;
      if (dragYRef.current >= DRAG_CLOSE_THRESHOLD) {
        closeWithAnimation();
      } else {
        dragYRef.current = 0;
        setDragY(0);
      }
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  const isSnapping = !isDragging.current && dragY === 0 && !isClosing;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* 딤 배경 — 드래그 거리에 따라 투명도 변화 */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: `rgba(0,0,0,${Math.max(0.1, 0.6 - dragY / (DRAG_CLOSE_THRESHOLD * 2))})`,
          transition:
            isSnapping || isClosing ? "background-color 0.35s ease" : "none",
        }}
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
          height: "90dvh",
          backgroundColor: "var(--bg-primary)",
          border: "1px solid var(--border-color)",
          borderBottom: "none",
          transform: `translateY(${dragY}px)`,
          transition:
            isSnapping || isClosing
              ? "transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)"
              : "none",
          willChange: "transform",
        }}
      >
        {/* ── 드래그 핸들 영역 ── */}
        <div
          className="flex flex-col items-center shrink-0 select-none"
          style={{
            cursor: isDragging.current ? "grabbing" : "grab",
            touchAction: "none",
            paddingTop: "10px",
            paddingBottom: "10px",
          }}
          onMouseDown={(e) => onMouseDragStart(e.clientY)}
          onTouchStart={(e) => {
            dragStartY.current = e.touches[0].clientY;
            isDragging.current = true;
            dragYRef.current = 0;
          }}
          onTouchMove={(e) => onTouchDragMove(e.touches[0].clientY)}
          onTouchEnd={onTouchDragEnd}
          aria-hidden="true"
        >
          {/* 아이폰 홈 인디케이터 스타일 핸들 바 */}
          <div
            className="rounded-full"
            style={{
              width: dragY > 20 ? "60px" : "48px",
              height: "6px",
              backgroundColor:
                dragY > 20 ? "rgba(128,128,128,0.8)" : "rgba(128,128,128,0.45)",
              transition: "width 0.2s ease, background-color 0.2s ease",
            }}
          />
        </div>

        {/* ── 3개 섹션 전체 표시 (스크롤) ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl md:max-w-screen-xl mx-auto px-4 py-10 space-y-0">
            {SECTIONS.map((section, idx) => (
              <div key={section.label} className="pb-16">
                {idx > 0 && (
                  <div
                    className="h-px mb-16"
                    style={{ backgroundColor: "var(--border-color)" }}
                  />
                )}
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
