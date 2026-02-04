"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createEntry, deleteEntry, updateEntry } from "@/lib/entries/actions";
import TournamentEntryForm, { EntryFormData } from "./TournamentEntryForm";
import { MatchType } from "@/lib/supabase/types";

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
}: TournamentEntryActionsProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

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

    return result;
  };

  // 참가 신청 수정 처리
  const handleUpdate = async (data: EntryFormData) => {
    if (!currentEntry) return { success: false, error: "신청 정보가 없습니다." };

    const result = await updateEntry(currentEntry.id, {
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
    if (!currentEntry || isSubmitting) return;

    setIsSubmitting(true);
    const result = await deleteEntry(currentEntry.id);
    setIsSubmitting(false);
    setShowCancelModal(false);

    if (result.success) {
      alert("참가 신청이 취소되었습니다.");
      router.refresh();
    } else {
      alert(result.error || "신청 취소에 실패했습니다.");
    }
  };

  // 신청 상태에 따른 배지 스타일
  const getStatusBadge = (status: string) => {
    const badges = {
      PENDING: {
        text: "승인 대기중",
        className:
          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      },
      APPROVED: {
        text: "승인됨",
        className:
          "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      },
      REJECTED: {
        text: "거절됨",
        className:
          "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      },
    };

    const badge = badges[status as keyof typeof badges] || badges.PENDING;

    return (
      <span
        className={`px-3 py-1 rounded-full text-sm font-medium ${badge.className}`}
      >
        {badge.text}
      </span>
    );
  };

  // 이미 신청한 경우
  if (currentEntry) {
    return (
      <>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4 text-lg">
            참가 신청 현황
          </h3>
          <div className="space-y-4">
            <div className="text-center py-4">
              {getStatusBadge(currentEntry.status)}
            </div>

            {currentEntry.status === "PENDING" && tournamentStatus === "OPEN" && (
              <>
                <p className="text-sm text-center text-gray-600 dark:text-gray-400">
                  주최자의 승인을 기다리고 있습니다.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowEditForm(true)}
                    disabled={isSubmitting}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    신청 수정
                  </button>
                  <button
                    onClick={() => setShowCancelModal(true)}
                    disabled={isSubmitting}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl py-3 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? "처리 중..." : "신청 취소"}
                  </button>
                </div>
              </>
            )}

            {currentEntry.status === "PENDING" && tournamentStatus !== "OPEN" && (
              <p className="text-sm text-center text-gray-600 dark:text-gray-400">
                주최자의 승인을 기다리고 있습니다.
              </p>
            )}

            {currentEntry.status === "APPROVED" && (
              <p className="text-sm text-center text-green-600 dark:text-green-400">
                참가 신청이 승인되었습니다!
              </p>
            )}

            {currentEntry.status === "REJECTED" && (
              <p className="text-sm text-center text-red-600 dark:text-red-400">
                참가 신청이 거절되었습니다.
              </p>
            )}
          </div>
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
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full relative"
                style={{ zIndex: 10000 }}
              >
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  신청 취소 확인
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  정말로 참가 신청을 취소하시겠습니까?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCancelModal(false)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl py-3 font-medium transition-all"
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
            document.body
          )}

        {/* 신청 수정 폼 모달 */}
        {showEditForm && currentEntry && (
          <TournamentEntryForm
            tournamentId={tournamentId}
            tournamentTitle={tournamentTitle}
            matchType={matchType}
            divisions={divisions}
            userProfile={{
              name: currentEntry.player_name || "",
              phone: currentEntry.phone || null,
              rating: currentEntry.player_rating || null,
              club: currentEntry.club_name || null,
            }}
            entryFee={entryFee}
            bankAccount={bankAccount}
            onClose={() => setShowEditForm(false)}
            onSubmit={handleUpdate}
            editMode={true}
            initialData={{
              divisionId: currentEntry.division_id || "",
              phone: currentEntry.phone || "",
              playerName: currentEntry.player_name || "",
              playerRating: currentEntry.player_rating,
              clubName: currentEntry.club_name,
              teamOrder: currentEntry.team_order,
              partnerData: currentEntry.partner_data,
              teamMembers: currentEntry.team_members,
            }}
          />
        )}
      </>
    );
  }

  // 신청하지 않은 경우
  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
        <h3 className="font-bold text-gray-900 dark:text-white mb-4 text-lg">
          참가 신청
        </h3>
        <div className="space-y-4">
          {!isLoggedIn ? (
            // 로그인하지 않은 경우
            <>
              <div className="text-center py-4">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  참가 신청을 하려면 로그인이 필요합니다.
                </p>
              </div>
              <button
                onClick={() => router.push("/login")}
                className="w-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl py-3 font-medium transition-all"
              >
                로그인하기
              </button>
            </>
          ) : tournamentStatus === "OPEN" ? (
            // 로그인한 사용자 & 접수 중인 대회
            <>
              <button
                onClick={() => setShowEntryForm(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 font-bold transition-all shadow hover:shadow-lg"
              >
                참가 신청하기
              </button>
              <p className="text-xs text-center text-gray-500">
                신청 후 주최자의 승인이 필요합니다.
              </p>
            </>
          ) : (
            // 접수 기간이 아닌 경우
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {tournamentStatus === "DRAFT" && "대회 준비 중입니다."}
                {tournamentStatus === "CLOSED" && "접수가 마감되었습니다."}
                {tournamentStatus === "IN_PROGRESS" && "대회가 진행 중입니다."}
                {tournamentStatus === "COMPLETED" && "종료된 대회입니다."}
                {tournamentStatus === "CANCELLED" && "취소된 대회입니다."}
              </p>
            </div>
          )}
        </div>
      </div>

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
    </>
  );
}
