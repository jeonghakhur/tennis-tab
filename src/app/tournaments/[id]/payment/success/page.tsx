import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

// 이 페이지는 더 이상 사용되지 않습니다.
// 토스 successUrl은 /api/tournaments/[id]/payment/success (Route Handler) 를 사용합니다.
export default async function PaymentSuccessPage({ params }: Props) {
  const { id: tournamentId } = await params;
  redirect(`/tournaments/${tournamentId}`);
}
