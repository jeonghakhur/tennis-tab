import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  GuideCarousel,
  type GuideSlide,
} from "@/components/guide/GuideCarousel";

export const metadata: Metadata = {
  title: "이용 안내 | 마포구테니스협회",
  description:
    "마포구테니스협회 주요 기능 사용 방법 안내: 대회 참가, 클럽 이용, AI 자연어 검색",
};

// ─────────────────────────────────────────────
// 섹션별 슬라이드 데이터
// ─────────────────────────────────────────────
const TOURNAMENT_SLIDES: GuideSlide[] = [
  {
    title: "대회 목록 확인",
    description:
      "상단 내비게이션의 대회를 클릭하면 전체 목록이 나타납니다. 상태 배지(접수중 · 예정 · 마감 · 진행중)로 지금 신청 가능한 대회를 바로 파악하세요.",
    screenshot: "tournament-flow/01-list-desktop.png",
    screenshotMobile: "tournament-flow/01-list-mobile.png",
    screenshotAlt: "대회 목록 화면",
  },
  {
    title: "대회 상세 확인",
    description:
      "대회 카드를 클릭하면 일시 · 장소 · 참가비를 한눈에 확인할 수 있습니다. 로그인 후 우측 패널에서 참가 신청 버튼을 바로 사용할 수 있습니다.",
    screenshot: "tournament-flow/04-apply-btn-desktop.png",
    screenshotAlt: "대회 상세 화면 (로그인 후)",
  },
  {
    title: "참가 신청 폼",
    description:
      "참가 신청 버튼을 클릭하면 신청 폼이 열립니다. 부서 선택 · 파트너 정보 · 환불 계좌를 입력하고 제출하면 즉시 신청이 완료됩니다.",
    screenshot: "tournament-flow/05-apply-form-desktop.png",
    screenshotAlt: "참가 신청 폼 화면",
  },
  {
    title: "신청 완료 후 대회 상세",
    description:
      "신청이 완료되면 대회 상세 페이지에서 내 신청 현황(확정 · 대기)을 바로 확인할 수 있습니다. 대진표 보기 버튼으로 경기 일정에 바로 이동하세요.",
    screenshot: "tournament-flow/02-detail-loggedin-desktop.png",
    screenshotAlt: "신청 완료 후 대회 상세 화면",
  },
  {
    title: "대진표 & 결과 입력",
    description:
      "경기가 시작되면 대진표에서 내 매치의 결과 입력 버튼이 활성화됩니다. 버튼을 클릭하면 바로 점수를 입력할 수 있습니다.",
    screenshot: "tournament-flow/17-bracket-score-entry-desktop.png",
    screenshotAlt: "대진표 결과 입력 버튼 화면",
  },
  {
    title: "점수 입력",
    description:
      "결과 입력 버튼을 클릭하면 점수 입력 창이 열립니다. 양 팀 점수를 입력하고 저장하면 승자가 자동으로 다음 라운드로 진출하며 대진표가 실시간으로 업데이트됩니다.",
    screenshot: "tournament-flow/18-score-input-frontend-desktop.png",
    screenshotAlt: "점수 입력 모달 화면",
  },
  {
    title: "내 신청 관리",
    description:
      "프로필 페이지 → 참가 대회 탭에서 신청한 모든 대회 현황을 확인합니다. 승인 상태 · 시합일 · 부서 정보와 함께 대진표 바로가기도 제공됩니다.",
    screenshot: "tournament-flow/15-profile-entries-desktop.png",
    screenshotAlt: "프로필 참가 대회 탭 화면",
  },
  {
    title: "내 경기 결과",
    description:
      "프로필 페이지 → 내 경기 탭에서 총 경기 수 · 승/패 · 승률 통계와 경기별 상세 결과를 확인하세요. 진행 중인 경기는 결과 입력 버튼이 표시됩니다.",
    screenshot: "tournament-flow/16-profile-matches-desktop.png",
    screenshotAlt: "프로필 내 경기 탭 화면",
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
    title: "참석 현황 & 멤버 확인",
    description:
      "참석 예정인 멤버 목록이 이름과 함께 표시됩니다. 내 참석 여부는 강조되어 쉽게 구분되고, 마감 전까지 언제든 변경할 수 있습니다.",
    screenshot: "club-flow/sessions-04-detail-top-desktop.png",
    screenshotMobile: "club-flow/sessions-04-detail-top-mobile.png",
    screenshotAlt: "모임 참석 현황 화면",
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
    title: "정렬 방향 전환",
    description:
      "컬럼 헤더를 반복 클릭해 오름차순·내림차순을 즉시 전환할 수 있습니다. 승률이 낮은 멤버부터 보고 싶을 때도 손쉽게 바꿔보세요.",
    screenshot: "club-flow/rankings-04-sort-winrate-desc-desktop.png",
    screenshotMobile: "club-flow/rankings-04-sort-winrate-desc-mobile.png",
    screenshotAlt: "정렬 방향 전환 화면",
  },
  {
    title: "승점 기준 정렬",
    description:
      "승점 컬럼으로 정렬하면 적립된 승점 순으로 순위가 바뀝니다. 승률과는 다른 관점에서 멤버 성적을 확인해보세요.",
    screenshot: "club-flow/rankings-05-sort-winpoints-desktop.png",
    screenshotMobile: "club-flow/rankings-05-sort-winpoints-mobile.png",
    screenshotAlt: "승점 정렬 화면",
  },
  {
    title: "기간 직접 설정",
    description:
      "'직접 설정' 버튼으로 원하는 날짜 범위를 지정할 수 있습니다. 특정 시즌이나 대회 기간의 성적만 골라서 비교해보세요.",
    screenshot: "club-flow/rankings-06-custom-period-desktop.png",
    screenshotMobile: "club-flow/rankings-06-custom-period-mobile.png",
    screenshotAlt: "기간 직접 설정 화면",
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
    screenshot: "chat-main.png",
    screenshotAlt: "AI 채팅 — 대회 검색",
  },
  {
    title: "참가 신청",
    description:
      '"○○대회 신청하고 싶어"라고 입력하면 AI가 단계별로 안내합니다. 대회 선택 → 부서 → 연락처 → 확인 순으로 진행되며, "취소"를 입력하면 언제든 중단할 수 있습니다.',
    screenshot: "chat-main.png",
    screenshotAlt: "AI 채팅 — 참가 신청",
  },
  {
    title: "우승자 조회",
    description:
      '"최근 우승자 누구야?", "○○대회 단식 우승자 알려줘", "올해 입상 기록 보여줘" — 대회별 입상 기록을 바로 확인할 수 있습니다.',
    screenshot: "chat-main.png",
    screenshotAlt: "AI 채팅 — 우승자 조회",
  },
  {
    title: "모임 검색",
    description:
      '"이번 주 모임 있어?", "내가 신청한 모임 보여줘", "다음 경기 언제야?" — 클럽 모임 일정과 내 참석 현황을 바로 조회할 수 있습니다.',
    screenshot: "chat-main.png",
    screenshotAlt: "AI 채팅 — 모임 검색",
  },
];

// ─────────────────────────────────────────────
// 섹션 메타
// ─────────────────────────────────────────────
const SECTIONS = [
  {
    id: "tournament",
    label: "대회 참가",
    index: "01",
    slides: TOURNAMENT_SLIDES,
    accentColor: "#ccff00",
    accentBorder: "rgba(204,255,0,0.2)",
    cta: { label: "대회 목록 보기", href: "/tournaments" },
    ctaStyle: { backgroundColor: "#ccff00", color: "#09090b" } as React.CSSProperties,
  },
  {
    id: "club",
    label: "클럽 이용",
    index: "02",
    slides: CLUB_SLIDES,
    accentColor: "rgba(255,255,255,0.75)",
    accentBorder: "rgba(255,255,255,0.1)",
    cta: { label: "클럽 찾기", href: "/clubs" },
    ctaStyle: {
      backgroundColor: "transparent",
      color: "var(--text-primary)",
      border: "2px solid rgba(255,255,255,0.2)",
    } as React.CSSProperties,
  },
  {
    id: "chat",
    label: "AI 채팅",
    index: "03",
    slides: CHAT_SLIDES,
    accentColor: "#3B82F6",
    accentBorder: "rgba(59,130,246,0.2)",
    cta: { label: "AI 채팅 시작", href: "/" },
    ctaStyle: { backgroundColor: "#3B82F6", color: "#fff" } as React.CSSProperties,
  },
] as const;

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default function GuidePage() {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      <div className="max-w-3xl md:max-w-5xl mx-auto px-4 py-10 space-y-20">
        {SECTIONS.map((section) => (
          <section
            key={section.id}
            id={section.id}
            aria-labelledby={`${section.id}-title`}
            className="scroll-mt-20"
          >
            {/* 섹션 헤더 */}
            <div className="flex items-end justify-between mb-7 px-2">
              <div>
                <p
                  className="text-xs font-bold tracking-[0.2em] uppercase mb-1.5"
                  style={{ color: section.accentColor, opacity: 0.7 }}
                >
                  {section.index}
                </p>
                <h2
                  id={`${section.id}-title`}
                  className="font-black italic leading-none"
                  style={{
                    fontFamily: "Paperlogy, sans-serif",
                    fontSize: "clamp(26px, 4vw, 36px)",
                    color: "var(--text-primary)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {section.label}
                </h2>
              </div>

              {/* CTA */}
              <Link
                href={section.cta.href}
                className="group hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:opacity-80 shrink-0"
                style={section.ctaStyle}
              >
                {section.cta.label}
                <ChevronRight
                  size={14}
                  className="transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </div>

            {/* 캐루셀 */}
            <GuideCarousel
              slides={section.slides}
              accentColor={section.accentColor}
              accentBorder={section.accentBorder}
            />

            {/* 모바일 CTA */}
            <div className="sm:hidden mt-5 px-2">
              <Link
                href={section.cta.href}
                className="flex items-center justify-center gap-1.5 w-full py-3 rounded-xl text-sm font-bold transition-all hover:opacity-80"
                style={section.ctaStyle}
              >
                {section.cta.label}
                <ChevronRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
