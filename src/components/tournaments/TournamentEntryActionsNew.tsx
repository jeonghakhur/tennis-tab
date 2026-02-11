"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname } from "next/navigation";
import {
  createEntry,
  deleteEntry,
  updateEntry,
  getUserEntry,
} from "@/lib/entries/actions";
import { closeTournament } from "@/lib/tournaments/actions";
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
  divisions: Division[];
  currentEntry: CurrentEntry | null;
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
  divisions,
  currentEntry,
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
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [mounted, setMounted] = useState(false);
  // 서버에서 currentEntry가 null로 올 수 있어, 클라이언트에서 한 번 더 조회
  const [entry, setEntry] = useState<CurrentEntry | null>(currentEntry);
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

    getUserEntry(tournamentId).then((e) => {
      if (e) {
        setEntry(e as CurrentEntry);
      } else {
        setEntry(null);
      }
    });
  }, [mounted, isLoggedIn, tournamentId]);

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
      teamMembers: data.teamMembers,
    });

    if (result.success && result.entryId) {
      getUserEntry(tournamentId).then((e) => {
        if (e) setEntry(e as CurrentEntry);
      });
    }

    return result;
  };

  // 참가 신청 수정 처리
  const handleUpdate = async (data: EntryFormData) => {
    if (!entry) return { success: false, error: "신청 정보가 없습니다." };

    const result = await updateEntry(entry.id, {
      divisionId: data.divisionId,
      phone: data.phone,
      playerName: data.playerName,
      playerRating: data.playerRating,
      clubName: data.clubName,
      teamOrder: data.teamOrder,
      partnerData: data.partnerData,
      teamMembers: data.teamMembers,
    });

    return result;
  };

  // 신청 취소 처리
  const handleCancel = async () => {
    if (!entry || isSubmitting) return;

    setIsSubmitting(true);
    const result = await deleteEntry(entry.id);
    setIsSubmitting(false);
    setShowCancelModal(false);

    if (result.success) {
      setEntry(null);
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

  // 참가 마감 처리
  const handleClose = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    const result = await closeTournament(tournamentId);
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
    const isPaid = paymentStatus === "PAID";
    return (
      <span
        className="px-3 py-1 rounded-full text-sm font-medium"
        style={{
          backgroundColor: isPaid
            ? "rgba(16, 185, 129, 0.15)"
            : "rgba(239, 68, 68, 0.15)",
          color: isPaid ? "#059669" : "#dc2626",
        }}
      >
        {isPaid ? "결제 완료" : "미결제"}
      </span>
    );
  };

  // 이미 신청한 경우: 수정하기·참가 취소하기 표시
  const canEditOrCancel =
    entry?.id &&
    canAcceptEntry &&
    !["CANCELLED", "REJECTED"].includes(entry.status);

  return (
    <>
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
          ) : entry?.id ? (
            // 이미 신청한 경우
            <>
              {/* 신청 정보 요약 */}
              <div
                className="rounded-xl p-4 space-y-3"
                style={{ backgroundColor: "var(--bg-card)" }}
              >
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                    신청 순서
                  </span>
                  <span
                    className="font-bold"
                    style={{ color: "var(--accent-color)" }}
                  >
                    {entry.current_rank ?? "-"}번째
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                    신청 상태
                  </span>
                  {getStatusBadge(entry.status)}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                    결제 여부
                  </span>
                  {getPaymentBadge(entry.payment_status)}
                </div>
              </div>

              {canEditOrCancel && (
                <>
                  <p
                    className="text-sm text-center"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {entry.status === "PENDING" &&
                      "주최자의 승인을 기다리고 있습니다."}
                    {entry.status === "CONFIRMED" &&
                      "참가 신청이 확정되었습니다."}
                    {(entry.status === "APPROVED" ||
                      entry.status === "WAITLISTED") &&
                      "참가 신청이 접수되었습니다."}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowEditForm(true)}
                      disabled={isSubmitting}
                      className="flex-1 rounded-xl py-3 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80"
                      style={{
                        backgroundColor: "var(--accent-color)",
                        color: "var(--bg-primary)",
                      }}
                    >
                      수정하기
                    </button>
                    <button
                      onClick={() => setShowCancelModal(true)}
                      disabled={isSubmitting}
                      className="flex-1 rounded-xl py-3 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80"
                      style={{
                        backgroundColor: "var(--bg-card-hover)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {isSubmitting ? "처리 중..." : "참가 취소하기"}
                    </button>
                  </div>
                </>
              )}

              {!canEditOrCancel &&
                !canAcceptEntry &&
                !["CANCELLED", "REJECTED"].includes(entry.status) && (
                  <p
                    className="text-sm text-center"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {tournamentStatus === "COMPLETED" &&
                      "대회가 종료되었습니다."}
                    {tournamentStatus === "IN_PROGRESS" &&
                      "대회가 진행 중입니다. 수정·취소가 불가합니다."}
                    {tournamentStatus === "CLOSED" &&
                      "접수가 마감되었습니다. 수정·취소가 불가합니다."}
                    {tournamentStatus === "CANCELLED" &&
                      "대회가 취소되었습니다."}
                    {tournamentStatus === "OPEN" &&
                      !withinPeriod &&
                      "접수 기간이 아닙니다. 수정·취소는 접수 중에만 가능합니다."}
                  </p>
                )}

              {entry.status === "WAITLISTED" && (
                <p
                  className="text-sm text-center"
                  style={{ color: "#d97706" }}
                >
                  대기자 목록에 등록되었습니다. 순번이 되면 연락드립니다.
                </p>
              )}

              {entry.status === "APPROVED" && (
                <p
                  className="text-sm text-center"
                  style={{ color: "#059669" }}
                >
                  참가 신청이 승인되었습니다!
                </p>
              )}

              {entry.status === "REJECTED" && (
                <p
                  className="text-sm text-center"
                  style={{ color: "#dc2626" }}
                >
                  참가 신청이 거절되었습니다.
                </p>
              )}

              {entry.status === "CANCELLED" && (
                <p
                  className="text-sm text-center"
                  style={{ color: "var(--text-muted)" }}
                >
                  참가 신청이 취소되었습니다.
                </p>
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
                {tournamentStatus === "CLOSED" && "접수가 마감되었습니다."}
                {tournamentStatus === "IN_PROGRESS" && "대회가 진행 중입니다."}
                {tournamentStatus === "COMPLETED" && "종료된 대회입니다."}
                {tournamentStatus === "CANCELLED" && "취소된 대회입니다."}
                {tournamentStatus === "OPEN" && !withinPeriod && entryStartDate && new Date(entryStartDate) > new Date() && "접수 시작 전입니다."}
                {tournamentStatus === "OPEN" && !withinPeriod && entryEndDate && new Date(entryEndDate) < new Date() && "접수 기간이 종료되었습니다."}
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

      {/* 취소 확인 모달 */}
      {showCancelModal &&
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
                  onClick={() => setShowCancelModal(false)}
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
          divisions={divisions}
          userProfile={userProfile}
          entryFee={entryFee}
          bankAccount={bankAccount}
          onClose={() => setShowEntryForm(false)}
          onSubmit={handleSubmit}
        />
      )}

      {/* 신청 수정 폼 모달 */}
      {showEditForm && entry && (
        <TournamentEntryForm
          tournamentId={tournamentId}
          tournamentTitle={tournamentTitle}
          matchType={matchType}
          divisions={divisions}
          userProfile={{
            name: entry.player_name || "",
            phone: entry.phone || null,
            rating: entry.player_rating || null,
            club: entry.club_name || null,
          }}
          entryFee={entryFee}
          bankAccount={bankAccount}
          onClose={() => setShowEditForm(false)}
          onSubmit={handleUpdate}
          editMode={true}
          initialData={{
            divisionId: entry.division_id || "",
            phone: entry.phone || "",
            playerName: entry.player_name || "",
            playerRating: entry.player_rating,
            clubName: entry.club_name,
            teamOrder: entry.team_order,
            partnerData: entry.partner_data,
            teamMembers: entry.team_members,
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
