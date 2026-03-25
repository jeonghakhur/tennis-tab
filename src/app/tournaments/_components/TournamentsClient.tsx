"use client";

import { useMemo, useState } from "react";
import TournamentCard from "@/components/tournaments/TournamentCard";
import type { Database } from "@/lib/supabase/types";
import type { TournamentStatus } from "@/lib/supabase/types";

type Tournament = Database["public"]["Tables"]["tournaments"]["Row"];

type FilterKey = "ALL" | "UPCOMING" | "OPEN" | "ENDED";

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: "ALL", label: "전체" },
  { key: "UPCOMING", label: "접수예정" },
  { key: "OPEN", label: "모집중" },
  { key: "ENDED", label: "종료" },
];

/** 대회 상태 → 필터 키 매핑 */
const STATUS_TO_FILTER: Record<TournamentStatus, FilterKey> = {
  DRAFT: "ALL",
  UPCOMING: "UPCOMING",
  OPEN: "OPEN",
  CLOSED: "ENDED",
  IN_PROGRESS: "ENDED",
  COMPLETED: "ENDED",
  CANCELLED: "ENDED",
};

interface TournamentsClientProps {
  tournaments: Tournament[];
}

export default function TournamentsClient({
  tournaments,
}: TournamentsClientProps) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("ALL");

  // 필터별 건수 계산
  const counts = useMemo(() => {
    const map: Record<FilterKey, number> = { ALL: 0, UPCOMING: 0, OPEN: 0, ENDED: 0 };
    for (const t of tournaments) {
      const filterKey = STATUS_TO_FILTER[t.status as TournamentStatus] ?? "ALL";
      if (filterKey !== "ALL") map[filterKey]++;
    }
    map.ALL = tournaments.length;
    return map;
  }, [tournaments]);

  // 현재 필터에 맞는 대회 목록
  const filtered = useMemo(() => {
    if (activeFilter === "ALL") return tournaments;
    return tournaments.filter((t) => {
      const filterKey = STATUS_TO_FILTER[t.status as TournamentStatus];
      return filterKey === activeFilter;
    });
  }, [tournaments, activeFilter]);

  return (
    <>
      {/* 필터 탭 */}
      <nav
        className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide"
        role="tablist"
        aria-label="대회 상태 필터"
      >
        {FILTER_TABS.map(({ key, label }) => {
          const isActive = activeFilter === key;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveFilter(key)}
              className={`
                whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors flex-shrink-0
                ${
                  isActive
                    ? "bg-(--accent-color) text-white"
                    : "bg-(--bg-secondary) text-(--text-primary) hover:bg-(--bg-input)"
                }
              `}
            >
              {label} ({counts[key]})
            </button>
          );
        })}
      </nav>

      {/* 대회 목록 */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-(--bg-input)/50 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
          <div className="text-4xl mb-4">🎾</div>
          <h3 className="text-lg font-medium mb-2">
            {activeFilter === "ALL"
              ? "등록된 대회가 없습니다"
              : `${FILTER_TABS.find((t) => t.key === activeFilter)?.label} 대회가 없습니다`}
          </h3>
          <p className="text-gray-500">
            참가 가능한 대회가 곧 등록될 예정입니다.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((tournament) => (
            <TournamentCard key={tournament.id} tournament={tournament} />
          ))}
        </div>
      )}
    </>
  );
}
