"use client";

import { formatKoreanDate, formatKoreanDateTime } from '@/lib/utils/formatDate'
import { useAuth } from "@/components/AuthProvider";
import { useFontSize } from "@/components/FontSizeProvider";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { getUserStats, getMyTournaments, getMyMatches, getMyInvitedEntries } from "@/lib/data/user";
import { getMyClubMemberships } from "@/lib/clubs/actions";
import type { Club, ClubMember } from "@/lib/clubs/types";
import { useTournamentStatusRealtime } from "@/lib/realtime/useTournamentStatusRealtime";
import { useBracketConfigRealtime } from "@/lib/realtime/useBracketConfigRealtime";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Badge, type BadgeVariant } from "@/components/common/Badge";
import { ProfileAwards } from "@/components/awards/ProfileAwards";
import { getMyAwards } from "@/lib/awards/actions";
import { ScoreInputModal } from "@/components/tournaments/ScoreInputModal";
import { submitPlayerScore } from "@/lib/bracket/actions";
import { Toast } from "@/components/common/Toast";
import type { Database, SetDetail } from "@/lib/supabase/types";
import { confirmBankTransfer, deleteEntry } from "@/lib/entries/actions";
import { ConfirmDialog } from "@/components/common/AlertDialog";

// 전화번호 포맷팅 (010-1234-5678)
function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 3) {
    return digits;
  } else if (digits.length <= 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  } else {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  }
}

interface UserStats {
  tournaments: number;
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: number;
}

interface TournamentEntry {
  id: string;
  status: string;
  payment_status: string;
  refund_status: string | null;
  created_at: string;
  player_name: string;
  player_rating: number | null;
  club_name: string | null;
  team_order: string | null;
  partner_data: { name: string; club?: string | null; rating: number } | null;
  team_members: Array<{ name: string; rating: number }> | null;
  applicant_participates: boolean | null;
  tournament: {
    id: string;
    title: string;
    start_date: string;
    location: string;
    status: string;
    entry_fee: number;
    bank_account: string | null;
    match_type: string | null;
  };
  division: { id: string; name: string } | null;
  hasBracket: boolean;
  current_rank: number | null;
}

interface BracketMatch {
  id: string;
  phase: string;
  roundNumber: number;
  matchNumber: number;
  status: string;
  setsDetail: SetDetail[] | null;
  team1Score: number | null;
  team2Score: number | null;
  winnerEntryId: string | null;
  completedAt: string | null;
  courtNumber: string | null;
  configId: string;
  tournamentId: string | null;
  tournamentTitle: string;
  tournamentLocation: string;
  isInProgress: boolean;
  divisionName: string;
  matchType: string | null;
  teamMatchCount: number | null;
  myEntryId: string;
  team1: {
    entryId: string | null;
    name: string;
    partnerData: { name: string; club?: string } | null;
  };
  team2: {
    entryId: string | null;
    name: string;
    partnerData: { name: string; club?: string } | null;
  };
}

const PHASE_LABELS: Record<string, string> = {
  PRELIMINARY: "예선",
  ROUND_32: "32강",
  ROUND_16: "16강",
  QUARTER: "8강",
  SEMI: "4강",
  FINAL: "결승",
  THIRD_PLACE: "3/4위전",
};

/* ─── 스켈레톤 컴포넌트들 ─── */

function ProfileHeaderSkeleton() {
  return (
    <div className="glass-card p-8 mb-8">
      <div className="flex items-start gap-6">
        <Skeleton className="w-24 h-24 rounded-full shrink-0" />
        <div className="flex-1">
          <Skeleton className="h-8 w-40 mb-3" />
          <Skeleton className="h-4 w-56 mb-4" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <Skeleton className="h-9 w-24 mt-4 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

function StatsCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="glass-card p-6 flex flex-col items-center">
          <Skeleton className="h-9 w-12 mb-2" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

function TournamentListSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="glass-card p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MatchListSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1">
              <Skeleton className="h-5 w-44 mb-2" />
              <Skeleton className="h-4 w-36" />
            </div>
            <Skeleton className="h-8 w-14 rounded-full" />
          </div>
          <div
            className="flex items-center justify-between py-4 px-6 rounded-lg"
            style={{ backgroundColor: "var(--bg-card-hover)" }}
          >
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-7 w-16" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="w-10 h-10 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── 메인 페이지 ─── */

export default function MyProfilePage() {
  const { user, profile, loading } = useAuth();
  const { isLarge, toggleFontSize } = useFontSize();
  type MyAward = Database['public']['Tables']['tournament_awards']['Row'];
  const [stats, setStats] = useState<UserStats | null>(null);
  const [tournaments, setTournaments] = useState<TournamentEntry[]>([]);
  const [invitedEntries, setInvitedEntries] = useState<TournamentEntry[]>([]);
  const [invitedLoading, setInvitedLoading] = useState(true);
  const [matches, setMatches] = useState<BracketMatch[]>([]);
  const [awards, setAwards] = useState<MyAward[]>([]);
  const [myAwardIds, setMyAwardIds] = useState<string[]>([]);
  const [clubMemberships, setClubMemberships] = useState<Array<{ club: Club; membership: ClubMember }>>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [tournamentsLoading, setTournamentsLoading] = useState(true);
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [awardsLoading, setAwardsLoading] = useState(true);
  const [scoreModalMatch, setScoreModalMatch] = useState<BracketMatch | null>(null);
  const [scoreToast, setScoreToast] = useState({ isOpen: false, message: '', type: 'success' as 'success' | 'error' });
  // 신청 현황 — 취소 확인 / 액션 로딩
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "profile" | "applications" | "tournaments" | "matches" | "awards"
  >("applications");

  useEffect(() => {
    if (user && profile) {
      loadStats();
      loadTournaments();
      loadInvitedEntries();
      loadMatches();
      loadAwards();
      getMyClubMemberships().then((r) => setClubMemberships(r.data || []));
    }
  }, [user, profile]);

  const loadStats = async () => {
    setStatsLoading(true);
    const result = await getUserStats();
    if (!result.error && result.stats) {
      setStats(result.stats);
    }
    setStatsLoading(false);
  };

  const loadTournaments = async () => {
    setTournamentsLoading(true);
    const result = await getMyTournaments();
    if (!result.error && result.entries) {
      setTournaments(result.entries as TournamentEntry[]);
    }
    setTournamentsLoading(false);
  };

  const loadInvitedEntries = async () => {
    setInvitedLoading(true);
    const result = await getMyInvitedEntries();
    if (!result.error && result.entries) {
      setInvitedEntries(result.entries as TournamentEntry[]);
    }
    setInvitedLoading(false);
  };

  // 참가 대회 ID 목록 (Realtime 구독용)
  const tournamentIds = useMemo(
    () => [...tournaments.map((e) => e.tournament.id), ...invitedEntries.map((e) => e.tournament.id)],
    [tournaments, invitedEntries],
  );

  // 신청 현황: 내가 직접 신청한 전체 목록
  const applicationEntries = tournaments;

  // 대회 상태 변경 실시간 감지 → 내 대회 탭 즉시 반영
  const handleTournamentStatusChange = useCallback(
    (tournamentId: string, newStatus: string) => {
      setTournaments((prev) =>
        prev.map((entry) =>
          entry.tournament.id === tournamentId
            ? {
                ...entry,
                tournament: { ...entry.tournament, status: newStatus },
              }
            : entry,
        ),
      );
    },
    [],
  );

  // bracket_config 활성 라운드 변경 → 내 경기 탭 결과 입력 버튼 즉시 반영
  const bracketConfigIds = useMemo(
    () => [...new Set(matches.map((m) => m.configId).filter(Boolean))],
    [matches],
  );

  const handleConfigChange = useCallback(
    (configId: string, activePhase: string | null, activeRound: number | null) => {
      setMatches((prev) =>
        prev.map((match) => {
          if (match.configId !== configId) return match;
          const isInProgress = (() => {
            if (!activePhase) return false;
            if (activePhase === "PRELIMINARY") return match.phase === "PRELIMINARY";
            if (activePhase === "MAIN") {
              const isMainPhase = match.phase !== "PRELIMINARY";
              return isMainPhase && (activeRound === null || match.roundNumber === activeRound);
            }
            return false;
          })();
          return { ...match, isInProgress };
        }),
      );
    },
    [],
  );

  useBracketConfigRealtime({
    configIds: bracketConfigIds,
    onConfigChange: handleConfigChange,
    enabled: matches.length > 0,
  });

  useTournamentStatusRealtime({
    tournamentIds,
    onStatusChange: handleTournamentStatusChange,
    enabled: !tournamentsLoading && tournaments.length > 0,
  });

  // 대진표 생성/삭제 감지 → hasBracket 즉시 반영
  const myDivisionIds = useMemo(
    () => tournaments.map((e) => e.division?.id).filter((id): id is string => Boolean(id)),
    [tournaments],
  );
  const bracketDivChannelRef = useRef<RealtimeChannel | null>(null);
  const bracketDivIdsKeyRef = useRef("");

  useEffect(() => {
    if (myDivisionIds.length === 0) return;

    const key = [...myDivisionIds].sort().join(",");
    if (key === bracketDivIdsKeyRef.current) return;
    bracketDivIdsKeyRef.current = key;

    const supabase = createClient();
    if (bracketDivChannelRef.current) {
      supabase.removeChannel(bracketDivChannelRef.current);
    }

    const channel = supabase
      .channel(`bracket-div-${key.slice(0, 8)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bracket_configs" },
        (payload) => {
          // DELETE 이벤트: payload.new가 없고 payload.old에 데이터
          const isDelete = payload.eventType === "DELETE";
          const row = (isDelete ? payload.old : payload.new) as {
            division_id?: string;
            id?: string;
            status?: string;
          };
          if (!row.division_id || !myDivisionIds.includes(row.division_id)) return;

          const divisionId = row.division_id;

          if (isDelete) {
            // 대진표 config 삭제 → hasBracket=false
            setTournaments((prev) =>
              prev.map((e) =>
                e.division?.id === divisionId ? { ...e, hasBracket: false } : e,
              ),
            );
            return;
          }

          // INSERT/UPDATE: status가 PRELIMINARY 또는 MAIN이면 hasBracket=true
          // (match count 조회 시 config 업데이트와 match 삽입 사이 타이밍 문제 발생)
          const hasBracket = row.status === "PRELIMINARY" || row.status === "MAIN" || row.status === "COMPLETED";
          setTournaments((prev) =>
            prev.map((e) =>
              e.division?.id === divisionId ? { ...e, hasBracket } : e,
            ),
          );
        },
      )
      .subscribe();

    bracketDivChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      bracketDivChannelRef.current = null;
      bracketDivIdsKeyRef.current = "";
    };
  }, [myDivisionIds]);

  const loadMatches = async () => {
    setMatchesLoading(true);
    const result = await getMyMatches();
    if (!result.error && result.matches) {
      setMatches(result.matches as BracketMatch[]);
    }
    setMatchesLoading(false);
  };

  const loadAwards = async () => {
    if (!user || !profile) return;
    setAwardsLoading(true);
    try {
      const { myAwardIds: ids, awards: data } = await getMyAwards(user.id, profile.name);
      setMyAwardIds(ids);
      setAwards(data);
    } catch {
      // 에러 무시 (탭 접근 시 재시도 없음)
    }
    setAwardsLoading(false);
  };

  // 인증 로딩 중 → 전체 스켈레톤
  if (loading) {
    return (
      <>
        <div
          className=""
          style={{ backgroundColor: "var(--bg-primary)" }}
        >
          <div className="max-w-content mx-auto px-6 py-12">
            <ProfileHeaderSkeleton />
            <StatsCardsSkeleton />
          </div>
        </div>
      </>
    );
  }

  if (!user || !profile) {
    return (
      <>
        <div
          className="flex-1 flex items-center justify-center"
          style={{ backgroundColor: "var(--bg-primary)" }}
        >
          <div className="text-center">
            <h1
              className="text-3xl font-display mb-4"
              style={{ color: "var(--text-primary)" }}
            >
              로그인이 필요합니다
            </h1>
            <p className="mb-8" style={{ color: "var(--text-muted)" }}>
              마이페이지를 보려면 먼저 로그인해주세요.
            </p>
            <Link
              href="/auth/login"
              className="inline-block px-8 py-3 font-display tracking-wider rounded-xl hover:opacity-90"
              style={{
                backgroundColor: "var(--accent-color)",
                color: "var(--bg-primary)",
              }}
            >
              로그인하기
            </Link>
          </div>
        </div>
      </>
    );
  }

  // 입금완료 처리
  const handleConfirmPayment = async (entryId: string) => {
    setActionLoadingId(entryId);
    const result = await confirmBankTransfer(entryId);
    setActionLoadingId(null);
    if (result.success) {
      setScoreToast({ isOpen: true, message: '입금이 확인되었습니다.', type: 'success' });
      loadTournaments();
    } else {
      setScoreToast({ isOpen: true, message: result.error ?? '처리 중 오류가 발생했습니다.', type: 'error' });
    }
  };

  // 참가 취소 처리 (결제 없는 경우)
  const handleCancelEntry = async () => {
    if (!cancelConfirmId) return;
    setActionLoadingId(cancelConfirmId);
    setCancelConfirmId(null);
    const result = await deleteEntry(cancelConfirmId);
    setActionLoadingId(null);
    if (result.success) {
      setScoreToast({ isOpen: true, message: '참가 신청이 취소되었습니다.', type: 'success' });
      loadTournaments();
    } else {
      setScoreToast({ isOpen: true, message: result.error ?? '취소 중 오류가 발생했습니다.', type: 'error' });
    }
  };


  const handleScoreSubmit = async (team1Score: number, team2Score: number, setsDetail?: SetDetail[]) => {
    if (!scoreModalMatch) return;
    const result = await submitPlayerScore(scoreModalMatch.id, team1Score, team2Score, setsDetail);
    setScoreModalMatch(null);
    if (result.error) {
      setScoreToast({ isOpen: true, message: result.error, type: 'error' });
    } else {
      setScoreToast({ isOpen: true, message: '경기 결과가 저장되었습니다.', type: 'success' });
      loadMatches();
    }
  };

  // ScoreInputModal 호환 형식으로 변환
  const toModalMatch = (m: BracketMatch) => ({
    id: m.id,
    match_number: m.matchNumber,
    team1_entry_id: m.team1.entryId,
    team2_entry_id: m.team2.entryId,
    team1_score: m.team1Score,
    team2_score: m.team2Score,
    status: m.status,
    sets_detail: m.setsDetail,
    team1: { id: m.team1.entryId || '', player_name: m.team1.name, club_name: null, partner_data: m.team1.partnerData ? { name: m.team1.partnerData.name, rating: 0, club: m.team1.partnerData.club || null } : null },
    team2: { id: m.team2.entryId || '', player_name: m.team2.name, club_name: null, partner_data: m.team2.partnerData ? { name: m.team2.partnerData.name, rating: 0, club: m.team2.partnerData.club || null } : null },
  });

  const entryStatusLabels: Record<string, string> = {
    PENDING: "대기 중",
    CONFIRMED: "승인됨",
    WAITLISTED: "대기",
    CANCELLED: "취소됨",
  };

  const tournamentStatusLabels: Record<string, string> = {
    DRAFT: "작성 중",
    OPEN: "모집 중",
    CLOSED: "마감",
    IN_PROGRESS: "진행 중",
    COMPLETED: "종료",
    CANCELLED: "취소",
  };

  return (
    <>
      <div
        className=""
        style={{ backgroundColor: "var(--bg-primary)" }}
      >
        <div className="max-w-content mx-auto px-6 py-12">
          {/* 프로필 헤더 */}
          <div className="glass-card rounded-2xl p-8 mb-8">
            <div className="flex items-start gap-6">
              <div className="shrink-0">
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center font-display text-3xl font-bold"
                  style={{
                    backgroundColor: profile.avatar_url
                      ? "transparent"
                      : "var(--accent-color)",
                    color: profile.avatar_url
                      ? "var(--text-primary)"
                      : "var(--bg-primary)",
                    border: "3px solid var(--border-accent)",
                  }}
                >
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span>{profile.name.charAt(0).toUpperCase()}</span>
                  )}
                </div>
              </div>

              <div className="flex-1">
                <h1
                  className="text-3xl font-display mb-2"
                  style={{ color: "var(--text-primary)" }}
                >
                  {profile.name}
                </h1>
                <p
                  className="text-sm mb-4"
                  style={{ color: "var(--text-muted)" }}
                >
                  {profile.email}
                </p>

                <div className="flex flex-wrap gap-2">
                  {profile.start_year && (
                    <span
                      className="px-3 py-1 text-xs rounded-full font-display tracking-wider"
                      style={{
                        backgroundColor: "var(--bg-card-hover)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      🎾 {profile.start_year}
                    </span>
                  )}
                  {profile.rating && (
                    <span
                      className="px-3 py-1 text-xs rounded-full font-display tracking-wider"
                      style={{
                        backgroundColor: "var(--bg-card-hover)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      ⭐ {profile.rating}점
                    </span>
                  )}
                  {clubMemberships.length > 0
                    ? clubMemberships.map((m) => (
                        <span
                          key={m.club.id}
                          className="px-3 py-1 text-xs rounded-full font-display tracking-wider"
                          style={{
                            backgroundColor: m.membership.is_primary
                              ? "var(--accent-color)"
                              : "var(--bg-card-hover)",
                            color: m.membership.is_primary
                              ? "var(--bg-primary)"
                              : "var(--text-secondary)",
                          }}
                        >
                          {m.club.name}
                        </span>
                      ))
                    : profile.club && (
                        <span
                          className="px-3 py-1 text-xs rounded-full font-display tracking-wider"
                          style={{
                            backgroundColor: "var(--bg-card-hover)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {profile.club}
                        </span>
                      )}
                  {profile.role && profile.role !== "USER" && (
                    <span
                      className="px-3 py-1 text-xs rounded-full font-display tracking-wider"
                      style={{
                        backgroundColor: "var(--accent-color)",
                        color: "var(--bg-primary)",
                      }}
                    >
                      {profile.role === "SUPER_ADMIN"
                        ? "최고 관리자"
                        : profile.role === "ADMIN"
                          ? "관리자"
                          : profile.role === "MANAGER"
                            ? "운영자"
                            : ""}
                    </span>
                  )}
                </div>

                <Link
                  href="/my/profile/edit"
                  className="inline-block mt-4 px-4 py-2 text-sm rounded-lg hover:opacity-80"
                  style={{
                    backgroundColor: "var(--bg-card-hover)",
                    color: "var(--text-secondary)",
                  }}
                >
                  프로필 수정
                </Link>
              </div>
            </div>
          </div>


          {/* 탭 메뉴 — 모바일 가로 스크롤 시 우측 페이드로 힌트 */}
          <div className="relative mb-6">
            <div
              className="flex gap-1 md:gap-2 border-b overflow-x-auto scrollbar-none"
              style={{ borderColor: "var(--border-color)" }}
            >
            <button
              onClick={() => setActiveTab("applications")}
              className={`px-3 md:px-6 py-3 font-display tracking-wider whitespace-nowrap shrink-0 text-sm md:text-base ${
                activeTab === "applications" ? "border-b-2" : ""
              }`}
              style={{
                borderColor:
                  activeTab === "applications"
                    ? "var(--accent-color)"
                    : "transparent",
                color:
                  activeTab === "applications"
                    ? "var(--accent-color)"
                    : "var(--text-muted)",
              }}
            >
              신청 현황 {!tournamentsLoading && `(${applicationEntries.length})`}
            </button>
            <button
              onClick={() => setActiveTab("tournaments")}
              className={`px-3 md:px-6 py-3 font-display tracking-wider whitespace-nowrap shrink-0 text-sm md:text-base ${
                activeTab === "tournaments" ? "border-b-2" : ""
              }`}
              style={{
                borderColor:
                  activeTab === "tournaments"
                    ? "var(--accent-color)"
                    : "transparent",
                color:
                  activeTab === "tournaments"
                    ? "var(--accent-color)"
                    : "var(--text-muted)",
              }}
            >
              초대된 대회 {!invitedLoading && `(${invitedEntries.length})`}
            </button>
            <button
              onClick={() => setActiveTab("matches")}
              className={`px-3 md:px-6 py-3 font-display tracking-wider whitespace-nowrap shrink-0 text-sm md:text-base ${
                activeTab === "matches" ? "border-b-2" : ""
              }`}
              style={{
                borderColor:
                  activeTab === "matches"
                    ? "var(--accent-color)"
                    : "transparent",
                color:
                  activeTab === "matches"
                    ? "var(--accent-color)"
                    : "var(--text-muted)",
              }}
            >
              내 경기 {!matchesLoading && `(${matches.length})`}
            </button>
            <button
              onClick={() => setActiveTab("awards")}
              className={`px-3 md:px-6 py-3 font-display tracking-wider whitespace-nowrap shrink-0 text-sm md:text-base ${
                activeTab === "awards" ? "border-b-2" : ""
              }`}
              style={{
                borderColor:
                  activeTab === "awards"
                    ? "var(--accent-color)"
                    : "transparent",
                color:
                  activeTab === "awards"
                    ? "var(--accent-color)"
                    : "var(--text-muted)",
              }}
            >
              입상 기록 {!awardsLoading && awards.length > 0 && `(${awards.length})`}
            </button>
            <Link
              href="/my/lessons"
              className="px-3 md:px-6 py-3 font-display tracking-wider whitespace-nowrap shrink-0 text-sm md:text-base"
              style={{ color: "var(--text-muted)" }}
            >
              내 레슨
            </Link>
            <button
              onClick={() => setActiveTab("profile")}
              className={`px-3 md:px-6 py-3 font-display tracking-wider whitespace-nowrap shrink-0 text-sm md:text-base ${
                activeTab === "profile" ? "border-b-2" : ""
              }`}
              style={{
                borderColor:
                  activeTab === "profile"
                    ? "var(--accent-color)"
                    : "transparent",
                color:
                  activeTab === "profile"
                    ? "var(--accent-color)"
                    : "var(--text-muted)",
              }}
            >
              프로필
            </button>
            </div>
            {/* 우측 페이드 — 스크롤 가능 힌트 (모바일) */}
            <div
              className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none md:hidden"
              style={{
                background: "linear-gradient(to right, transparent, var(--bg-primary))",
              }}
            />
          </div>

          {/* 입상 기록 탭 */}
          {activeTab === "awards" && (
            awardsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="glass-card p-4 h-24 animate-pulse" />
                ))}
              </div>
            ) : (
              <ProfileAwards awards={awards} myAwardIds={myAwardIds} userId={user.id} />
            )
          )}

          {/* 프로필 탭 */}
          {activeTab === "profile" && (
            <div className="space-y-4">
              <div className="glass-card p-6">
                <h3
                  className="text-xl font-display mb-4"
                  style={{ color: "var(--text-primary)" }}
                >
                  기본 정보
                </h3>
                <div className="space-y-3">
                  <div
                    className="flex justify-between py-2 border-b"
                    style={{ borderColor: "var(--border-color)" }}
                  >
                    <span style={{ color: "var(--text-muted)" }}>
                      이메일
                    </span>
                    <span style={{ color: "var(--text-primary)" }}>
                      {profile.email}
                    </span>
                  </div>
                  <div
                    className="flex justify-between py-2 border-b"
                    style={{ borderColor: "var(--border-color)" }}
                  >
                    <span style={{ color: "var(--text-muted)" }}>
                      연락처
                    </span>
                    <span style={{ color: "var(--text-primary)" }}>
                      {profile.phone
                        ? formatPhoneNumber(profile.phone)
                        : "미등록"}
                    </span>
                  </div>
                  <div
                    className="flex justify-between py-2 border-b"
                    style={{ borderColor: "var(--border-color)" }}
                  >
                    <span style={{ color: "var(--text-muted)" }}>
                      입문 년도
                    </span>
                    <span style={{ color: "var(--text-primary)" }}>
                      {profile.start_year || "미등록"}
                    </span>
                  </div>
                  <div
                    className="flex justify-between py-2 border-b"
                    style={{ borderColor: "var(--border-color)" }}
                  >
                    <span style={{ color: "var(--text-muted)" }}>
                      실력 점수
                    </span>
                    <span style={{ color: "var(--text-primary)" }}>
                      {profile.rating ? `${profile.rating}점` : "미등록"}
                    </span>
                  </div>
                  <div
                    className="flex justify-between py-2 border-b"
                    style={{ borderColor: "var(--border-color)" }}
                  >
                    <span style={{ color: "var(--text-muted)" }}>
                      소속 클럽
                    </span>
                    <span style={{ color: "var(--text-primary)" }}>
                      {profile.club || "미등록"}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span style={{ color: "var(--text-muted)" }}>
                      클럽 지역
                    </span>
                    <span style={{ color: "var(--text-primary)" }}>
                      {profile.club_city && profile.club_district
                        ? `${profile.club_city} ${profile.club_district}`
                        : profile.club_city
                          ? profile.club_city
                          : "미등록"}
                    </span>
                  </div>
                </div>
              </div>

              {/* 팔로워 섹션 — 추후 구현 예정, 숨김 처리 */}

              {/* 화면 설정 */}
              <div className="glass-card p-6">
                <h3
                  className="text-xl font-display mb-4"
                  style={{ color: "var(--text-primary)" }}
                >
                  화면 설정
                </h3>
                <div
                  className="flex items-center justify-between py-3 border-b"
                  style={{ borderColor: "var(--border-color)" }}
                >
                  <div>
                    <p
                      className="text-sm font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      큰 글씨 모드
                    </p>
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: "var(--text-muted)" }}
                    >
                      텍스트를 1.25배 크게 표시합니다
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isLarge}
                    onClick={toggleFontSize}
                    className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-300 outline-none"
                    style={{
                      backgroundColor: isLarge
                        ? "var(--accent-color)"
                        : "var(--border-color)",
                    }}
                  >
                    <span className="sr-only">큰 글씨 모드</span>
                    <span
                      className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-300"
                      style={{
                        transform: isLarge
                          ? "translateX(1.375rem)"
                          : "translateX(0.25rem)",
                      }}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 신청 현황 탭 */}
          {activeTab === "applications" && (
            tournamentsLoading ? (
              <TournamentListSkeleton />
            ) : applicationEntries.length === 0 ? (
              <div className="glass-card p-12 text-center">
                <p
                  className="text-lg mb-4"
                  style={{ color: "var(--text-muted)" }}
                >
                  신청한 대회가 없습니다
                </p>
                <Link
                  href="/tournaments"
                  className="inline-block px-6 py-2 rounded-lg font-display tracking-wider hover:opacity-90"
                  style={{
                    backgroundColor: "var(--accent-color)",
                    color: "var(--bg-primary)",
                  }}
                >
                  대회 찾아보기
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {applicationEntries.map((entry) => {
                  const isLoading = actionLoadingId === entry.id;
                  const isPendingPayment = entry.tournament.entry_fee > 0 && entry.payment_status !== 'COMPLETED' && entry.status !== 'CANCELLED';
                  const canCancel = entry.status !== 'CANCELLED' && !entry.hasBracket;
                  const isTeam = entry.tournament.match_type === 'TEAM_SINGLES' || entry.tournament.match_type === 'TEAM_DOUBLES';

                  return (
                  <div key={entry.id} className="glass-card overflow-hidden rounded-2xl">
                    {/* 헤더: 대회명 + 위치/날짜 */}
                    <div className="px-4 pt-4 pb-2">
                      <h3
                        className="text-base font-display mb-0.5 truncate"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {entry.tournament.title}
                      </h3>
                      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                        {entry.tournament.location} · {formatKoreanDate(entry.tournament.start_date)}
                      </p>
                    </div>

                    {/* 배지 행: 대회 상태 · 부서 · 신청 상태 · 결제 상태 · 순번(마지막) */}
                    <div className="flex items-center gap-1.5 flex-wrap px-4 pb-3">
                      <Badge
                        variant={
                          entry.tournament.status === "OPEN" ? "success"
                          : entry.tournament.status === "IN_PROGRESS" ? "purple"
                          : entry.tournament.status === "COMPLETED" ? "secondary"
                          : entry.tournament.status === "CLOSED" ? "orange"
                          : entry.tournament.status === "CANCELLED" ? "danger"
                          : "secondary"
                        }
                        className="font-display tracking-wider"
                      >
                        {tournamentStatusLabels[entry.tournament.status] ?? entry.tournament.status}
                      </Badge>
                      {entry.division && (
                        <Badge variant="info" className="font-display tracking-wider">
                          {entry.division.name}
                        </Badge>
                      )}
                      <Badge
                        variant={
                          entry.status === "CONFIRMED" ? "success"
                          : entry.status === "PENDING" ? "warning"
                          : entry.status === "WAITLISTED" ? "info"
                          : "secondary"
                        }
                        className="font-display tracking-wider"
                      >
                        {entryStatusLabels[entry.status] ?? entry.status}
                      </Badge>
                      {entry.tournament.entry_fee > 0 && (
                        entry.status === 'CANCELLED' && entry.payment_status === 'COMPLETED' ? (
                          entry.refund_status === 'COMPLETED' ? (
                            <Badge variant="success">환불 완료</Badge>
                          ) : (
                            <Badge variant="orange">환불 대기</Badge>
                          )
                        ) : entry.payment_status === 'COMPLETED' ? (
                          <Badge variant="success">입금 확인됨</Badge>
                        ) : entry.status !== 'CANCELLED' ? (
                          <Badge variant="warning">입금 대기</Badge>
                        ) : null
                      )}
                      {(entry.status === "PENDING" || entry.status === "WAITLISTED") && entry.current_rank != null && (
                        <span className="text-sm font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                          #{entry.current_rank}번 대기
                        </span>
                      )}
                    </div>

                    {/* 참가자 정보 */}
                    <div
                      className="mx-4 mb-3 p-3 rounded-xl text-sm space-y-1.5"
                      style={{ backgroundColor: "var(--bg-card-hover)" }}
                    >
                      <div className="flex items-center gap-3 flex-wrap">
                        {isTeam && entry.club_name && (
                          <span style={{ color: "var(--text-primary)" }}>
                            {entry.club_name}{entry.team_order ? ` ${entry.team_order}팀` : ""}
                          </span>
                        )}
                        {!isTeam && (
                          <span style={{ color: "var(--text-primary)" }}>
                            {entry.player_name}
                            {entry.player_rating != null && (
                              <span className="ml-1.5" style={{ color: "var(--text-secondary)" }}>
                                {entry.player_rating}점
                              </span>
                            )}
                          </span>
                        )}
                        {/* 복식 파트너 */}
                        {entry.partner_data && (
                          <span style={{ color: "var(--text-secondary)" }}>
                            파트너: {entry.partner_data.name}
                            {entry.partner_data.rating ? ` (${entry.partner_data.rating}점)` : ""}
                          </span>
                        )}
                        {/* 참가비 (텍스트만) */}
                        {entry.tournament.entry_fee > 0 && (
                          <span style={{ color: "var(--text-secondary)" }}>
                            참가비 {entry.tournament.entry_fee.toLocaleString()}원
                          </span>
                        )}
                      </div>
                      {/* 단체전 팀원 */}
                      {isTeam && entry.team_members && entry.team_members.length > 0 && (
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          {entry.applicant_participates && (
                            <span style={{ color: "var(--text-secondary)" }}>
                              본인: {entry.player_name}
                            </span>
                          )}
                          {entry.team_members.map((m, i) => (
                            <span key={i} style={{ color: "var(--text-secondary)" }}>
                              {i + (entry.applicant_participates ? 2 : 1)}. {m.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 하단 액션 */}
                    <div
                      className="flex items-center justify-between px-4 py-3 border-t"
                      style={{ borderColor: "var(--border-color)" }}
                    >
                      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                        신청일 {/* suppressHydrationWarning */}
                        {new Date(entry.created_at).toLocaleDateString("ko-KR")}
                      </span>
                      <div className="flex items-center gap-2">
                        {/* 입금완료 버튼 */}
                        {isPendingPayment && (
                          <button
                            type="button"
                            onClick={() => handleConfirmPayment(entry.id)}
                            disabled={isLoading}
                            className="text-sm font-display tracking-wider px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                            style={{
                              backgroundColor: "var(--accent-color)",
                              color: "var(--bg-primary)",
                            }}
                          >
                            {isLoading ? "처리 중..." : "입금완료"}
                          </button>
                        )}
                        {/* 참가 취소 버튼 */}
                        {canCancel && (
                          <button
                            type="button"
                            onClick={() => setCancelConfirmId(entry.id)}
                            disabled={isLoading}
                            className="text-sm font-display tracking-wider px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50"
                            style={{
                              borderColor: "var(--border-color)",
                              color: "var(--text-secondary)",
                            }}
                          >
                            참가 취소
                          </button>
                        )}
                        {/* 대진표 보기 버튼 */}
                        {entry.hasBracket && entry.status === "CONFIRMED" && (
                          <Link
                            href={`/tournaments/${entry.tournament.id}/bracket${entry.division ? `?divisionId=${entry.division.id}` : ''}`}
                            className="text-sm font-display tracking-wider px-3 py-1.5 rounded-lg transition-colors"
                            style={{
                              backgroundColor: "var(--accent-color)",
                              color: "var(--bg-primary)",
                            }}
                          >
                            대진표 보기
                          </Link>
                        )}
                        <Link
                          href={`/tournaments/${entry.tournament.id}`}
                          className="text-sm font-display tracking-wider hover:underline"
                          style={{ color: "var(--accent-color)" }}
                        >
                          대회 보기 →
                        </Link>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )
          )}

          {/* 초대된 대회 탭 */}
          {activeTab === "tournaments" && (
            invitedLoading ? (
              <TournamentListSkeleton />
            ) : invitedEntries.length === 0 ? (
              <div className="glass-card p-12 text-center">
                <p
                  className="text-lg mb-4"
                  style={{ color: "var(--text-muted)" }}
                >
                  다른 사람이 파트너로 등록한 대회가 없습니다
                </p>
                <Link
                  href="/tournaments"
                  className="inline-block px-6 py-2 rounded-lg font-display tracking-wider hover:opacity-90"
                  style={{
                    backgroundColor: "var(--accent-color)",
                    color: "var(--bg-primary)",
                  }}
                >
                  대회 찾아보기
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {invitedEntries.map((entry) => (
                  <div key={entry.id} className="glass-card p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3
                          className="text-xl font-display mb-2"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {entry.tournament.title}
                        </h3>
                        <p
                          className="text-sm"
                          style={{ color: "var(--text-muted)" }}
                        >
                          📍 {entry.tournament.location}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge
                          variant={
                            entry.status === "CONFIRMED"
                              ? "success"
                              : entry.status === "PENDING"
                                ? "warning"
                                : "secondary"
                          }
                          className="font-display tracking-wider"
                        >
                          {entryStatusLabels[entry.status]}
                        </Badge>
                        <span
                          className="text-xs"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {tournamentStatusLabels[entry.tournament.status]}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        {entry.division && (
                          <Badge variant="info" className="font-display tracking-wider">
                            {entry.division.name}
                          </Badge>
                        )}
                        <span
                          className="text-sm"
                          style={{ color: "var(--text-muted)" }}
                        >
                          신청자: {entry.player_name}
                        </span>
                        <span
                          className="text-sm"
                          style={{ color: "var(--text-muted)" }}
                        >
                          시합일: {formatKoreanDate(entry.tournament.start_date)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {(entry.tournament.status === "IN_PROGRESS" || entry.tournament.status === "COMPLETED") && entry.status === "CONFIRMED" && (() => {
                          const label = entry.tournament.status === "COMPLETED" ? "대진표/결과 보기" : "대진표 보기";
                          if (entry.hasBracket) {
                            return (
                              <Link
                                href={`/tournaments/${entry.tournament.id}/bracket${entry.division ? `?divisionId=${entry.division.id}` : ''}`}
                                className="text-sm font-display tracking-wider px-3 py-1 rounded-lg hover:opacity-90"
                                style={{ backgroundColor: "var(--accent-color)", color: "var(--bg-primary)" }}
                              >
                                {label}
                              </Link>
                            );
                          }
                          return (
                            <span
                              className="text-sm font-display tracking-wider px-3 py-1 rounded-lg opacity-40 cursor-not-allowed"
                              style={{ backgroundColor: "var(--bg-card-hover)", color: "var(--text-muted)" }}
                              title="대진표가 아직 작성되지 않았습니다"
                            >
                              {label}
                            </span>
                          );
                        })()}
                        <Link
                          href={`/tournaments/${entry.tournament.id}`}
                          className="text-sm font-display tracking-wider hover:underline"
                          style={{ color: "var(--accent-color)" }}
                        >
                          대회 상세보기 →
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* 내 경기 탭 */}
          {activeTab === "matches" && (
            matchesLoading || statsLoading ? (
              <MatchListSkeleton />
            ) : (
              <div className="space-y-4">
                {/* 경기 요약 통계 */}
                {stats && (
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "총 경기", value: stats.totalMatches, accent: true },
                      { label: "승 / 패", value: `${stats.wins} / ${stats.losses}`, accent: false },
                      { label: "승률", value: `${stats.winRate}%`, accent: true },
                    ].map((item) => (
                      <div key={item.label} className="glass-card rounded-xl p-4 text-center">
                        <div
                          className="text-2xl font-display mb-1"
                          style={{ color: item.accent ? "var(--accent-color)" : "var(--text-muted)" }}
                        >
                          {item.value}
                        </div>
                        <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {item.label}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {matches.length === 0 ? (
                  <div className="glass-card p-12 text-center">
                    <p className="text-lg" style={{ color: "var(--text-muted)" }}>
                      예정된 경기가 없습니다
                    </p>
                  </div>
                ) : null}
                {matches.map((match) => {
                  const isScheduled = match.status === "SCHEDULED";
                  const isTeam1 = match.team1.entryId === match.myEntryId;
                  const myTeam = isTeam1 ? match.team1 : match.team2;
                  const opponent = isTeam1 ? match.team2 : match.team1;

                  const myDisplayName = myTeam.partnerData
                    ? `${myTeam.name} / ${myTeam.partnerData.name}`
                    : myTeam.name;
                  const opponentDisplayName = opponent.partnerData
                    ? `${opponent.name} / ${opponent.partnerData.name}`
                    : opponent.name;

                  if (isScheduled) {
                    // ── 예정 경기 카드 ──
                    return (
                      <div
                        key={match.id}
                        className="glass-card p-5"
                        style={{ borderLeft: "3px solid var(--accent-color)" }}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3
                                className="font-display text-sm truncate"
                                style={{ color: "var(--text-primary)" }}
                              >
                                {match.tournamentTitle}
                              </h3>
                              {match.divisionName && (
                                <span
                                  className="text-xs px-2 py-0.5 rounded-full shrink-0"
                                  style={{ backgroundColor: "var(--bg-card-hover)", color: "var(--text-muted)" }}
                                >
                                  {match.divisionName}
                                </span>
                              )}
                            </div>
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                              {PHASE_LABELS[match.phase] || match.phase}
                              {match.tournamentLocation && ` · ${match.tournamentLocation}`}
                            </p>
                          </div>
                          <Badge
                            variant={match.isInProgress ? "success" : "info"}
                            className="font-display tracking-wider shrink-0 ml-3"
                          >
                            {match.isInProgress ? "진행중" : "예정"}
                          </Badge>
                        </div>

                        {/* 대전 상대 */}
                        <div
                          className="flex items-center justify-between py-3 px-4 rounded-xl mb-3"
                          style={{ backgroundColor: "var(--bg-card-hover)" }}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: "var(--accent-color)" }}>
                              {myDisplayName}
                            </p>
                          </div>
                          <span className="text-sm px-3" style={{ color: "var(--text-muted)" }}>vs</span>
                          <div className="flex-1 min-w-0 text-right">
                            <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                              {opponentDisplayName}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div />
                          {match.isInProgress && (
                            <button
                              onClick={() => setScoreModalMatch(match)}
                              className="text-sm font-display tracking-wider px-4 py-1.5 rounded-lg hover:opacity-90"
                              style={{ backgroundColor: "var(--accent-color)", color: "var(--bg-primary)" }}
                            >
                              결과 입력
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // ── 완료된 경기 카드 ──
                  const isWinner = match.winnerEntryId === match.myEntryId;
                  const myScore = isTeam1 ? match.team1Score : match.team2Score;
                  const opponentScore = isTeam1 ? match.team2Score : match.team1Score;

                  return (
                    <div key={match.id} className="glass-card p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3
                              className="font-display text-sm truncate"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {match.tournamentTitle}
                            </h3>
                            {match.divisionName && (
                              <span
                                className="text-xs px-2 py-0.5 rounded-full shrink-0"
                                style={{ backgroundColor: "var(--bg-card-hover)", color: "var(--text-muted)" }}
                              >
                                {match.divisionName}
                              </span>
                            )}
                          </div>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {match.completedAt && new Date(match.completedAt).toLocaleDateString("ko-KR")}
                            {match.tournamentLocation && ` · ${match.tournamentLocation}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: "var(--bg-card-hover)", color: "var(--text-secondary)" }}
                          >
                            {PHASE_LABELS[match.phase] || match.phase}
                          </span>
                          <Badge variant={isWinner ? "success" : "secondary"} className="font-display tracking-wider">
                            {isWinner ? "승" : "패"}
                          </Badge>
                        </div>
                      </div>

                      <div
                        className="flex items-center justify-between py-3 px-4 rounded-xl"
                        style={{ backgroundColor: "var(--bg-card-hover)" }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: isWinner ? "var(--accent-color)" : "var(--text-primary)" }}>
                            {myDisplayName}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 px-4 shrink-0">
                          <span className="text-xl font-display min-w-[1.5rem] text-right" style={{ color: isWinner ? "var(--accent-color)" : "var(--text-primary)" }}>
                            {myScore ?? "-"}
                          </span>
                          <span className="text-sm" style={{ color: "var(--text-muted)" }}>:</span>
                          <span className="text-xl font-display min-w-[1.5rem] text-left" style={{ color: !isWinner ? "var(--accent-color)" : "var(--text-primary)" }}>
                            {opponentScore ?? "-"}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 text-right">
                          <p className="text-sm font-medium truncate" style={{ color: !isWinner ? "var(--accent-color)" : "var(--text-primary)" }}>
                            {opponentDisplayName}
                          </p>
                        </div>
                      </div>

                      {match.tournamentId && (
                        <div className="mt-2 text-right">
                          <Link href={`/tournaments/${match.tournamentId}/bracket`} className="text-xs hover:underline" style={{ color: "var(--accent-color)" }}>
                            대진표 보기 →
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* 참가 취소 확인 다이얼로그 */}
          <ConfirmDialog
            isOpen={cancelConfirmId !== null}
            onClose={() => setCancelConfirmId(null)}
            onConfirm={handleCancelEntry}
            title="참가 신청 취소"
            message={(() => {
              const entry = applicationEntries.find((e) => e.id === cancelConfirmId);
              return entry?.payment_status === 'COMPLETED'
                ? '입금 완료된 참가비는 신청 시 등록한 계좌로 환불 처리됩니다. 취소하시겠습니까?'
                : '참가 신청을 취소하시겠습니까? 취소 후에는 되돌릴 수 없습니다.';
            })()}
            type="warning"
            confirmText="취소하기"
            cancelText="아니오"
          />

          {/* 점수 입력 모달 */}
          {scoreModalMatch && (
            <ScoreInputModal
              isOpen={true}
              onClose={() => setScoreModalMatch(null)}
              match={toModalMatch(scoreModalMatch)}
              matchType={(scoreModalMatch.matchType as Parameters<typeof ScoreInputModal>[0]['matchType']) ?? null}
              teamMatchCount={scoreModalMatch.teamMatchCount}
              onSubmit={handleScoreSubmit}
            />
          )}

          <Toast
            isOpen={scoreToast.isOpen}
            onClose={() => setScoreToast({ ...scoreToast, isOpen: false })}
            message={scoreToast.message}
            type={scoreToast.type}
            duration={3000}
          />
        </div>
      </div>
    </>
  );
}
