import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import TossPaymentWidget from "@/components/tournaments/TossPaymentWidget";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ entryId?: string }>;
}

export default async function PaymentPage({ params, searchParams }: Props) {
  const { id: tournamentId } = await params;
  const { entryId } = await searchParams;

  if (!entryId) {
    redirect(`/tournaments/${tournamentId}`);
  }

  // 로그인 확인
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/auth/login?redirect=/tournaments/${tournamentId}/payment?entryId=${entryId}`);
  }

  // entry + tournament 조회 (권한 포함)
  const admin = createAdminClient();
  const { data: entry } = await admin
    .from("tournament_entries")
    .select("id, user_id, payment_status, tournaments!inner(id, title, entry_fee)")
    .eq("id", entryId)
    .single();

  if (!entry) {
    redirect(`/tournaments/${tournamentId}`);
  }

  // 본인 entry 확인
  if (entry.user_id !== user.id) {
    redirect(`/tournaments/${tournamentId}`);
  }

  // 이미 결제 완료 → 대회 상세로
  if (entry.payment_status === "COMPLETED") {
    redirect(`/tournaments/${tournamentId}?paid=1`);
  }

  const tournament = entry.tournaments as unknown as { id: string; title: string; entry_fee: number };

  // 참가비가 없는 대회 → 결제 불필요
  if (tournament.entry_fee === 0) {
    redirect(`/tournaments/${tournamentId}`);
  }

  return (
    <main className="min-h-screen" style={{ backgroundColor: "var(--bg-primary)" }}>
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            참가비 결제
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {tournament.title}
          </p>
        </div>

        <TossPaymentWidget
          entryId={entryId}
          tournamentId={tournamentId}
          entryFee={tournament.entry_fee}
          tournamentTitle={tournament.title}
        />
      </div>
    </main>
  );
}
