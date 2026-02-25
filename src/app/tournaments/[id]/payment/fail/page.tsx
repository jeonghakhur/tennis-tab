import Link from "next/link";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    code?: string;
    message?: string;
  }>;
}

export default async function PaymentFailPage({ params, searchParams }: Props) {
  const { id: tournamentId } = await params;
  const { code, message } = await searchParams;

  // 사용자가 직접 취소한 경우 (뒤로 가기)
  const isCanceled = code === "PAY_PROCESS_CANCELED";
  const errorMessage = message
    ? decodeURIComponent(message)
    : isCanceled
    ? "결제를 취소하셨습니다."
    : "결제 처리 중 오류가 발생했습니다.";

  return (
    <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--bg-primary)" }}>
      <div className="max-w-md w-full mx-auto px-4 text-center">
        {/* 아이콘 */}
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: "rgba(239, 68, 68, 0.15)" }}>
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
          {isCanceled ? "결제 취소" : "결제 실패"}
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
          {errorMessage}
        </p>

        {/* 에러 코드 (디버깅용, 있을 때만) */}
        {code && !isCanceled && (
          <p className="text-xs mb-6" style={{ color: "var(--text-muted)" }}>
            오류 코드: {code}
          </p>
        )}

        <div className="space-y-3">
          {/* 다시 시도 — 브라우저 뒤로 가기 */}
          <Link
            href={`/tournaments/${tournamentId}`}
            className="block w-full rounded-xl py-3 font-medium text-center transition-all hover:opacity-90"
            style={{
              backgroundColor: "var(--accent-color)",
              color: "var(--bg-primary)",
            }}
          >
            대회 페이지로 돌아가기
          </Link>
          <Link
            href="/tournaments"
            className="block w-full rounded-xl py-3 font-medium text-center transition-all hover:opacity-80"
            style={{
              backgroundColor: "var(--bg-card-hover)",
              color: "var(--text-secondary)",
            }}
          >
            대회 목록 보기
          </Link>
        </div>
      </div>
    </main>
  );
}
