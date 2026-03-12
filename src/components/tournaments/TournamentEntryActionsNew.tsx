"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname } from "next/navigation";
import {
  createEntry,
  confirmBankTransfer,
  deleteEntry,
  updateEntry,
  getUserTournamentEntries,
} from "@/lib/entries/actions";
import { updateTournamentStatus } from "@/lib/tournaments/actions";
import TournamentEntryForm, { EntryFormData } from "./TournamentEntryForm";
import { MatchType } from "@/lib/supabase/types";
import { AlertDialog } from "@/components/common/AlertDialog";

interface Division {
  id: string;
  name: string;
  max_teams: number | null;
  team_member_limit: number | null;
}

interface UserProfile {
  name: string;
  phone: string | null;
  rating: number | null;
  club: string | null;
}

interface CurrentEntry {
  id: string;
  status: string;
  division_id: string | null;
  phone: string | null;
  player_name: string | null;
  player_rating: number | null;
  club_name: string | null;
  team_order: string | null;
  partner_data: { name: string; club: string; rating: number } | null;
  team_members: Array<{ name: string; rating: number }> | null;
  current_rank?: number;
  payment_status?: string;
}

interface TournamentEntryActionsProps {
  tournamentId: string;
  tournamentTitle: string;
  tournamentStatus: string;
  matchType: MatchType | null;
  teamMatchCount: number | null;
  divisions: Division[];
  myEntries: unknown[];
  isLoggedIn: boolean;
  userProfile: UserProfile | null;
  entryFee: number;
  bankAccount: string | null;
  entryStartDate: string | null;
  entryEndDate: string | null;
  isOrganizer: boolean;
}

export default function TournamentEntryActions({
  tournamentId,
  tournamentTitle,
  tournamentStatus,
  matchType,
  teamMatchCount,
  divisions,
  myEntries,
  isLoggedIn,
  userProfile,
  entryFee,
  bankAccount,
  entryStartDate,
  entryEndDate,
  isOrganizer,
}: TournamentEntryActionsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [mounted, setMounted] = useState(false);
  // 서버에서 전달된 entries를 초기값으로, 클라이언트에서도 최신 데이터로 갱신
  const [entries, setEntries] = useState<CurrentEntry[]>(myEntries as CurrentEntry[]);
  // 수정/취소 대상 entry id
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  // 취소 확인 모달 대상 entry id
  const [cancelEntryId, setCancelEntryId] = useState<string | null>(null);
  // 참가 신청 완료 후 결제 유도 모달 (entryFee > 0인 경우)
  const [paymentPrompt, setPaymentPrompt] = useState<{ entryId: string } | null>(null);
  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "info" | "warning" | "error" | "success";
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
  });

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!mounted || !isLoggedIn || !tournamentId) return;

    getUserTournamentEntries(tournamentId).then((list) => {
      if (list.length > 0) {
        setEntries(list as CurrentEntry[]);
      }
    });
  }, [mounted, isLoggedIn, tournamentId]);

  // 신청/수정/취소 후 entries 갱신
  const refreshEntries = async () => {
    const list = await getUserTournamentEntries(tournamentId);
    setEntries(list as CurrentEntry[]);
  };

  // 참가 기간 확인
  const isWithinEntryPeriod = () => {
    const now = new Date();
    if (entryStartDate && new Date(entryStartDate) > now) {
      return false;
    }
    if (entryEndDate && new Date(entryEndDate) < now) {
      return false;
    }
    return true;
  };

  const withinPeriod = isWithinEntryPeriod();
  const canAcceptEntry = tournamentStatus === "OPEN" && withinPeriod;

  // 참가 신청 폼 제출 처리 (신규)
  const handleSubmit = async (data: EntryFormData) => {
    const result = await createEntry(tournamentId, {
      divisionId: data.divisionId,
      phone: data.phone,
      playerName: data.playerName,
      playerRating: data.playerRating,
      clubName: data.clubName,
      teamOrder: data.teamOrder,
      partnerData: data.partnerData,
      partnerUserId: data.partnerUserId,
      teamMembers: data.teamMembers,
      applicantParticipates: data.applicantParticipates,
    });

    if (result.success) {
      await refreshEntries();
      if (entryFee > 0 && result.entryId) {
        setPaymentPrompt({ entryId: result.entryId });
      }
    }

    return result;
  };

  // 참가 신청 수정 처리 (activeEntryId 기준)
  const handleUpdate = async (data: EntryFormData) => {
    if (!activeEntryId) return { success: false, error: "수정 대상 신청 정보가 없습니다." };

    const result = await updateEntry(activeEntryId, {
      divisionId: data.divisionId,
      phone: data.phone,
      playerName: data.playerName,
      playerRating: data.playerRating,
      clubName: data.clubName,
      teamOrder: data.teamOrder,
      partnerData: data.partnerData,
      partnerUserId: data.partnerUserId,
      teamMembers: data.teamMembers,
      applicantParticipates: data.applicantParticipates,
    });

    if (result.success) {
      await refreshEntries();
    }

    return result;
  };

  // 신청 취소 처리 (cancelEntryId 기준)
  const handleCancel = async () => {
    if (!cancelEntryId || isSubmitting) return;

    setIsSubmitting(true);
    const result = await deleteEntry(cancelEntryId);
    setIsSubmitting(false);
    setCancelEntryId(null);

    if (result.success) {
      await refreshEntries();
      setAlertDialog({
        isOpen: true,
        title: "취소 완료",
        message: "참가 신청이 취소되었습니다.",
        type: "success",
      });
      router.refresh();
    } else {
      setAlertDialog({
        isOpen: true,
        title: "취소 실패",
        message: result.error || "신청 취소에 실패했습니다.",
        type: "error",
      });
    }
  };

  // 입금 완료 확인 처리 (첫 번째 미결제 entry 기준)
  const handleConfirmPayment = async (entryId: string) => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    const result = await confirmBankTransfer(entryId);
    setIsSubmitting(false);

    if (result.success) {
      await refreshEntries();
      setAlertDialog({
        isOpen: true,
        title: "입금 확인 완료",
        message:
          result.status === "CONFIRMED"
            ? "입금이 확인되었습니다. 참가가 확정되었습니다!"
            : "입금이 확인되었습니다. 정원 초과로 대기자 명단에 등록되었습니다.",
        type: result.status === "CONFIRMED" ? "success" : "warning",
      });
      router.refresh();
    } else {
      setAlertDialog({
        isOpen: true,
        title: "입금 확인 실패",
        message: result.error || "입금 확인에 실패했습니다.",
        type: "error",
      });
    }
  };

  // 참가 마감 처리
  const handleClose = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    const result = await updateTournamentStatus(tournamentId, 'CLOSED');
    setIsSubmitting(false);
    setShowCloseModal(false);

    if (result.success) {
      setAlertDialog({
        isOpen: true,
        title: "마감 완료",
        message: "참가 접수가 마감되었습니다.",
        type: "success",
      });
      router.refresh();
    } else {
      setAlertDialog({
        isOpen: true,
        title: "마감 실패",
        message: result.error || "마감 처리에 실패했습니다.",
        type: "error",
      });
    }
  };

  // 신청 상태 배지 — alpha 기반으로 다크/라이트 모두 호환
  const getStatusBadge = (status: string) => {
    const badges: Record<string, { text: string; bg: string; color: string }> = {
      PENDING: {
        text: "승인 대기중",
        bg: "rgba(245, 158, 11, 0.15)",
        color: "#d97706",
      },
      APPROVED: {
        text: "승인됨",
        bg: "rgba(16, 185, 129, 0.15)",
        color: "#059669",
      },
      REJECTED: {
        text: "거절됨",
        bg: "rgba(239, 68, 68, 0.15)",
        color: "#dc2626",
      },
      CONFIRMED: {
        text: "확정",
        bg: "rgba(16, 185, 129, 0.15)",
        color: "#059669",
      },
      WAITLISTED: {
        text: "대기자",
        bg: "rgba(245, 158, 11, 0.15)",
        color: "#d97706",
      },
      CANCELLED: {
        text: "취소됨",
        bg: "var(--bg-card-hover)",
        color: "var(--text-muted)",
      },
    };

    const badge = badges[status] || badges.PENDING;

    return (
      <span
        className="px-3 py-1 rounded-full text-sm font-medium"
        style={{ backgroundColor: badge.bg, color: badge.color }}
      >
        {badge.text}
      </span>
    );
  };

  // 결제 상태 배지
  const getPaymentBadge = (paymentStatus: string | undefined) => {
    const isPaid = paymentStatus === "COMPLETED";
    return (
      <span
        className="px-3 py-1 rounded-full text-sm font-medium"
        style={{
          backgroundColor: isPaid
            ? "rgba(16, 185, 129, 0.15)"
            : "rgba(245, 158, 11, 0.15)",
          color: isPaid ? "#059669" : "#d97706",
        }}
      >
        {isPaid ? "입금 확인됨" : "입금 전"}
      </span>
    );
  };

  // 모바일 플로팅 바 내용 결정
  const renderMobileFloating = () => {
    if (!isLoggedIn) {
      return (
        <button
          onClick={() => router.push(`/auth/login?redirect=${encodeURIComponent(pathname)}`)}
          className="flex-1 rounded-xl py-3 font-medium transition-all hover:opacity-80"
          style={{ backgroundColor: "var(--bg-card-hover)", color: "var(--text-secondary)" }}
        >
          로그인하기
        </button>
      );
    }

    if (entries.length > 0) {
      // 2건 이상: 건별 수정/취소 버튼 노출
      if (entries.length >= 2) {
        return (
          <div className="flex-1 flex flex-col gap-3">
            <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              내 신청 {entries.length}팀
            </span>
            {entries.map((e, idx) => {
              const isActive = !["CANCELLED", "REJECTED"].includes(e.status);
              const canModify = canAcceptEntry && isActive;
              const divisionName = divisions.find((d) => d.id === e.division_id)?.name;
              return (
                <div key={e.id} className="flex flex-col gap-1.5 rounded-xl p-3" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                        {e.player_name || `팀 ${idx + 1}`}
                      </p>
                      {divisionName && (
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {divisionName}
                        </p>
                      )}
                    </div>
                    {getStatusBadge(e.status)}
                  </div>
                  {canModify && (
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => { setActiveEntryId(e.id); setShowEditForm(true); }}
                        disabled={isSubmitting}
                        className="flex-1 rounded-xl py-2.5 text-sm font-medium transition-all disabled:opacity-50 hover:opacity-80"
                        style={{ backgroundColor: "var(--accent-color)", color: "var(--bg-primary)" }}
                      >
                        수정하기
                      </button>
                      <button
                        onClick={() => setCancelEntryId(e.id)}
                        disabled={isSubmitting}
                        className="flex-1 rounded-xl py-2.5 text-sm font-medium transition-all disabled:opacity-50 hover:opacity-80"
                        style={{ backgroundColor: "var(--bg-card-hover)", color: "var(--text-secondary)" }}
                      >
                        취소하기
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {canAcceptEntry && (
              <button
                onClick={() => setShowEntryForm(true)}
                className="w-full rounded-xl py-3 text-sm font-medium transition-all hover:opacity-80"
                style={{ backgroundColor: "var(--bg-card-hover)", color: "var(--text-secondary)", border: "1px dashed var(--border-color)" }}
              >
                + 추가 신청
              </button>
            )}
          </div>
        );
      }

      // 1건: 기존 동작
      const entry = entries[0];
      const isActive = !["CANCELLED", "REJECTED"].includes(entry.status);

      if (entryFee > 0 && entry.payment_status === "PENDING" && isActive) {
        const statusBadge = getStatusBadge(entry.status)
        // statusBadge의 text/bg 스타일을 버튼에 그대로 적용하기 위해 status별 색상 직접 참조
        const statusColors: Record<string, { bg: string; color: string }> = {
          PENDING: { bg: "rgba(245, 158, 11, 0.15)", color: "#d97706" },
          APPROVED: { bg: "rgba(16, 185, 129, 0.15)", color: "#059669" },
          CONFIRMED: { bg: "rgba(16, 185, 129, 0.15)", color: "#059669" },
          WAITLISTED: { bg: "rgba(245, 158, 11, 0.15)", color: "#d97706" },
          REJECTED: { bg: "rgba(239, 68, 68, 0.15)", color: "#dc2626" },
          CANCELLED: { bg: "var(--bg-card-hover)", color: "var(--text-muted)" },
        }
        const sc = statusColors[entry.status] ?? statusColors.PENDING
        const statusLabel = { PENDING: "승인 대기중", APPROVED: "승인됨", CONFIRMED: "확정", WAITLISTED: "대기자", REJECTED: "거절됨", CANCELLED: "취소됨" }[entry.status] ?? "승인 대기중"
        return (
          <>
            <div
              className="flex-1 rounded-xl py-3 font-bold text-center text-sm"
              style={{ backgroundColor: sc.bg, color: sc.color }}
            >
              {statusLabel}
            </div>
            <button
              onClick={() => handleConfirmPayment(entry.id)}
              disabled={isSubmitting}
              className="flex-1 rounded-xl py-3 font-bold transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "var(--accent-color)", color: "var(--bg-primary)" }}
            >
              {isSubmitting ? "처리 중..." : "입금 완료"}
            </button>
          </>
        );
      }

      if (canAcceptEntry && isActive) {
        return (
          <>
            <button
              onClick={() => { setActiveEntryId(entry.id); setShowEditForm(true); }}
              disabled={isSubmitting}
              className="flex-1 rounded-xl py-3 font-medium transition-all disabled:opacity-50 hover:opacity-80"
              style={{ backgroundColor: "var(--accent-color)", color: "var(--bg-primary)" }}
            >
              수정하기
            </button>
            <button
              onClick={() => setCancelEntryId(entry.id)}
              disabled={isSubmitting}
              className="flex-1 rounded-xl py-3 font-medium transition-all disabled:opacity-50 hover:opacity-80"
              style={{ backgroundColor: "var(--bg-card-hover)", color: "var(--text-secondary)" }}
            >
              {isSubmitting ? "처리 중..." : "취소하기"}
            </button>
          </>
        );
      }

      // 상태만 표시 (수정/취소 불가)
      if (isActive) {
        return (
          <div className="flex-1 flex items-center justify-center gap-3">
            {getStatusBadge(entry.status)}
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>
              신청 완료
            </span>
          </div>
        );
      }

      return null;
    }

    if (canAcceptEntry) {
      return (
        <button
          onClick={() => setShowEntryForm(true)}
          className="flex-1 rounded-xl py-3 font-bold transition-all hover:opacity-90"
          style={{ backgroundColor: "var(--accent-color)", color: "var(--bg-primary)" }}
        >
          참가 신청하기
        </button>
      );
    }

    return (
      <span className="flex-1 text-center text-sm py-3" style={{ color: "var(--text-muted)" }}>
        {tournamentStatus === "UPCOMING" && "접수 예정"}
        {tournamentStatus === "CLOSED" && "접수 마감"}
        {tournamentStatus === "IN_PROGRESS" && "대회 진행 중"}
        {tournamentStatus === "COMPLETED" && "종료된 대회"}
        {tournamentStatus === "CANCELLED" && "취소된 대회"}
        {tournamentStatus === "DRAFT" && "준비 중"}
      </span>
    );
  };

  // 수정 대상 entry (activeEntryId 기준)
  const activeEntry = entries.find((e) => e.id === activeEntryId) ?? null;

  return (
    <>
      {/* 데스크탑 카드 UI */}
      <div
        className="rounded-2xl p-6 shadow-lg"
        style={{
          backgroundColor: "var(--bg-secondary)",
          border: "1px solid var(--border-color)",
        }}
      >
        <h3
          className="font-bold mb-4 text-lg"
          style={{ color: "var(--text-primary)" }}
        >
          참가 신청
        </h3>
        <div className="space-y-4">
          {!isLoggedIn ? (
            // 로그인하지 않은 경우
            <>
              <div className="text-center py-4">
                <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
                  참가 신청을 하려면 로그인이 필요합니다.
                </p>
              </div>
              <button
                onClick={() => router.push(`/auth/login?redirect=${encodeURIComponent(pathname)}`)}
                className="w-full rounded-xl py-3 font-medium transition-all hover:opacity-80"
                style={{
                  backgroundColor: "var(--bg-card-hover)",
                  color: "var(--text-secondary)",
                }}
              >
                로그인하기
              </button>
            </>
          ) : entries.length > 0 ? (
            // 신청 내역 있는 경우: 카드 목록 + 추가 신청 버튼
            <>
              {entries.map((entry) => {
                const isActive = !["CANCELLED", "REJECTED"].includes(entry.status);
                const canModify = canAcceptEntry && isActive;
                const teamLabel = entry.club_name
                  ? entry.team_order
                    ? `${entry.club_name} ${entry.team_order}팀`
                    : entry.club_name
                  : entry.player_name || "신청";

                return (
                  <div
                    key={entry.id}
                    className="rounded-xl p-4 space-y-3"
                    style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}
                  >
                    {/* 팀명 + 신청 상태 */}
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
                        {teamLabel}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {entry.current_rank != null && (
                          <span
                            className="px-3 py-1 rounded-full text-sm font-medium"
                            style={{
                              backgroundColor: "rgba(99, 102, 241, 0.15)",
                              color: "#6366f1",
                            }}
                          >
                            {entry.current_rank}번
                          </span>
                        )}
                        {getStatusBadge(entry.status)}
                      </div>
                    </div>

                    {/* 결제 상태 (참가비 있을 때만) */}
                    {entryFee > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                          결제 여부
                        </span>
                        {getPaymentBadge(entry.payment_status)}
                      </div>
                    )}

                    {/* 입금 계좌 + 입금 완료 버튼 */}
                    {entryFee > 0 && entry.payment_status === "PENDING" && isActive && (
                      <div className="space-y-2">
                        {bankAccount && (
                          <div
                            className="rounded-lg p-3 text-sm"
                            style={{ backgroundColor: "var(--bg-secondary)" }}
                          >
                            <p style={{ color: "var(--text-muted)" }} className="mb-1">입금 계좌</p>
                            <p className="font-medium" style={{ color: "var(--text-primary)" }}>{bankAccount}</p>
                            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                              입금자명: {entry.player_name || "신청자 이름"}
                            </p>
                          </div>
                        )}
                        <button
                          onClick={() => handleConfirmPayment(entry.id)}
                          disabled={isSubmitting}
                          className="w-full rounded-xl py-2.5 font-bold transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                          style={{ backgroundColor: "var(--accent-color)", color: "var(--bg-primary)" }}
                        >
                          {isSubmitting ? "처리 중..." : `입금 완료 (${entryFee.toLocaleString('ko-KR')}원)`}
                        </button>
                      </div>
                    )}

                    {/* 수정/취소 버튼 */}
                    {canModify && (
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => { setActiveEntryId(entry.id); setShowEditForm(true); }}
                          disabled={isSubmitting}
                          className="flex-1 rounded-xl py-2 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80"
                          style={{ backgroundColor: "var(--accent-color)", color: "var(--bg-primary)" }}
                        >
                          수정하기
                        </button>
                        <button
                          onClick={() => setCancelEntryId(entry.id)}
                          disabled={isSubmitting}
                          className="flex-1 rounded-xl py-2 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80"
                          style={{ backgroundColor: "var(--bg-card-hover)", color: "var(--text-secondary)" }}
                        >
                          취소하기
                        </button>
                      </div>
                    )}

                    {/* 수정/취소 불가 안내 */}
                    {!canModify && isActive && !canAcceptEntry && (
                      <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
                        {tournamentStatus === "CLOSED" && "접수 마감 — 수정·취소 불가"}
                        {tournamentStatus === "IN_PROGRESS" && "대회 진행 중 — 수정·취소 불가"}
                        {tournamentStatus === "COMPLETED" && "대회 종료"}
                        {tournamentStatus === "OPEN" && !withinPeriod && "접수 기간 외 — 수정·취소 불가"}
                      </p>
                    )}
                  </div>
                );
              })}

              {/* 추가 팀 신청 버튼 */}
              {canAcceptEntry && (
                <button
                  onClick={() => setShowEntryForm(true)}
                  className="w-full rounded-xl py-3 font-medium transition-all hover:opacity-80 flex items-center justify-center gap-2"
                  style={{ backgroundColor: "var(--bg-card-hover)", color: "var(--text-secondary)", border: "1px dashed var(--border-color)" }}
                >
                  <span>+</span>
                  <span>추가 팀 신청하기</span>
                </button>
              )}
            </>
          ) : canAcceptEntry ? (
            // 로그인한 사용자 & 접수 중인 대회 & 신청 안 한 경우
            <>
              <button
                onClick={() => setShowEntryForm(true)}
                className="w-full rounded-xl py-3 font-bold transition-all hover:opacity-90"
                style={{
                  backgroundColor: "var(--accent-color)",
                  color: "var(--bg-primary)",
                }}
              >
                참가 신청하기
              </button>
              <p
                className="text-xs text-center"
                style={{ color: "var(--text-muted)" }}
              >
                신청 후 주최자의 승인이 필요합니다.
              </p>
            </>
          ) : (
            // 접수 기간이 아닌 경우
            <div className="text-center py-4">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {tournamentStatus === "DRAFT" && "대회 준비 중입니다."}
                {tournamentStatus === "UPCOMING" && "아직 접수가 시작되지 않았습니다."}
                {tournamentStatus === "CLOSED" && "접수가 마감되었습니다."}
                {tournamentStatus === "IN_PROGRESS" && "대회가 진행 중입니다."}
                {tournamentStatus === "COMPLETED" && "종료된 대회입니다."}
                {tournamentStatus === "CANCELLED" && "취소된 대회입니다."}
              </p>
            </div>
          )}
        </div>

        {/* 주최자용 마감 버튼 */}
        {isOrganizer && tournamentStatus === "OPEN" && (
          <div
            className="mt-4 pt-4"
            style={{ borderTop: "1px solid var(--border-color)" }}
          >
            <button
              onClick={() => setShowCloseModal(true)}
              disabled={isSubmitting}
              className="w-full bg-red-600 hover:bg-red-700 text-white rounded-xl py-3 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              참가 접수 마감
            </button>
            <p
              className="text-xs text-center mt-2"
              style={{ color: "var(--text-muted)" }}
            >
              마감 후에는 참가 신청을 받을 수 없습니다.
            </p>
          </div>
        )}
      </div>

      {/* 모바일 플로팅 바 */}
      {mounted && createPortal(
        <div
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 px-4 pb-safe"
          style={{
            backgroundColor: "var(--bg-secondary)",
            borderTop: "1px solid var(--border-color)",
            paddingBottom: "max(env(safe-area-inset-bottom), 12px)",
            paddingTop: "12px",
          }}
        >
          {isOrganizer && tournamentStatus === "OPEN" ? (
            <div className="flex gap-2">
              {renderMobileFloating()}
              <button
                onClick={() => setShowCloseModal(true)}
                disabled={isSubmitting}
                className="flex-1 rounded-xl py-3 font-medium bg-red-600 hover:bg-red-700 text-white transition-all disabled:opacity-50"
              >
                접수 마감
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              {renderMobileFloating()}
            </div>
          )}
        </div>,
        document.body,
      )}

      {/* 취소 확인 모달 */}
      {cancelEntryId &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4"
            style={{ zIndex: 9999 }}
          >
            <div
              className="rounded-2xl p-6 max-w-md w-full relative"
              style={{
                zIndex: 10000,
                backgroundColor: "var(--bg-secondary)",
                border: "1px solid var(--border-color)",
              }}
            >
              <h3
                className="text-xl font-bold mb-4"
                style={{ color: "var(--text-primary)" }}
              >
                신청 취소 확인
              </h3>
              <p className="mb-6" style={{ color: "var(--text-secondary)" }}>
                정말로 참가 신청을 취소하시겠습니까?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setCancelEntryId(null)}
                  className="flex-1 rounded-xl py-3 font-medium transition-all hover:opacity-80"
                  style={{
                    backgroundColor: "var(--bg-card-hover)",
                    color: "var(--text-secondary)",
                  }}
                >
                  아니오
                </button>
                <button
                  onClick={handleCancel}
                  disabled={isSubmitting}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-3 font-medium transition-all disabled:opacity-50"
                >
                  {isSubmitting ? "처리 중..." : "예, 취소합니다"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* 마감 확인 모달 */}
      {showCloseModal &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4"
            style={{ zIndex: 9999 }}
          >
            <div
              className="rounded-2xl p-6 max-w-md w-full relative"
              style={{
                zIndex: 10000,
                backgroundColor: "var(--bg-secondary)",
                border: "1px solid var(--border-color)",
              }}
            >
              <h3
                className="text-xl font-bold mb-4"
                style={{ color: "var(--text-primary)" }}
              >
                참가 접수 마감
              </h3>
              <p className="mb-6" style={{ color: "var(--text-secondary)" }}>
                참가 접수를 마감하시겠습니까? 마감 후에는 더 이상 참가 신청을 받을 수 없습니다.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCloseModal(false)}
                  className="flex-1 rounded-xl py-3 font-medium transition-all hover:opacity-80"
                  style={{
                    backgroundColor: "var(--bg-card-hover)",
                    color: "var(--text-secondary)",
                  }}
                >
                  취소
                </button>
                <button
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-3 font-medium transition-all disabled:opacity-50"
                >
                  {isSubmitting ? "처리 중..." : "마감하기"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* 참가 신청 폼 모달 */}
      {showEntryForm && userProfile && (
        <TournamentEntryForm
          tournamentId={tournamentId}
          tournamentTitle={tournamentTitle}
          matchType={matchType}
          teamMatchCount={teamMatchCount}
          divisions={divisions}
          userProfile={userProfile}
          entryFee={entryFee}
          bankAccount={bankAccount}
          onClose={() => setShowEntryForm(false)}
          onSubmit={handleSubmit}
        />
      )}

      {/* 신청 수정 폼 모달 */}
      {showEditForm && activeEntry && (
        <TournamentEntryForm
          tournamentId={tournamentId}
          tournamentTitle={tournamentTitle}
          matchType={matchType}
          teamMatchCount={teamMatchCount}
          divisions={divisions}
          userProfile={{
            name: activeEntry.player_name || "",
            phone: activeEntry.phone || null,
            rating: activeEntry.player_rating || null,
            club: activeEntry.club_name || null,
          }}
          entryFee={entryFee}
          bankAccount={bankAccount}
          onClose={() => { setShowEditForm(false); setActiveEntryId(null); }}
          onSubmit={handleUpdate}
          editMode={true}
          initialData={{
            divisionId: activeEntry.division_id || "",
            phone: activeEntry.phone || "",
            playerName: activeEntry.player_name || "",
            playerRating: activeEntry.player_rating,
            clubName: activeEntry.club_name,
            teamOrder: activeEntry.team_order,
            partnerData: activeEntry.partner_data,
            teamMembers: activeEntry.team_members,
          }}
        />
      )}

      {/* Alert Dialog */}
      <AlertDialog
        isOpen={alertDialog.isOpen}
        onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
        title={alertDialog.title}
        message={alertDialog.message}
        type={alertDialog.type}
      />
    </>
  );
}
