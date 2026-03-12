"use client";

import { useEffect, useRef, useState } from "react";
import { loadTossPayments, type TossPaymentsWidgets } from "@tosspayments/tosspayments-sdk";

interface TossPaymentWidgetProps {
  entryId: string;
  tournamentId: string;
  entryFee: number;
  tournamentTitle: string;
}

export default function TossPaymentWidget({
  entryId,
  tournamentId,
  entryFee,
  tournamentTitle,
}: TossPaymentWidgetProps) {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // widgets 인스턴스를 ref로 보관 (재렌더링 방지)
  const widgetsRef = useRef<TossPaymentsWidgets | null>(null);

  const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? '';
  // orderId: "toss-{entryId}" 형식, confirmPayment에서 역파싱
  const orderId = `toss-${entryId}`;

  useEffect(() => {
    if (!clientKey) {
      setError('결제 키가 설정되지 않았습니다. 관리자에게 문의하세요.');
      return;
    }

    let cancelled = false;

    async function initWidgets() {
      try {
        const tossPayments = await loadTossPayments(clientKey);
        // StrictMode cleanup이 이미 실행됐으면 중단
        if (cancelled) return;

        const widgets = tossPayments.widgets({ customerKey: `user-${entryId}` });
        await widgets.setAmount({ currency: 'KRW', value: entryFee });
        if (cancelled) return;

        await Promise.all([
          widgets.renderPaymentMethods({
            selector: '#payment-method',
            variantKey: 'DEFAULT',
          }),
          widgets.renderAgreement({
            selector: '#payment-agreement',
            variantKey: 'AGREEMENT',
          }),
        ]);

        if (!cancelled) {
          widgetsRef.current = widgets;
          setIsReady(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '결제위젯 초기화 실패');
        }
      }
    }

    initWidgets();
    return () => {
      cancelled = true;
      widgetsRef.current = null;
    };
  }, [clientKey, entryFee, entryId]);

  const handlePay = async () => {
    if (!widgetsRef.current || isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      // Route Handler로 변경: revalidatePath를 렌더 밖에서 호출하기 위함
      const successUrl = `${window.location.origin}/api/tournaments/${tournamentId}/payment/success`;
      const failUrl = `${window.location.origin}/tournaments/${tournamentId}/payment/fail`;

      await widgetsRef.current.requestPayment({
        orderId,
        orderName: `${tournamentTitle} 참가비`,
        successUrl,
        failUrl,
      });
    } catch (err) {
      // PAY_PROCESS_CANCELED: 사용자가 직접 취소한 경우
      const code = (err as { code?: string }).code;
      if (code !== 'PAY_PROCESS_CANCELED') {
        setError(err instanceof Error ? err.message : '결제 요청 중 오류가 발생했습니다.');
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 결제 금액 안내 */}
      <div
        className="rounded-xl p-4"
        style={{ backgroundColor: "var(--bg-card)" }}
      >
        <div className="flex justify-between items-center">
          <span style={{ color: "var(--text-secondary)" }}>참가비</span>
          <span className="text-xl font-bold" style={{ color: "var(--accent-color)" }}>
            {entryFee.toLocaleString('ko-KR')}원
          </span>
        </div>
      </div>

      {/* 토스 결제위젯 영역 */}
      <div id="payment-method" />
      <div id="payment-agreement" />

      {/* 에러 메시지 */}
      {error && (
        <p className="text-sm text-center text-red-500">{error}</p>
      )}

      {/* 결제하기 버튼 */}
      <button
        onClick={handlePay}
        disabled={!isReady || isLoading}
        className="w-full rounded-xl py-4 font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
        style={{
          backgroundColor: "var(--accent-color)",
          color: "var(--bg-primary)",
        }}
      >
        {isLoading ? "결제 처리 중..." : `${entryFee.toLocaleString('ko-KR')}원 결제하기`}
      </button>
    </div>
  );
}
