"use client";

import { useAuth } from "@/components/AuthProvider";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";

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

interface Match {
  id: string;
  score: string;
  completed_at: string;
  tournament: {
    title: string;
    location: string;
  };
  player1: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
  player2: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
  winner: {
    id: string;
    name: string;
  } | null;
}

export default function MyProfilePage() {
  const { user, profile, loading } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [tournaments, setTournaments] = useState<TournamentEntry[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeTab, setActiveTab] = useState<
    "profile" | "tournaments" | "matches"
  >("profile");

  useEffect(() => {
    if (user && profile) {
      // 데이터 로딩
      loadStats();
      loadTournaments();
      loadMatches();
    }
  }, [user, profile]);

  const loadStats = async () => {
    const { getUserStats } = await import("@/lib/data/user");
    const result = await getUserStats();
    if (!result.error && result.stats) {
      setStats(result.stats);
    }
  };

  const loadTournaments = async () => {
    const { getMyTournaments } = await import("@/lib/data/user");
    const result = await getMyTournaments();
    if (!result.error && result.entries) {
      setTournaments(result.entries as any);
    }
  };

  const loadMatches = async () => {
    const { getMyMatches } = await import("@/lib/data/user");
    const result = await getMyMatches();
    if (!result.error && result.matches) {
      setMatches(result.matches as any);
    }
  };

  if (loading) {
    return (
      <>
        <Navigation />
        <main
          className="min-h-screen pt-20"
          style={{ backgroundColor: "var(--bg-primary)" }}
        >
          <div className="max-w-6xl mx-auto px-6 py-12 text-center">
            <div className="animate-pulse">
              <div
                className="w-24 h-24 rounded-full mx-auto mb-4"
                style={{ backgroundColor: "var(--bg-card)" }}
              />
              <div
                className="h-8 w-48 mx-auto mb-2"
                style={{ backgroundColor: "var(--bg-card)" }}
              />
              <div
                className="h-4 w-64 mx-auto"
                style={{ backgroundColor: "var(--bg-card)" }}
              />
            </div>
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
    APPROVED: "승인됨",
    REJECTED: "거부됨",
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

          {/* 통계 카드 */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              <div className="glass-card p-6 text-center">
                <div
                  className="text-3xl font-display mb-2"
                  style={{ color: "var(--accent-color)" }}
                >
                  {stats.tournaments}
                </div>
                <div className="text-sm" style={{ color: "var(--text-muted)" }}>
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
                <div className="text-sm" style={{ color: "var(--text-muted)" }}>
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
                <div className="text-sm" style={{ color: "var(--text-muted)" }}>
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
                <div className="text-sm" style={{ color: "var(--text-muted)" }}>
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
                <div className="text-sm" style={{ color: "var(--text-muted)" }}>
                  승률
                </div>
              </div>
            </div>
          )}

          {/* 탭 메뉴 */}
          <div
            className="flex gap-2 mb-6 border-b"
            style={{ borderColor: "var(--border-color)" }}
          >
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
              참가 대회 ({tournaments.length})
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
              경기 결과 ({matches.length})
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
                    <span style={{ color: "var(--text-muted)" }}>이메일</span>
                    <span style={{ color: "var(--text-primary)" }}>
                      {profile.email}
                    </span>
                  </div>
                  <div
                    className="flex justify-between py-2 border-b"
                    style={{ borderColor: "var(--border-color)" }}
                  >
                    <span style={{ color: "var(--text-muted)" }}>연락처</span>
                    <span style={{ color: "var(--text-primary)" }}>
                      {profile.phone ? formatPhoneNumber(profile.phone) : "미등록"}
                    </span>
                  </div>
                  <div
                    className="flex justify-between py-2 border-b"
                    style={{ borderColor: "var(--border-color)" }}
                  >
                    <span style={{ color: "var(--text-muted)" }}>입문 년도</span>
                    <span style={{ color: "var(--text-primary)" }}>
                      {profile.start_year || "미등록"}
                    </span>
                  </div>
                  <div
                    className="flex justify-between py-2 border-b"
                    style={{ borderColor: "var(--border-color)" }}
                  >
                    <span style={{ color: "var(--text-muted)" }}>실력 점수</span>
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
            <div className="space-y-4">
              {tournaments.length === 0 ? (
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
                tournaments.map((entry) => (
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
                            entry.status === "APPROVED"
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
                        {new Date(entry.created_at).toLocaleDateString("ko-KR")}
                      </span>
                      <Link
                        href={`/tournaments/${entry.tournament.id}`}
                        className="text-sm font-display tracking-wider hover:underline"
                        style={{ color: "var(--accent-color)" }}
                      >
                        대회 상세보기 →
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* 경기 결과 탭 */}
          {activeTab === "matches" && (
            <div className="space-y-4">
              {matches.length === 0 ? (
                <div className="glass-card p-12 text-center">
                  <p className="text-lg" style={{ color: "var(--text-muted)" }}>
                    아직 완료된 경기가 없습니다
                  </p>
                </div>
              ) : (
                matches.map((match) => {
                  const isWinner = match.winner?.id === profile.id;
                  const opponent =
                    match.player1.id === profile.id
                      ? match.player2
                      : match.player1;

                  return (
                    <div key={match.id} className="glass-card p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex-1">
                          <h3
                            className="font-display mb-1"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {match.tournament.title}
                          </h3>
                          <p
                            className="text-sm"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {new Date(match.completed_at).toLocaleDateString(
                              "ko-KR",
                            )}{" "}
                            · {match.tournament.location}
                          </p>
                        </div>
                        <span
                          className={`px-4 py-2 rounded-full font-display tracking-wider text-sm ${
                            isWinner ? "badge-open" : "badge-closed"
                          }`}
                        >
                          {isWinner ? "승리" : "패배"}
                        </span>
                      </div>

                      <div
                        className="flex items-center justify-between py-4 px-6 rounded-lg"
                        style={{ backgroundColor: "var(--bg-card-hover)" }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center font-display text-sm font-bold"
                            style={{
                              backgroundColor: "var(--accent-color)",
                              color: "var(--bg-primary)",
                            }}
                          >
                            {profile.name.charAt(0)}
                          </div>
                          <span
                            className="font-medium"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {profile.name}
                          </span>
                        </div>

                        <div className="text-center px-6">
                          <div
                            className="text-2xl font-display"
                            style={{ color: "var(--accent-color)" }}
                          >
                            {match.score || "vs"}
                          </div>
                        </div>

                        <Link
                          href={`/users/${opponent.id}`}
                          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                        >
                          <span
                            className="font-medium text-right"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {opponent.name}
                          </span>
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center font-display text-sm font-bold cursor-pointer"
                            style={{
                              backgroundColor: opponent.avatar_url
                                ? "transparent"
                                : "var(--bg-card)",
                              color: "var(--text-secondary)",
                              border: "2px solid var(--border-color)",
                            }}
                          >
                            {opponent.avatar_url ? (
                              <img
                                src={opponent.avatar_url}
                                alt={opponent.name}
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              <span>{opponent.name.charAt(0)}</span>
                            )}
                          </div>
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
