"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Toast } from "@/components/common/Toast";

/**
 * 결제 성공 후 리다이렉트 시 ?paid=1 쿼리가 있으면 토스트 표시
 */
export function PaymentSuccessToast() {
  const searchParams = useSearchParams();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (searchParams.get("paid") === "1") {
      setShow(true);
    }
  }, [searchParams]);

  return (
    <Toast
      isOpen={show}
      onClose={() => setShow(false)}
      message="참가비 결제가 완료되었습니다."
      type="success"
      duration={4000}
    />
  );
}
