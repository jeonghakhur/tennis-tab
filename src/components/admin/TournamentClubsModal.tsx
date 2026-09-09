"use client";

import { useMemo, useState } from "react";
import { Search, Building2 } from "lucide-react";
import { Modal } from "@/components/common/Modal";
import { Badge } from "@/components/common/Badge";
import { matchesKoreanSearch } from "@/lib/utils/korean";
import type { PartnerData, TeamMember, EntryStatus } from "@/lib/supabase/types";

/** 클럽 현황 집계에 필요한 엔트리 필드만 추린 타입 (EntriesManager의 Entry와 구조적으로 호환) */
export interface ClubStatusEntry {
  status: EntryStatus;
  user_id: string | null;
  club_name: string | null;
  partner_data: unknown;
  team_members: TeamMember[] | null;
  profiles: { club: string | null } | null;
}

/** 활성 클럽 요약 (서버에서 전달) */
export interface ActiveClubSummary {
  id: string;
  name: string;
  city: string | null;
  district: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  entries: ClubStatusEntry[];
  activeClubs: ActiveClubSummary[];
  /** user_id → 클럽명 (club_name / profiles.club 모두 없을 때 보조 출처) */
  userClubMap: Record<string, string>;
}

type Tab = "participating" | "absent";

/** 참가로 집계하지 않는 엔트리 상태 */
const EXCLUDED_STATUSES: ReadonlySet<EntryStatus> = new Set(["CANCELLED", "REJECTED"]);

interface ParticipatingClub {
  /** 표시용 클럽명 (첫 등장 표기 유지) */
  name: string;
  /** 해당 클럽 소속 인원이 포함된 팀(엔트리) 수 */
  teamCount: number;
  /** clubs 테이블에 등록된 활성 클럽인지 */
  registered: boolean;
  city: string | null;
  district: string | null;
}

/** 클럽명 정규화 키 — 대소문자/앞뒤 공백 무시 매칭 */
function normalizeClubName(name: string): string {
  return name.trim().toLowerCase();
}

/** 엔트리 1건에 등장하는 클럽명 전부 (본인·파트너·팀원) */
function collectEntryClubNames(
  entry: ClubStatusEntry,
  userClubMap: Record<string, string>,
): string[] {
  const names: string[] = [];

  const ownClub =
    entry.club_name ||
    entry.profiles?.club ||
    (entry.user_id ? userClubMap[entry.user_id] : null);
  if (ownClub) names.push(ownClub);

  const partner = entry.partner_data as PartnerData | null;
  if (partner?.club) names.push(partner.club);

  for (const member of entry.team_members ?? []) {
    if (member.club) names.push(member.club);
  }

  return names;
}

export function TournamentClubsModal({
  isOpen,
  onClose,
  entries,
  activeClubs,
  userClubMap,
}: Props) {
  const [tab, setTab] = useState<Tab>("participating");
  const [query, setQuery] = useState("");

  // 참가 클럽 집계 + 미참가 클럽 산출
  const { participating, absent } = useMemo(() => {
    const activeByKey = new Map<string, ActiveClubSummary>();
    for (const club of activeClubs) {
      activeByKey.set(normalizeClubName(club.name), club);
    }

    const participatingByKey = new Map<string, ParticipatingClub>();
    for (const entry of entries) {
      if (EXCLUDED_STATUSES.has(entry.status)) continue;

      // 한 엔트리에 같은 클럽이 여러 번 등장해도 팀 수는 1회만 집계
      const keysInEntry = new Set(
        collectEntryClubNames(entry, userClubMap).map(normalizeClubName),
      );
      for (const key of keysInEntry) {
        const existing = participatingByKey.get(key);
        if (existing) {
          existing.teamCount += 1;
          continue;
        }
        const registered = activeByKey.get(key);
        const displayName =
          registered?.name ??
          collectEntryClubNames(entry, userClubMap).find(
            (n) => normalizeClubName(n) === key,
          ) ??
          key;
        participatingByKey.set(key, {
          name: displayName,
          teamCount: 1,
          registered: Boolean(registered),
          city: registered?.city ?? null,
          district: registered?.district ?? null,
        });
      }
    }

    const participatingList = Array.from(participatingByKey.values()).sort(
      (a, b) => b.teamCount - a.teamCount || a.name.localeCompare(b.name, "ko"),
    );
    const absentList = activeClubs
      .filter((club) => !participatingByKey.has(normalizeClubName(club.name)))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));

    return { participating: participatingList, absent: absentList };
  }, [entries, activeClubs, userClubMap]);

  // 검색 (초성 검색 지원) — 클럽명 / 지역
  const filteredParticipating = useMemo(() => {
    if (!query) return participating;
    return participating.filter(
      (c) =>
        matchesKoreanSearch(c.name, query) ||
        (c.city ? matchesKoreanSearch(c.city, query) : false) ||
        (c.district ? matchesKoreanSearch(c.district, query) : false),
    );
  }, [participating, query]);

  const filteredAbsent = useMemo(() => {
    if (!query) return absent;
    return absent.filter(
      (c) =>
        matchesKoreanSearch(c.name, query) ||
        (c.city ? matchesKoreanSearch(c.city, query) : false) ||
        (c.district ? matchesKoreanSearch(c.district, query) : false),
    );
  }, [absent, query]);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "participating", label: "참가 클럽", count: participating.length },
    { id: "absent", label: "미참가 클럽", count: absent.length },
  ];

  const handleClose = () => {
    setQuery("");
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="클럽별 참가 현황"
      description={`활성 클럽 ${activeClubs.length}개 기준 · 취소/거절 엔트리는 제외`}
      size="xl"
    >
      <Modal.Body>
        <div className="space-y-4">
          {/* 탭 */}
          <div
            role="tablist"
            aria-label="클럽 참가 현황 구분"
            className="flex border-b border-(--border-color)"
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`clubs-tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`clubs-panel-${t.id}`}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                  tab === t.id
                    ? "text-(--accent-color)"
                    : "text-(--text-muted) hover:text-(--text-primary)"
                }`}
              >
                {t.label}
                <span className="ml-1.5 tabular-nums">({t.count})</span>
                {tab === t.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-(--accent-color)" />
                )}
              </button>
            ))}
          </div>

          {/* 검색 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--text-muted)" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="클럽명 또는 지역으로 검색 (초성 가능)"
              aria-label="클럽 검색"
              className="w-full pl-10 pr-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) focus:border-(--accent-color) outline-none"
            />
          </div>

          {/* 참가 클럽 */}
          <div
            role="tabpanel"
            id="clubs-panel-participating"
            aria-labelledby="clubs-tab-participating"
            hidden={tab !== "participating"}
          >
            {filteredParticipating.length === 0 ? (
              <EmptyState
                message={query ? "검색 결과가 없습니다." : "참가 클럽이 없습니다."}
              />
            ) : (
              <ClubTable
                rows={filteredParticipating.map((c) => ({
                  key: c.name,
                  name: c.name,
                  region: [c.city, c.district].filter(Boolean).join(" "),
                  badge: c.registered ? null : (
                    <Badge variant="warning">미등록 클럽</Badge>
                  ),
                  teamCount: c.teamCount,
                }))}
                showTeamCount
              />
            )}
          </div>

          {/* 미참가 클럽 */}
          <div
            role="tabpanel"
            id="clubs-panel-absent"
            aria-labelledby="clubs-tab-absent"
            hidden={tab !== "absent"}
          >
            {filteredAbsent.length === 0 ? (
              <EmptyState
                message={
                  query
                    ? "검색 결과가 없습니다."
                    : "모든 활성 클럽이 참가했습니다."
                }
              />
            ) : (
              <ClubTable
                rows={filteredAbsent.map((c) => ({
                  key: c.id,
                  name: c.name,
                  region: [c.city, c.district].filter(Boolean).join(" "),
                  badge: null,
                  teamCount: null,
                }))}
                showTeamCount={false}
              />
            )}
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button type="button" onClick={handleClose} className="btn-secondary btn-sm flex-1">
          닫기
        </button>
      </Modal.Footer>
    </Modal>
  );
}

// ─── 내부 프레젠테이션 컴포넌트 ─────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-10 text-center space-y-2">
      <Building2 className="w-8 h-8 mx-auto text-(--text-muted)" />
      <p className="text-sm text-(--text-muted)">{message}</p>
    </div>
  );
}

interface ClubRow {
  key: string;
  name: string;
  region: string;
  badge: React.ReactNode;
  teamCount: number | null;
}

function ClubTable({ rows, showTeamCount }: { rows: ClubRow[]; showTeamCount: boolean }) {
  return (
    <div className="rounded-lg border border-(--border-color) overflow-hidden">
      <div className="overflow-x-auto max-h-[50vh] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-(--bg-card)">
            <tr className="border-b border-(--border-color) text-(--text-secondary)">
              <th scope="col" className="text-left font-medium px-4 py-2.5 w-12">#</th>
              <th scope="col" className="text-left font-medium px-4 py-2.5">클럽명</th>
              <th scope="col" className="text-left font-medium px-4 py-2.5 hidden sm:table-cell">지역</th>
              {showTeamCount && (
                <th scope="col" className="text-right font-medium px-4 py-2.5 whitespace-nowrap">참가 팀</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-(--border-color)">
            {rows.map((row, idx) => (
              <tr key={row.key} className="hover:bg-(--bg-card-hover) transition-colors">
                <td className="px-4 py-2.5 text-(--text-muted) tabular-nums">{idx + 1}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-(--text-primary)">{row.name}</span>
                    {row.badge}
                  </div>
                  {row.region && (
                    <p className="text-sm text-(--text-muted) sm:hidden">{row.region}</p>
                  )}
                </td>
                <td className="px-4 py-2.5 text-(--text-secondary) hidden sm:table-cell">
                  {row.region || "-"}
                </td>
                {showTeamCount && (
                  <td className="px-4 py-2.5 text-right text-(--text-primary) tabular-nums whitespace-nowrap">
                    {row.teamCount}팀
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
