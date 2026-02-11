"use client";

import { useAuth } from "@/components/AuthProvider";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { getUserStats, getMyTournaments, getMyMatches } from "@/lib/data/user";

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
  created_at: string;
  tournament: {
    id: string;
    title: string;
    start_date: string;
    location: string;
    status: string;
  };
}

interface BracketMatch {
  id: string;
  phase: string;
  roundNumber: number;
  matchNumber: number;
  team1Score: number | null;
  team2Score: number | null;
  winnerEntryId: string | null;
  completedAt: string;
  courtNumber: string | null;
  tournamentId: string | null;
  tournamentTitle: string;
  tournamentLocation: string;
  divisionName: string;
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
  const [stats, setStats] = useState<UserStats | null>(null);
  const [tournaments, setTournaments] = useState<TournamentEntry[]>([]);
  const [matches, setMatches] = useState<BracketMatch[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [tournamentsLoading, setTournamentsLoading] = useState(true);
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "profile" | "tournaments" | "matches"
  >("tournaments");

  useEffect(() => {
    if (user && profile) {
      loadStats();
      loadTournaments();
      loadMatches();
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

  const loadMatches = async () => {
    setMatchesLoading(true);
    const result = await getMyMatches();
    if (!result.error && result.matches) {
      setMatches(result.matches as BracketMatch[]);
    }
    setMatchesLoading(false);
  };

  // 인증 로딩 중 → 전체 스켈레톤
  if (loading) {
    return (
      <>
        <Navigation />
        <main
          className="min-h-screen pt-20"
          style={{ backgroundColor: "var(--bg-primary)" }}
        >
          <div className="max-w-6xl mx-auto px-6 py-12">
            <ProfileHeaderSkeleton />
            <StatsCardsSkeleton />
          </div>
        </main>
      </>
    );
  }

  if (!user || !profile) {
    return (
      <>
        <Navigation />
        <main
          className="min-h-screen pt-20 flex items-center justify-center"
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
        </main>
      </>
    );
  }

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
      <Navigation />
      <main
        className="min-h-screen pt-20"
        style={{ backgroundColor: "var(--bg-primary)" }}
      >
        <div className="max-w-6xl mx-auto px-6 py-12">
          {/* 프로필 헤더 */}
          <div className="glass-card p-8 mb-8">
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
                  {profile.club && (
                    <span
                      className="px-3 py-1 text-xs rounded-full font-display tracking-wider"
                      style={{
                        backgroundColor: "var(--bg-card-hover)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      🏢 {profile.club}
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

          {/* 통계 카드 — 로딩 중에도 항상 표시 */}
          {statsLoading ? (
            <StatsCardsSkeleton />
          ) : stats ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              <div className="glass-card p-6 text-center">
                <div
                  className="text-3xl font-display mb-2"
                  style={{ color: "var(--accent-color)" }}
                >
                  {stats.tournaments}
                </div>
                <div
                  className="text-sm"
                  style={{ color: "var(--text-muted)" }}
                >
                  참가 대회
                </div>
              </div>
              <div className="glass-card p-6 text-center">
                <div
                  className="text-3xl font-display mb-2"
                  style={{ color: "var(--accent-color)" }}
                >
                  {stats.totalMatches}
                </div>
                <div
                  className="text-sm"
                  style={{ color: "var(--text-muted)" }}
                >
                  총 경기
                </div>
              </div>
              <div className="glass-card p-6 text-center">
                <div
                  className="text-3xl font-display mb-2"
                  style={{ color: "var(--accent-color)" }}
                >
                  {stats.wins}
                </div>
                <div
                  className="text-sm"
                  style={{ color: "var(--text-muted)" }}
                >
                  승리
                </div>
              </div>
              <div className="glass-card p-6 text-center">
                <div
                  className="text-3xl font-display mb-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  {stats.losses}
                </div>
                <div
                  className="text-sm"
                  style={{ color: "var(--text-muted)" }}
                >
                  패배
                </div>
              </div>
              <div className="glass-card p-6 text-center">
                <div
                  className="text-3xl font-display mb-2"
                  style={{ color: "var(--accent-color)" }}
                >
                  {stats.winRate}%
                </div>
                <div
                  className="text-sm"
                  style={{ color: "var(--text-muted)" }}
                >
                  승률
                </div>
              </div>
            </div>
          ) : null}

          {/* 탭 메뉴 */}
          <div
            className="flex gap-2 mb-6 border-b"
            style={{ borderColor: "var(--border-color)" }}
          >
            <button
              onClick={() => setActiveTab("tournaments")}
              className={`px-6 py-3 font-display tracking-wider ${
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
              참가 대회 {!tournamentsLoading && `(${tournaments.length})`}
            </button>
            <button
              onClick={() => setActiveTab("matches")}
              className={`px-6 py-3 font-display tracking-wider ${
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
              경기 결과 {!matchesLoading && `(${matches.length})`}
            </button>
            <button
              onClick={() => setActiveTab("profile")}
              className={`px-6 py-3 font-display tracking-wider ${
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

              {/* 팔로워 섹션 (추후 구현 예정) */}
              <div className="glass-card p-6">
                <h3
                  className="text-xl font-display mb-4"
                  style={{ color: "var(--text-primary)" }}
                >
                  팔로워
                </h3>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div
                    className="text-center py-4 rounded-lg"
                    style={{ backgroundColor: "var(--bg-card-hover)" }}
                  >
                    <div
                      className="text-2xl font-display mb-1"
                      style={{ color: "var(--accent-color)" }}
                    >
                      0
                    </div>
                    <div
                      className="text-sm"
                      style={{ color: "var(--text-muted)" }}
                    >
                      팔로워
                    </div>
                  </div>
                  <div
                    className="text-center py-4 rounded-lg"
                    style={{ backgroundColor: "var(--bg-card-hover)" }}
                  >
                    <div
                      className="text-2xl font-display mb-1"
                      style={{ color: "var(--accent-color)" }}
                    >
                      0
                    </div>
                    <div
                      className="text-sm"
                      style={{ color: "var(--text-muted)" }}
                    >
                      팔로잉
                    </div>
                  </div>
                </div>
                <p
                  className="text-sm text-center"
                  style={{ color: "var(--text-muted)" }}
                >
                  팔로워 기능은 추후 업데이트 예정입니다
                </p>
              </div>
            </div>
          )}

          {/* 참가 대회 탭 */}
          {activeTab === "tournaments" && (
            tournamentsLoading ? (
              <TournamentListSkeleton />
            ) : tournaments.length === 0 ? (
              <div className="glass-card p-12 text-center">
                <p
                  className="text-lg mb-4"
                  style={{ color: "var(--text-muted)" }}
                >
                  아직 참가한 대회가 없습니다
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
                {tournaments.map((entry) => (
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
                        <span
                          className={`px-3 py-1 text-xs rounded-full font-display tracking-wider ${
                            entry.status === "CONFIRMED"
                              ? "badge-open"
                              : entry.status === "PENDING"
                                ? "badge-progress"
                                : "badge-closed"
                          }`}
                        >
                          {entryStatusLabels[entry.status]}
                        </span>
                        <span
                          className="text-xs"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {tournamentStatusLabels[entry.tournament.status]}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span
                        className="text-sm"
                        style={{ color: "var(--text-muted)" }}
                      >
                        신청일:{" "}
                        {new Date(entry.created_at).toLocaleDateString(
                          "ko-KR",
                        )}
                      </span>
                      <div className="flex items-center gap-3">
                        {(entry.tournament.status === "IN_PROGRESS" || entry.tournament.status === "COMPLETED") && entry.status === "CONFIRMED" && (
                          <Link
                            href={`/tournaments/${entry.tournament.id}/bracket`}
                            className="text-sm font-display tracking-wider px-3 py-1 rounded-lg hover:opacity-90"
                            style={{
                              backgroundColor: "var(--accent-color)",
                              color: "var(--bg-primary)",
                            }}
                          >
                            {entry.tournament.status === "COMPLETED" ? "대진표/결과 보기" : "대진표 보기"}
                          </Link>
                        )}
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

          {/* 경기 결과 탭 */}
          {activeTab === "matches" && (
            matchesLoading ? (
              <MatchListSkeleton />
            ) : matches.length === 0 ? (
              <div className="glass-card p-12 text-center">
                <p
                  className="text-lg"
                  style={{ color: "var(--text-muted)" }}
                >
                  아직 완료된 경기가 없습니다
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {matches.map((match) => {
                  const isWinner = match.winnerEntryId === match.myEntryId;
                  const isTeam1 = match.team1.entryId === match.myEntryId;
                  const myTeam = isTeam1 ? match.team1 : match.team2;
                  const opponent = isTeam1 ? match.team2 : match.team1;
                  const myScore = isTeam1 ? match.team1Score : match.team2Score;
                  const opponentScore = isTeam1 ? match.team2Score : match.team1Score;

                  // 복식이면 파트너 이름 표시
                  const myDisplayName = myTeam.partnerData
                    ? `${myTeam.name} / ${myTeam.partnerData.name}`
                    : myTeam.name;
                  const opponentDisplayName = opponent.partnerData
                    ? `${opponent.name} / ${opponent.partnerData.name}`
                    : opponent.name;

                  return (
                    <div key={match.id} className="glass-card p-5">
                      {/* 대회 정보 + 라운드 */}
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
                                style={{
                                  backgroundColor: "var(--bg-card-hover)",
                                  color: "var(--text-muted)",
                                }}
                              >
                                {match.divisionName}
                              </span>
                            )}
                          </div>
                          <p
                            className="text-xs"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {new Date(match.completedAt).toLocaleDateString("ko-KR")}
                            {match.tournamentLocation && ` · ${match.tournamentLocation}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{
                              backgroundColor: "var(--bg-card-hover)",
                              color: "var(--text-secondary)",
                            }}
                          >
                            {PHASE_LABELS[match.phase] || match.phase}
                          </span>
                          <span
                            className={`px-3 py-1 rounded-full font-display tracking-wider text-xs ${
                              isWinner ? "badge-open" : "badge-closed"
                            }`}
                          >
                            {isWinner ? "승" : "패"}
                          </span>
                        </div>
                      </div>

                      {/* 스코어보드 */}
                      <div
                        className="flex items-center justify-between py-3 px-4 rounded-xl"
                        style={{ backgroundColor: "var(--bg-card-hover)" }}
                      >
                        {/* 나 */}
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-sm font-medium truncate"
                            style={{
                              color: isWinner
                                ? "var(--accent-color)"
                                : "var(--text-primary)",
                            }}
                          >
                            {myDisplayName}
                          </p>
                        </div>

                        {/* 점수 */}
                        <div className="flex items-center gap-2 px-4 shrink-0">
                          <span
                            className="text-xl font-display min-w-[1.5rem] text-right"
                            style={{
                              color: isWinner
                                ? "var(--accent-color)"
                                : "var(--text-primary)",
                            }}
                          >
                            {myScore ?? "-"}
                          </span>
                          <span
                            className="text-sm"
                            style={{ color: "var(--text-muted)" }}
                          >
                            :
                          </span>
                          <span
                            className="text-xl font-display min-w-[1.5rem] text-left"
                            style={{
                              color: !isWinner
                                ? "var(--accent-color)"
                                : "var(--text-primary)",
                            }}
                          >
                            {opponentScore ?? "-"}
                          </span>
                        </div>

                        {/* 상대 */}
                        <div className="flex-1 min-w-0 text-right">
                          <p
                            className="text-sm font-medium truncate"
                            style={{
                              color: !isWinner
                                ? "var(--accent-color)"
                                : "var(--text-primary)",
                            }}
                          >
                            {opponentDisplayName}
                          </p>
                        </div>
                      </div>

                      {/* 대진표 링크 */}
                      {match.tournamentId && (
                        <div className="mt-2 text-right">
                          <Link
                            href={`/tournaments/${match.tournamentId}/bracket`}
                            className="text-xs hover:underline"
                            style={{ color: "var(--accent-color)" }}
                          >
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
        </div>
      </main>
    </>
  );
}
