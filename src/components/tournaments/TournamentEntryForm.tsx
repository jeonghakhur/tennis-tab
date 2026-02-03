"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MatchType, PartnerData, TeamMember } from "@/lib/supabase/types";

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

interface TournamentEntryFormProps {
  tournamentId: string;
  tournamentTitle: string;
  matchType: MatchType | null;
  divisions: Division[];
  userProfile: UserProfile;
  onClose: () => void;
  onSubmit: (
    data: EntryFormData,
  ) => Promise<{ success: boolean; error?: string }>;
}

export interface EntryFormData {
  divisionId: string;
  phone: string;
  playerName: string;
  playerRating: number | null;
  clubName?: string | null;
  teamOrder?: string | null;
  partnerData?: PartnerData | null;
  teamMembers?: TeamMember[] | null;
}

export default function TournamentEntryForm({
  tournamentId,
  tournamentTitle,
  matchType,
  divisions,
  userProfile,
  onClose,
  onSubmit,
}: TournamentEntryFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 폼 상태
  const [divisionId, setDivisionId] = useState("");
  const [phone, setPhone] = useState(userProfile.phone || "");
  const [playerName, setPlayerName] = useState(userProfile.name);
  const [playerRating, setPlayerRating] = useState<number | null>(
    userProfile.rating,
  );
  const [clubName, setClubName] = useState(userProfile.club || "");
  const [teamOrder, setTeamOrder] = useState("");

  // 파트너 정보 (개인전 복식)
  const [partnerName, setPartnerName] = useState("");
  const [partnerClub, setPartnerClub] = useState("");
  const [partnerRating, setPartnerRating] = useState<number | null>(null);

  // 팀원 정보 (단체전)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // 선택된 division 정보
  const selectedDivision = divisions.find((d) => d.id === divisionId);

  // 팀원 추가
  const addTeamMember = () => {
    if (!selectedDivision?.team_member_limit) return;
    if (teamMembers.length >= selectedDivision.team_member_limit) {
      alert(
        `최대 ${selectedDivision.team_member_limit}명까지 등록 가능합니다.`,
      );
      return;
    }
    setTeamMembers([...teamMembers, { name: "", rating: 0 }]);
  };

  // 팀원 제거
  const removeTeamMember = (index: number) => {
    setTeamMembers(teamMembers.filter((_, i) => i !== index));
  };

  // 팀원 정보 업데이트
  const updateTeamMember = (
    index: number,
    field: keyof TeamMember,
    value: string | number,
  ) => {
    const updated = [...teamMembers];
    updated[index] = { ...updated[index], [field]: value };
    setTeamMembers(updated);
  };

  // 폼 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!divisionId) {
      alert("참가 부서를 선택해주세요.");
      return;
    }

    if (!phone) {
      alert("전화번호를 입력해주세요.");
      return;
    }

    // 경기 타입별 유효성 검사
    if (matchType === "INDIVIDUAL_DOUBLES") {
      if (!partnerName || !partnerClub || partnerRating === null) {
        alert("파트너 정보를 모두 입력해주세요.");
        return;
      }
    }

    if (matchType === "TEAM_SINGLES" || matchType === "TEAM_DOUBLES") {
      if (!clubName) {
        alert("클럽명을 입력해주세요.");
        return;
      }
      if (teamMembers.length === 0) {
        alert("최소 1명의 팀원을 등록해주세요.");
        return;
      }
      for (const member of teamMembers) {
        if (!member.name || member.rating === null) {
          alert("모든 팀원의 정보를 입력해주세요.");
          return;
        }
      }
    }

    setIsSubmitting(true);

    const formData: EntryFormData = {
      divisionId,
      phone,
      playerName,
      playerRating,
    };

    // 경기 타입별 추가 데이터
    if (matchType === "INDIVIDUAL_DOUBLES") {
      formData.partnerData = {
        name: partnerName,
        club: partnerClub,
        rating: partnerRating!,
      };
    }

    if (matchType === "TEAM_SINGLES" || matchType === "TEAM_DOUBLES") {
      formData.clubName = clubName;
      formData.teamOrder = teamOrder || null;
      formData.teamMembers = teamMembers;
    }

    const result = await onSubmit(formData);
    setIsSubmitting(false);

    if (result.success) {
      alert("참가 신청이 완료되었습니다!");
      router.refresh();
      onClose();
    } else {
      alert(result.error || "참가 신청에 실패했습니다.");
    }
  };

  const inputClass =
    "w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent";
  const labelClass =
    "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2";

  return (
    <div
      className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      style={{ zIndex: 9999 }}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative"
        style={{ zIndex: 10000 }}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              참가 신청
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {tournamentTitle}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 참가 부서 선택 */}
          <div>
            <label className={labelClass}>
              참가 부서 <span className="text-red-500">*</span>
            </label>
            <select
              value={divisionId}
              onChange={(e) => setDivisionId(e.target.value)}
              className={inputClass}
              required
            >
              <option value="">선택해주세요</option>
              {divisions.map((division) => (
                <option key={division.id} value={division.id}>
                  {division.name}
                </option>
              ))}
            </select>
          </div>

          {/* 참가자 기본 정보 */}
          <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              참가자 정보
            </h3>

            <div>
              <label className={labelClass}>
                이름 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className={labelClass}>
                전화번호 <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010-1234-5678"
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className={labelClass}>점수 (레이팅)</label>
              <input
                type="number"
                value={playerRating || ""}
                onChange={(e) =>
                  setPlayerRating(
                    e.target.value ? parseInt(e.target.value) : null,
                  )
                }
                className={inputClass}
                min="1"
                max="100"
              />
            </div>
          </div>

          {/* 개인전 복식 - 파트너 정보 */}
          {matchType === "INDIVIDUAL_DOUBLES" && (
            <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                파트너 정보
              </h3>

              <div>
                <label className={labelClass}>
                  파트너 이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>
                  파트너 클럽명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={partnerClub}
                  onChange={(e) => setPartnerClub(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>
                  파트너 점수 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={partnerRating || ""}
                  onChange={(e) =>
                    setPartnerRating(
                      e.target.value ? parseInt(e.target.value) : null,
                    )
                  }
                  className={inputClass}
                  min="1"
                  max="100"
                  required
                />
              </div>
            </div>
          )}

          {/* 단체전 - 클럽 및 팀원 정보 */}
          {(matchType === "TEAM_SINGLES" || matchType === "TEAM_DOUBLES") && (
            <>
              <div className="space-y-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  클럽 정보
                </h3>

                <div>
                  <label className={labelClass}>
                    클럽명 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={clubName}
                    onChange={(e) => setClubName(e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>팀 순서 (가, 나, 다 등)</label>
                  <input
                    type="text"
                    value={teamOrder}
                    onChange={(e) => setTeamOrder(e.target.value)}
                    placeholder="예: 가"
                    className={inputClass}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    * 같은 클럽이 여러 팀 출전 시 순서를 입력해주세요
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    팀원 정보
                  </h3>
                  <button
                    type="button"
                    onClick={addTeamMember}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    + 팀원 추가
                  </button>
                </div>

                {selectedDivision?.team_member_limit && (
                  <p className="text-sm text-gray-500">
                    * 최대 {selectedDivision.team_member_limit}명까지 등록 가능
                  </p>
                )}

                {teamMembers.map((member, index) => (
                  <div
                    key={index}
                    className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl space-y-3 border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900 dark:text-white">
                        팀원 {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeTeamMember(index)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        제거
                      </button>
                    </div>

                    <div>
                      <label className={labelClass}>
                        이름 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={member.name}
                        onChange={(e) =>
                          updateTeamMember(index, "name", e.target.value)
                        }
                        className={inputClass}
                        required
                      />
                    </div>

                    <div>
                      <label className={labelClass}>
                        점수 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={member.rating}
                        onChange={(e) =>
                          updateTeamMember(
                            index,
                            "rating",
                            parseInt(e.target.value) || 0,
                          )
                        }
                        className={inputClass}
                        min="1"
                        max="100"
                        required
                      />
                    </div>
                  </div>
                ))}

                {teamMembers.length === 0 && (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
                    팀원을 추가해주세요
                  </div>
                )}
              </div>
            </>
          )}

          {/* 결제 안내 */}
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              💡 참가비 결제는 신청 승인 후 별도 안내드립니다.
            </p>
          </div>

          {/* 제출 버튼 */}
          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "신청 중..." : "참가 신청하기"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
