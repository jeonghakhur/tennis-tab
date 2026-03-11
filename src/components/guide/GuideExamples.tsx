"use client";

import { useRouter } from "next/navigation";

interface ExampleQuery {
  text: string;
}

interface ExampleGroup {
  category: string;
  icon: string;
  queries: ExampleQuery[];
}

const EXAMPLE_GROUPS: ExampleGroup[] = [
  {
    category: "대회 검색",
    icon: "🔍",
    queries: [
      { text: "지금 신청 가능한 대회 알려줘" },
      { text: "다음 달 열리는 테니스 대회 있어?" },
      { text: "마포 지역 대회 보여줘" },
    ],
  },
  {
    category: "상세 조회",
    icon: "📋",
    queries: [
      { text: "내가 신청한 대회 목록 보여줘" },
      { text: "다음 내 경기는 언제야?" },
      { text: "○○대회 참가비 얼마야?" },
    ],
  },
  {
    category: "입상 기록",
    icon: "🏆",
    queries: [
      { text: "최근 우승자 누구야?" },
      { text: "올해 대회 입상 기록 보여줘" },
      { text: "마포구청장기 대진표 보여줘" },
    ],
  },
  {
    category: "신청 / 취소",
    icon: "✍️",
    queries: [
      { text: "대회 참가 신청하고 싶어" },
      { text: "신청 취소하고 싶어" },
    ],
  },
];

export function GuideExamples() {
  const router = useRouter();

  const handleQuery = (text: string) => {
    // 메인 채팅 페이지로 이동 (향후 query param으로 pre-fill 가능)
    router.push(`/?q=${encodeURIComponent(text)}`);
  };

  return (
    <div
      className="relative rounded-3xl p-6 overflow-hidden mt-8"
      style={{
        background:
          "linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(59,130,246,0.03) 100%)",
        border: "1px solid rgba(59, 130, 246, 0.2)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* 배경 글로우 */}
      <div
        className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />

      <div className="relative">
        <p
          className="text-xs font-bold tracking-widest mb-5 uppercase"
          style={{ color: "rgba(59, 130, 246, 0.7)" }}
        >
          이렇게 물어보세요 — 클릭하면 채팅으로 이동합니다
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {EXAMPLE_GROUPS.map((group) => (
            <div key={group.category}>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-base" aria-hidden="true">
                  {group.icon}
                </span>
                <span
                  className="text-xs font-bold"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                >
                  {group.category}
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                {group.queries.map((q) => (
                  <button
                    key={q.text}
                    type="button"
                    onClick={() => handleQuery(q.text)}
                    className="group/q text-left px-3.5 py-2.5 rounded-xl text-sm transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.01]"
                    style={{
                      backgroundColor: "rgba(59, 130, 246, 0.08)",
                      border: "1px solid rgba(59, 130, 246, 0.15)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <span className="group-hover/q:text-blue-400 transition-colors">
                      &ldquo;{q.text}&rdquo;
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
