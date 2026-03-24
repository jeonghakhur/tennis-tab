import Link from "next/link";
import { createClient, getUserWithTimeout } from "@/lib/supabase/server";
import { TournamentRealtimeRefresher } from "@/components/tournaments/TournamentRealtimeRefresher";
import { UserRole } from "@/lib/supabase/types";
import type { Database } from "@/lib/supabase/types";
import TournamentsClient from "./_components/TournamentsClient";

const ALLOWED_ROLES: UserRole[] = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

export default async function TournamentsPage() {
  const supabase = await createClient();

  // 1. 인증 (3초 타임아웃)
  const { data: { user } } = await getUserWithTimeout(supabase, 3000);

  // 2. 프로필 + 대회 목록 병렬 조회
  const tournamentQuery = supabase
    .from("tournaments")
    .select("id, title, status, start_date, end_date, location, poster_url")
    .order("start_date", { ascending: false });

  const [profileResult, { data: allTournaments, error }] = await Promise.all([
    user ? supabase.from("profiles").select("role").eq("id", user.id).single() : Promise.resolve({ data: null }),
    tournamentQuery,
  ]);

  const role = profileResult.data?.role ?? null;
  const canCreateTournament = !!role && ALLOWED_ROLES.includes(role as UserRole);

  // 관리자가 아닌 경우 DRAFT 대회 제외
  const tournaments = (canCreateTournament
    ? allTournaments
    : allTournaments?.filter((t) => t.status !== "DRAFT")) ?? [];

  if (error) {
    console.error("Error fetching tournaments:", error);
  }

  return (
    <div className="max-w-content mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8 w-full">
        <div>
          <h1 className="text-3xl font-bold mb-2">대회 일정</h1>
          <p className="text-gray-500">참가 가능한 테니스 대회를 확인하세요.</p>
        </div>
        {canCreateTournament && (
          <Link
            href="/tournaments/new"
            className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            대회 만들기
          </Link>
        )}
      </div>

      {/* 대회 상태 변경 실시간 감지 */}
      {tournaments.length > 0 && (
        <TournamentRealtimeRefresher
          tournamentIds={tournaments.map((t) => t.id)}
        />
      )}

      <TournamentsClient
        tournaments={tournaments as Database["public"]["Tables"]["tournaments"]["Row"][]}
      />
    </div>
  );
}
