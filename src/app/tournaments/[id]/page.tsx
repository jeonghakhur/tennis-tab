import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Image from "next/image";
import { TournamentStatus, MatchType } from "@/lib/supabase/types";
import TournamentActions from "@/components/tournaments/TournamentActions";
import TournamentMap from "@/components/tournaments/TournamentMap";
import TournamentEntryActionsNew from "@/components/tournaments/TournamentEntryActionsNew";
import { TournamentRealtimeRefresher } from "@/components/tournaments/TournamentRealtimeRefresher";

interface Props {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function TournamentDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  // 현재 사용자 정보 가져오기
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: tournament, error } = await supabase
    .from("tournaments")
    .select(
      `
      *,
      profiles (name, email),
      tournament_divisions (*)
    `,
    )
    .eq("id", id)
    .single();

  if (error || !tournament) {
    notFound();
  }

  // 대진표 존재 여부 확인 (bracket_configs는 division_id 기준)
  const divisionIds = (tournament.tournament_divisions || []).map(
    (d: { id: string }) => d.id,
  );
  let hasBracket = false;
  if (divisionIds.length > 0) {
    const { count } = await supabase
      .from("bracket_configs")
      .select("id", { count: "exact", head: true })
      .in("division_id", divisionIds);
    hasBracket = (count ?? 0) > 0;
  }

  // 주최자 본인인지 확인
  const isOrganizer = user && tournament.organizer_id === user.id;

  // 사용자 프로필 가져오기
  let userProfile = null;
  let currentEntry = null;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, phone, rating, club")
      .eq("id", user.id)
      .single();

    userProfile = profile;

    // 현재 참가 신청 상태 확인 (여러 부서 신청 시 최신 1건, 수정/취소용)
    const { data: entry } = await supabase
      .from("tournament_entries")
      .select("*")
      .eq("tournament_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    currentEntry = entry ?? null;
  }

  const organizerName = tournament.profiles
    ? // @ts-ignore: Supabase types join
      tournament.profiles.name || "Unknown Organizer"
    : "Unknown";

  // Date formatter helper
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatSimpleDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    });
  };

  const formatCurrency = (amount: number) => {
    return amount === 0 ? "무료" : `${amount.toLocaleString()}원`;
  };

  const MATCH_TYPE_LABELS: Record<string, string> = {
    INDIVIDUAL_SINGLES: "개인전 단식",
    INDIVIDUAL_DOUBLES: "개인전 복식",
    TEAM_SINGLES: "단체전 단식",
    TEAM_DOUBLES: "단체전 복식",
  };

  const isTeamMatch =
    tournament.match_type === "TEAM_SINGLES" ||
    tournament.match_type === "TEAM_DOUBLES";
  const matchSuffix = tournament.match_type?.includes("SINGLES")
    ? "단식"
    : "복식";

  const formattedMatchType = tournament.match_type
    ? isTeamMatch && tournament.team_match_count
      ? `${tournament.team_match_count}${matchSuffix}`
      : MATCH_TYPE_LABELS[tournament.match_type] || tournament.match_type
    : "";

  // 상태 배지 스타일
  const statusBadgeStyle = (() => {
    if (tournament.status === "OPEN") return "badge-open";
    if (tournament.status === "IN_PROGRESS") return "badge-progress";
    return "badge-closed";
  })();

  const statusLabel = (() => {
    switch (tournament.status) {
      case "OPEN": return "접수중";
      case "CLOSED": return "마감";
      case "IN_PROGRESS": return "진행중";
      case "COMPLETED": return "종료";
      default: return tournament.status;
    }
  })();

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* 대회 상태 변경 실시간 감지 */}
      <TournamentRealtimeRefresher tournamentIds={[tournament.id]} />

      {/* Header / Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/tournaments"
          className="text-sm transition-colors inline-flex items-center gap-1 mb-4 hover:opacity-80"
          style={{ color: "var(--text-muted)" }}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          목록으로 돌아가기
        </Link>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <span
                className={`px-2.5 py-0.5 rounded-full text-sm font-medium ${statusBadgeStyle}`}
              >
                {statusLabel}
              </span>
              <span
                className="text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                {formattedMatchType}
              </span>
            </div>
            <h1
              className="text-3xl md:text-4xl font-bold mb-2 leading-tight"
              style={{ color: "var(--text-primary)" }}
            >
              {tournament.title}
            </h1>
            <p className="flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
              <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                {tournament.host || organizerName}
              </span>
              {tournament.organizer_name && (
                <>
                  <span style={{ color: "var(--border-color)" }}>|</span>
                  <span>주관: {tournament.organizer_name}</span>
                </>
              )}
            </p>
          </div>

          <div className="flex-shrink-0 flex flex-col gap-3">
            {hasBracket && (
              <Link
                href={`/tournaments/${tournament.id}/bracket`}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-opacity hover:opacity-80"
                style={{
                  backgroundColor: "var(--accent-color)",
                  color: "var(--bg-primary)",
                }}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                  />
                </svg>
                대진표 보기
              </Link>
            )}
            {isOrganizer && <TournamentActions tournamentId={tournament.id} />}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Poster Image */}
          {tournament.poster_url && (
            <div
              className="relative aspect-[2/1] rounded-2xl overflow-hidden"
              style={{ backgroundColor: "var(--bg-card)" }}
            >
              <Image
                src={tournament.poster_url}
                alt={tournament.title}
                fill
                className="object-cover"
                priority
                unoptimized
              />
            </div>
          )}

          {/* Key Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              className="rounded-2xl p-5"
              style={{
                backgroundColor: "var(--bg-secondary)",
                border: "1px solid var(--border-color)",
              }}
            >
              <h3
                className="text-sm font-medium mb-1"
                style={{ color: "var(--text-muted)" }}
              >
                대회 일시
              </h3>
              <p
                className="font-semibold text-lg"
                style={{ color: "var(--text-primary)" }}
              >
                {formatSimpleDate(tournament.start_date)}
              </p>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {tournament.start_date &&
                  tournament.end_date &&
                  tournament.start_date !== tournament.end_date &&
                  `~ ${formatSimpleDate(tournament.end_date)}`}
              </p>
            </div>
            <div
              className="rounded-2xl p-5"
              style={{
                backgroundColor: "var(--bg-secondary)",
                border: "1px solid var(--border-color)",
              }}
            >
              <h3
                className="text-sm font-medium mb-1"
                style={{ color: "var(--text-muted)" }}
              >
                장소
              </h3>
              <p
                className="font-semibold text-lg"
                style={{ color: "var(--text-primary)" }}
              >
                {tournament.location}
              </p>
              <p className="text-sm truncate" style={{ color: "var(--text-muted)" }}>
                {tournament.address}
              </p>
            </div>
            <div
              className="rounded-2xl p-5"
              style={{
                backgroundColor: "var(--bg-secondary)",
                border: "1px solid var(--border-color)",
              }}
            >
              <h3
                className="text-sm font-medium mb-1"
                style={{ color: "var(--text-muted)" }}
              >
                접수 기간
              </h3>
              <p className="font-medium" style={{ color: "var(--text-primary)" }}>
                {formatSimpleDate(tournament.entry_start_date)} ~
              </p>
              <p className="font-medium" style={{ color: "var(--text-primary)" }}>
                {formatSimpleDate(tournament.entry_end_date)}
              </p>
            </div>
            <div
              className="rounded-2xl p-5"
              style={{
                backgroundColor: "var(--bg-secondary)",
                border: "1px solid var(--border-color)",
              }}
            >
              <h3
                className="text-sm font-medium mb-1"
                style={{ color: "var(--text-muted)" }}
              >
                참가비 / 계좌
              </h3>
              <p
                className="font-semibold text-lg"
                style={{ color: "var(--text-primary)" }}
              >
                {formatCurrency(tournament.entry_fee)}
              </p>
              <p className="text-sm truncate" style={{ color: "var(--text-muted)" }}>
                {tournament.bank_account || "-"}
              </p>
            </div>
          </div>

          {/* Divisions List */}
          <section>
            <h2
              className="text-2xl font-bold mb-6 flex items-center gap-2"
              style={{ color: "var(--text-primary)" }}
            >
              <span
                className="w-1.5 h-8 rounded-full"
                style={{ backgroundColor: "var(--accent-color)" }}
              />
              참가 부서
            </h2>

            {tournament.tournament_divisions &&
            tournament.tournament_divisions.length > 0 ? (
              <div className="grid gap-4">
                {tournament.tournament_divisions.map((division: any) => (
                  <div
                    key={division.id}
                    className="rounded-xl p-6 transition-colors"
                    style={{
                      backgroundColor: "var(--bg-secondary)",
                      border: "1px solid var(--border-color)",
                    }}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                      <div>
                        <h3
                          className="text-xl font-bold mb-1"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {division.name}
                        </h3>
                        <div
                          className="flex items-center gap-3 text-sm"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {division.max_teams && (
                            <span>{division.max_teams}팀 모집</span>
                          )}
                          {division.team_member_limit > 0 && (
                            <span>• 팀당 {division.team_member_limit}명</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                          우승 상금
                        </span>
                        <span
                          className="font-bold text-lg"
                          style={{ color: "var(--accent-color)" }}
                        >
                          {division.prize_winner || "-"}
                        </span>
                      </div>
                    </div>

                    <div
                      className="rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm"
                      style={{ backgroundColor: "var(--bg-card)" }}
                    >
                      <div className="flex gap-2">
                        <span className="min-w-16" style={{ color: "var(--text-muted)" }}>
                          경기 일시
                        </span>
                        <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                          {formatDate(division.match_date)}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <span className="min-w-16" style={{ color: "var(--text-muted)" }}>
                          경기 장소
                        </span>
                        <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                          {division.match_location || tournament.location}
                        </span>
                      </div>
                      {division.prize_runner_up && (
                        <div className="flex gap-2">
                          <span className="min-w-16" style={{ color: "var(--text-muted)" }}>
                            준우승
                          </span>
                          <span style={{ color: "var(--text-primary)" }}>
                            {division.prize_runner_up}
                          </span>
                        </div>
                      )}
                      {division.prize_third && (
                        <div className="flex gap-2">
                          <span className="min-w-16" style={{ color: "var(--text-muted)" }}>
                            3위
                          </span>
                          <span style={{ color: "var(--text-primary)" }}>
                            {division.prize_third}
                          </span>
                        </div>
                      )}
                    </div>

                    {division.notes && (
                      <div
                        className="mt-4 pt-4 text-sm prose prose-sm max-w-none"
                        style={{
                          borderTop: "1px solid var(--border-color)",
                          color: "var(--text-secondary)",
                        }}
                        dangerouslySetInnerHTML={{ __html: division.notes }}
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="rounded-xl p-8 text-center"
                style={{
                  backgroundColor: "var(--bg-card)",
                  color: "var(--text-muted)",
                }}
              >
                등록된 참가 부서가 없습니다.
              </div>
            )}
          </section>

          {/* Detailed Info */}
          <section>
            <h2
              className="text-2xl font-bold mb-6 flex items-center gap-2"
              style={{ color: "var(--text-primary)" }}
            >
              <span
                className="w-1.5 h-8 rounded-full"
                style={{ backgroundColor: "var(--accent-color)" }}
              />
              대회 요강
            </h2>

            <div className="space-y-6">
              {/* Metadata Table */}
              <div
                className="rounded-xl overflow-hidden"
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-color)",
                }}
              >
                <dl>
                  {[
                    { label: "사용구", value: tournament.ball_type || "-", alt: false },
                    { label: "참가 자격", value: tournament.eligibility || "-", alt: true },
                    { label: "최대 참가 인원", value: `${tournament.max_participants}명`, alt: false },
                    { label: "개회식", value: formatDate(tournament.opening_ceremony), alt: true },
                    { label: "문의", value: `${tournament.host} / ${organizerName}`, alt: false },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="grid grid-cols-3 gap-4 px-6 py-4"
                      style={{
                        backgroundColor: item.alt ? "var(--bg-card)" : "transparent",
                        borderBottom: "1px solid var(--border-color)",
                      }}
                    >
                      <dt
                        className="text-sm font-medium"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {item.label}
                      </dt>
                      <dd
                        className="text-sm col-span-2"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {item.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Description Content */}
              {tournament.description ? (
                <div
                  className="rounded-xl p-8 editor-content"
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <div
                    className="prose max-w-none prose-headings:font-bold"
                    style={{ color: "var(--text-primary)" }}
                    dangerouslySetInnerHTML={{ __html: tournament.description }}
                  />
                </div>
              ) : (
                <div
                  className="text-center py-12 rounded-xl"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    color: "var(--text-muted)",
                  }}
                >
                  등록된 상세 내용이 없습니다.
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="sticky top-24 space-y-6">
            {/* Entry Actions */}
            <TournamentEntryActionsNew
              tournamentId={tournament.id}
              tournamentTitle={tournament.title}
              tournamentStatus={tournament.status}
              matchType={tournament.match_type}
              divisions={tournament.tournament_divisions || []}
              currentEntry={currentEntry}
              isLoggedIn={!!user}
              userProfile={userProfile}
              entryFee={tournament.entry_fee}
              bankAccount={tournament.bank_account}
              entryStartDate={tournament.entry_start_date}
              entryEndDate={tournament.entry_end_date}
              isOrganizer={!!isOrganizer}
            />

            {/* Map */}
            <TournamentMap
              address={tournament.address}
              location={tournament.location}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
