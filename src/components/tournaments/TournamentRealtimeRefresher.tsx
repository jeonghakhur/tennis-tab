"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface Props {
  /** 감시할 대회 ID (단일 또는 복수) */
  tournamentIds: string[];
}

/**
 * Server Component 페이지에서 대회 상태 변경을 실시간 감지하여
 * router.refresh()로 서버 데이터를 재요청하는 경량 컴포넌트.
 * UI를 렌더링하지 않음 (null 반환).
 */
export function TournamentRealtimeRefresher({ tournamentIds }: Props) {
  const router = useRouter();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const idsKeyRef = useRef("");

  useEffect(() => {
    if (tournamentIds.length === 0) return;

    const idsKey = tournamentIds.slice().sort().join(",");
    // 동일한 ID 세트면 재구독 불필요
    if (idsKey === idsKeyRef.current) return;
    idsKeyRef.current = idsKey;

    const supabase = createClient();

    // 이전 채널 정리
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`tournament-refresh-${idsKey.slice(0, 8)}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tournaments",
        },
        (payload) => {
          const row = payload.new as { id: string };
          if (tournamentIds.includes(row.id)) {
            router.refresh();
          }
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      idsKeyRef.current = "";
    };
  }, [tournamentIds, router]);

  return null;
}
