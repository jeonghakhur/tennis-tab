"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MatchType, PartnerData, TeamMember } from "@/lib/supabase/types";
import PhoneInput from "@/components/ui/PhoneInput";
import { unformatPhoneNumber } from "@/lib/utils/phone";
import { AlertDialog, ConfirmDialog } from "@/components/common/AlertDialog";
import { Modal } from "@/components/common/Modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { searchPartnerByName, getClubMembersByClubName, type PartnerSearchResult, type ClubMemberInfo } from "@/lib/entries/actions";

// 입력값 변경 후 일정 시간 대기하여 안정된 값 반환 (검증 UI 깜빡임 방지)
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

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
  teamMatchCount: number | null;
  divisions: Division[];
  userProfile: UserProfile;
  entryFee: number;
  bankAccount: string | null;
  onClose: () => void;
  onSubmit: (
    data: EntryFormData,
  ) => Promise<{ success: boolean; error?: string }>;
  editMode?: boolean;
  initialData?: EntryFormData;
}

export interface EntryFormData {
  divisionId: string;
  phone: string;
  playerName: string;
  playerRating: number | null;
  clubName?: string | null;
  teamOrder?: string | null;
  partnerData?: PartnerData | null;
  partnerUserId?: string | null;
  teamMembers?: TeamMember[] | null;
  applicantParticipates?: boolean;
  refundBank?: string | null;
  refundAccount?: string | null;
  refundHolder?: string | null;
}

export default function TournamentEntryForm({
  tournamentTitle,
  matchType,
  teamMatchCount,
  divisions,
  userProfile,
  entryFee,
  bankAccount,
  onClose,
  onSubmit,
  editMode = false,
  initialData,
}: TournamentEntryFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  // 폼 상태 (수정 모드일 경우 initialData 사용)
  const [divisionId, setDivisionId] = useState(initialData?.divisionId || "");
  const [phone, setPhone] = useState(
    initialData?.phone || userProfile.phone || "",
  );
  const [playerName, setPlayerName] = useState(
    initialData?.playerName || userProfile.name,
  );
  const debouncedPlayerName = useDebounce(playerName, 400);
  const [playerRating, setPlayerRating] = useState<number | null>(
    initialData?.playerRating ?? userProfile.rating,
  );
  const [clubName, setClubName] = useState(
    initialData?.clubName || userProfile.club || "",
  );
  const [teamOrder, setTeamOrder] = useState(initialData?.teamOrder || "");

  // 환불 계좌 (참가비 있는 경우)
  const [refundBank, setRefundBank] = useState(initialData?.refundBank || "");
  const [refundAccount, setRefundAccount] = useState(initialData?.refundAccount || "");
  const [refundHolder, setRefundHolder] = useState(initialData?.refundHolder || "");

  // 파트너 정보 (개인전 복식)
  const [partnerName, setPartnerName] = useState(
    initialData?.partnerData?.name || "",
  );
  const [partnerClub, setPartnerClub] = useState(
    initialData?.partnerData?.club || "",
  );
  const [partnerRating, setPartnerRating] = useState<number | null>(
    initialData?.partnerData?.rating ?? null,
  );
  // 파트너 시스템 계정 연동
  const [partnerUserId, setPartnerUserId] = useState<string | null>(
    initialData?.partnerUserId ?? null,
  );
  const [partnerSearchResults, setPartnerSearchResults] = useState<PartnerSearchResult[]>([]);
  const [isSearchingPartner, setIsSearchingPartner] = useState(false);
  const [showPartnerDropdown, setShowPartnerDropdown] = useState(false);
  const partnerSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const partnerDropdownRef = useRef<HTMLDivElement>(null);

  // 파트너 검색 입력 핸들러 (디바운스 300ms)
  const handlePartnerNameChange = (value: string) => {
    setPartnerName(value);
    // 수동 입력 시 연동 해제
    setPartnerUserId(null);

    if (partnerSearchRef.current) clearTimeout(partnerSearchRef.current);
    if (value.trim().length < 2) {
      setPartnerSearchResults([]);
      setShowPartnerDropdown(false);
      return;
    }
    setIsSearchingPartner(true);
    partnerSearchRef.current = setTimeout(async () => {
      const results = await searchPartnerByName(value);
      setPartnerSearchResults(results);
      setShowPartnerDropdown(results.length > 0);
      setIsSearchingPartner(false);
    }, 300);
  };

  // 파트너 선택 시 자동 채우기
  const handleSelectPartner = (partner: PartnerSearchResult) => {
    setPartnerName(partner.name);
    setPartnerClub(partner.club ?? "");
    setPartnerRating(partner.rating ?? null);
    setPartnerUserId(partner.id);
    setShowPartnerDropdown(false);
    setPartnerSearchResults([]);
  };

  // 파트너 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (partnerDropdownRef.current && !partnerDropdownRef.current.contains(e.target as Node)) {
        setShowPartnerDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 단체전 + clubName 확정 시 클럽 회원 목록 조회 (검증 + rating 자동 채우기용)
  useEffect(() => {
    const isTeam = matchType === "TEAM_SINGLES" || matchType === "TEAM_DOUBLES";
    if (!isTeam || !clubName.trim()) {
      setClubMembers([]);
      return;
    }
    getClubMembersByClubName(clubName).then(setClubMembers);
  }, [matchType, clubName]);

  // 팀원 정보 (단체전) — 최소 필요 인원만큼 빈 슬롯 선생성
  const isTeamMatch =
    matchType === "TEAM_SINGLES" || matchType === "TEAM_DOUBLES";

  // 클럽 회원 목록 (단체전 팀원 검증 + rating 자동 채우기용 — 빈 배열이면 검증 skip)
  const [clubMembers, setClubMembers] = useState<ClubMemberInfo[]>([]);
  // 미등록 팀원 확인 다이얼로그
  const [showNonMemberConfirm, setShowNonMemberConfirm] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<EntryFormData | null>(null);
  const requiredTotal =
    isTeamMatch && teamMatchCount
      ? matchType === "TEAM_DOUBLES"
        ? teamMatchCount * 2
        : teamMatchCount
      : 0;

  // 신청자 참가 여부 (단체전 전용) — false면 팀원 슬롯이 requiredTotal 전체로 늘어남
  const [applicantParticipates, setApplicantParticipates] = useState(
    initialData?.applicantParticipates ?? true
  );

  const requiredMembers = Math.max(
    0,
    applicantParticipates ? requiredTotal - 1 : requiredTotal
  );

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(() => {
    if (initialData?.teamMembers?.length) return initialData.teamMembers;
    return Array.from({ length: requiredMembers }, () => ({
      name: "",
      rating: 0,
    }));
  });
  const debouncedMembers = useDebounce(teamMembers, 400);

  // 신청자 참가 여부 변경 핸들러
  const handleApplicantParticipatesChange = (checked: boolean) => {
    setApplicantParticipates(checked);
    // 불참으로 변경 시 부족한 팀원 슬롯 자동 추가
    const newRequired = checked ? requiredTotal - 1 : requiredTotal;
    if (teamMembers.length < newRequired) {
      setTeamMembers((prev) => [
        ...prev,
        ...Array.from({ length: newRequired - prev.length }, () => ({ name: "", rating: 0 })),
      ]);
    }
  };

  // 선택된 division 정보
  const selectedDivision = divisions.find((d) => d.id === divisionId);

  // 팀원 추가 — limit이 없으면 무제한, 있으면 AlertDialog로 차단
  const addTeamMember = () => {
    const limit = selectedDivision?.team_member_limit;
    if (limit != null && teamMembers.length >= limit) {
      setAlertDialog({
        isOpen: true,
        title: "팀원 추가 불가",
        message: `최대 ${limit}명까지 등록 가능합니다.`,
        type: "warning",
      });
      return;
    }
    setTeamMembers([...teamMembers, { name: "", rating: 0 }]);
  };

  // 팀원 제거 — 최소 필요 인원 이하로는 제거 불가
  const removeTeamMember = (index: number) => {
    if (teamMembers.length <= requiredMembers) {
      setAlertDialog({
        isOpen: true,
        title: "제거 불가",
        message: `최소 ${requiredMembers}명의 팀원이 필요합니다.`,
        type: "warning",
      });
      return;
    }
    setTeamMembers(teamMembers.filter((_, i) => i !== index));
  };

  // 팀원 정보 업데이트 — 이름 변경 시 클럽 회원이면 rating 자동 채우기
  const updateTeamMember = (
    index: number,
    field: keyof TeamMember,
    value: string | number,
  ) => {
    const updated = [...teamMembers];
    updated[index] = { ...updated[index], [field]: value };
    if (field === "name" && typeof value === "string") {
      const member = findClubMember(value);
      if (member?.rating !== null && member?.rating !== undefined) {
        updated[index].rating = member.rating;
      }
    }
    setTeamMembers(updated);
  };

  // 신청자 이름 변경 시 클럽 회원이면 rating 자동 채우기
  const handlePlayerNameChange = (value: string) => {
    setPlayerName(value);
    const member = findClubMember(value);
    if (member?.rating !== null && member?.rating !== undefined) {
      setPlayerRating(member.rating);
    }
  };

  // 클럽 회원 조회 헬퍼 (clubMembers가 빈 배열이면 미등록 클럽 → undefined 반환)
  const findClubMember = (name: string): ClubMemberInfo | undefined =>
    clubMembers.length === 0 ? undefined : clubMembers.find((m) => m.name === name.trim());

  // 클럽 회원 여부 (미등록 클럽이면 항상 true → 검증 skip)
  const isClubMember = (name: string) =>
    clubMembers.length === 0 || !!findClubMember(name);

  // 전체 팀원 이름에서 중복 이름 집합 계산
  const getDuplicateNames = (): Set<string> => {
    const allNames = [
      ...(applicantParticipates ? [playerName] : []),
      ...teamMembers.map((m) => m.name),
    ].filter(Boolean).map((n) => n.trim());
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const name of allNames) {
      if (seen.has(name)) dupes.add(name);
      else seen.add(name);
    }
    return dupes;
  };

  // 실제 onSubmit 호출 및 결과 처리
  const doSubmit = async (formData: EntryFormData) => {
    setIsSubmitting(true);
    const result = await onSubmit(formData);
    setIsSubmitting(false);

    if (result.success) {
      setAlertDialog({
        isOpen: true,
        title: editMode ? "수정 완료" : "신청 완료",
        message: editMode
          ? "신청 정보가 수정되었습니다!"
          : "참가 신청이 완료되었습니다!",
        type: "success",
      });
      router.refresh();
      setTimeout(() => onClose(), 1500);
    } else {
      setAlertDialog({
        isOpen: true,
        title: editMode ? "수정 실패" : "신청 실패",
        message:
          result.error ||
          (editMode
            ? "신청 수정에 실패했습니다."
            : "참가 신청에 실패했습니다."),
        type: "error",
      });
    }
  };

  // 폼 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!divisionId) {
      setAlertDialog({
        isOpen: true,
        title: "입력 필요",
        message: "참가 부서를 선택해주세요.",
        type: "warning",
      });
      return;
    }

    if (!phone) {
      setAlertDialog({
        isOpen: true,
        title: "입력 필요",
        message: "전화번호를 입력해주세요.",
        type: "warning",
      });
      return;
    }

    // 환불 계좌 필수 검증 (참가비 있는 경우)
    if (entryFee > 0) {
      if (!refundBank.trim()) {
        setAlertDialog({ isOpen: true, title: "입력 필요", message: "환불 받을 은행명을 입력해주세요.", type: "warning" });
        return;
      }
      if (!refundAccount.trim()) {
        setAlertDialog({ isOpen: true, title: "입력 필요", message: "환불 받을 계좌번호를 입력해주세요.", type: "warning" });
        return;
      }
      if (!refundHolder.trim()) {
        setAlertDialog({ isOpen: true, title: "입력 필요", message: "환불 받을 계좌의 예금주를 입력해주세요.", type: "warning" });
        return;
      }
    }

    // 경기 타입별 유효성 검사
    if (matchType === "INDIVIDUAL_DOUBLES") {
      if (!partnerName || !partnerClub || partnerRating === null) {
        setAlertDialog({
          isOpen: true,
          title: "입력 필요",
          message: "파트너 정보를 모두 입력해주세요.",
          type: "warning",
        });
        return;
      }
    }

    if (matchType === "TEAM_SINGLES" || matchType === "TEAM_DOUBLES") {
      if (!clubName) {
        setAlertDialog({
          isOpen: true,
          title: "클럽 정보 없음",
          message: "프로필에 클럽을 등록해야 단체전 신청이 가능합니다.",
          type: "warning",
        });
        return;
      }
      // 단체전 팀원 수 검증: 신청자 참가 여부에 따라 필요 팀원 수 계산
      const effectiveRequired = applicantParticipates
        ? requiredMembers   // 신청자 포함 → 팀원만 requiredTotal-1명
        : requiredTotal;    // 신청자 불참 → 팀원으로 requiredTotal명 전체 필요
      if (teamMembers.length < effectiveRequired) {
        const label = applicantParticipates
          ? `신청자 포함 총 ${requiredTotal}명`
          : `신청자 제외 총 ${requiredTotal}명`;
        setAlertDialog({
          isOpen: true,
          title: "입력 필요",
          message: `팀원 ${effectiveRequired}명을 등록해주세요. (${label} 필요)`,
          type: "warning",
        });
        return;
      }
      for (const member of teamMembers) {
        if (!member.name || member.rating === null) {
          setAlertDialog({
            isOpen: true,
            title: "입력 필요",
            message: "모든 팀원의 정보를 입력해주세요.",
            type: "warning",
          });
          return;
        }
      }
    }

    const formData: EntryFormData = {
      divisionId,
      phone: unformatPhoneNumber(phone),
      playerName,
      playerRating,
      refundBank: entryFee > 0 ? (refundBank || null) : null,
      refundAccount: entryFee > 0 ? (refundAccount || null) : null,
      refundHolder: entryFee > 0 ? (refundHolder || null) : null,
    };

    // 경기 타입별 추가 데이터
    if (matchType === "INDIVIDUAL_DOUBLES") {
      formData.partnerData = {
        name: partnerName,
        club: partnerClub,
        rating: partnerRating!,
      };
      formData.partnerUserId = partnerUserId;
    }

    if (matchType === "TEAM_SINGLES" || matchType === "TEAM_DOUBLES") {
      formData.clubName = clubName;
      formData.teamOrder = teamOrder || null;
      formData.teamMembers = teamMembers;
      formData.applicantParticipates = applicantParticipates;

      // 중복 팀원 검사 (hard error)
      const dupes = getDuplicateNames();
      if (dupes.size > 0) {
        setAlertDialog({
          isOpen: true,
          title: "중복 팀원",
          message: `${[...dupes].join(", ")} — 동일한 팀원이 중복 입력되었습니다.`,
          type: "error",
        });
        return;
      }

      // 클럽 회원 검증: 미등록 팀원이 있으면 확인 다이얼로그 (soft)
      if (clubMembers.length > 0) {
        const allNames = [
          ...(applicantParticipates ? [playerName] : []),
          ...teamMembers.map((m) => m.name).filter(Boolean),
        ];
        const nonMembers = allNames.filter((name) => !isClubMember(name));
        if (nonMembers.length > 0) {
          setPendingFormData(formData);
          setShowNonMemberConfirm(true);
          return;
        }
      }
    }

    await doSubmit(formData);
  };

  // UI 표시용 중복 이름 집합 (디바운스된 값 기반 — 입력 중 깜빡임 방지)
  const displayDupeNames = (() => {
    const allNames = [
      ...(applicantParticipates ? [debouncedPlayerName] : []),
      ...debouncedMembers.map((m) => m.name),
    ].filter(Boolean).map((n) => n.trim());
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const name of allNames) {
      if (seen.has(name)) dupes.add(name);
      else seen.add(name);
    }
    return dupes;
  })();

  const inputClass =
    "w-full px-4 py-3 rounded-xl border border-(--border-color) bg-(--bg-input) text-(--text-primary) focus:ring-2 focus:ring-blue-500 focus:border-transparent";
  const labelClass =
    "block text-sm font-medium text-(--text-secondary) mb-2";

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={editMode ? "신청 수정" : "참가 신청"}
      description={tournamentTitle}
      size="2xl"
    >
      <Modal.Body>
        <form
          id="entry-form"
          onSubmit={handleSubmit}
          className="space-y-6"
          noValidate
        >
          {/* 참가 부서 선택 */}
          <div>
            <label className={labelClass}>
              참가 부서 <span className="text-red-500">*</span>
            </label>
            <Select
              value={divisionId}
              onValueChange={setDivisionId}
            >
              <SelectTrigger className={inputClass}>
                <SelectValue placeholder="선택해주세요" />
              </SelectTrigger>
              <SelectContent position="popper">
                {divisions.map((division) => (
                  <SelectItem key={division.id} value={division.id}>
                    {division.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 참가자 기본 정보 — 개인전만 전체 섹션 표시 */}
          {!isTeamMatch && (
            <div className="space-y-4 p-4 bg-(--bg-secondary) rounded-xl">
              <h3 className="font-semibold text-(--text-primary)">
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
                />
              </div>

              <div>
                <label className={labelClass}>
                  전화번호 <span className="text-red-500">*</span>
                </label>
                <PhoneInput
                  value={phone}
                  onChange={setPhone}
                  className={inputClass}
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
                  max="9999"
                />
              </div>
            </div>
          )}

          {/* 단체전: 연락처만 간소 표시 */}
          {isTeamMatch && (
            <div>
              <label className={labelClass}>
                연락처 <span className="text-red-500">*</span>
              </label>
              <PhoneInput
                value={phone}
                onChange={setPhone}
                className={inputClass}
              />
            </div>
          )}

          {/* 개인전 복식 - 파트너 정보 */}
          {matchType === "INDIVIDUAL_DOUBLES" && (
            <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
              <h3 className="font-semibold text-(--text-primary)">
                파트너 정보
              </h3>

              {/* 파트너 이름 + 검색 드롭다운 */}
              <div className="relative" ref={partnerDropdownRef}>
                <label className={labelClass}>
                  파트너 이름 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={partnerName}
                    onChange={(e) => handlePartnerNameChange(e.target.value)}
                    onFocus={() => partnerSearchResults.length > 0 && setShowPartnerDropdown(true)}
                    className={inputClass}
                    placeholder="이름 입력 후 검색"
                    autoComplete="off"
                  />
                  {isSearchingPartner && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                      검색 중...
                    </span>
                  )}
                  {partnerUserId && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-blue-500 font-medium">
                      ✓ 연동됨
                    </span>
                  )}
                </div>
                {showPartnerDropdown && (
                  <ul className="absolute z-50 w-full mt-1 bg-(--bg-input) border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
                    {partnerSearchResults.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectPartner(p)}
                          className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                        >
                          <span className="font-medium text-(--text-primary)">{p.name}</span>
                          <span className="ml-2 text-sm text-(--text-muted)">
                            {p.club && `${p.club} · `}{p.rating != null ? `${p.rating}점` : "점수 없음"}
                          </span>
                        </button>
                      </li>
                    ))}
                    <li>
                      <button
                        type="button"
                        onClick={() => setShowPartnerDropdown(false)}
                        className="w-full text-left px-4 py-2 text-sm text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        직접 입력
                      </button>
                    </li>
                  </ul>
                )}
                {!partnerUserId && partnerName && (
                  <p className="text-xs text-gray-400 mt-1">
                    * 시스템에 등록된 회원이면 이름 입력 후 목록에서 선택하세요
                  </p>
                )}
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
                  max="9999"
                />
              </div>
            </div>
          )}

          {/* 단체전 - 클럽 및 팀원 정보 */}
          {(matchType === "TEAM_SINGLES" || matchType === "TEAM_DOUBLES") && (
            <>
              {/* 클럽명 — 항상 읽기 전용 (프로필 클럽 자동 사용) */}
              <div>
                <label className={labelClass}>클럽명</label>
                <p className="px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-(--bg-input) text-(--text-muted) text-sm">
                  {clubName || "프로필에 클럽을 등록해주세요"}
                </p>
              </div>

              {/* 팀 순서 — 수정 모드에서만 읽기 전용 표시 (신규 신청 시 서버에서 자동 부여) */}
              {editMode && teamOrder && (
                <div>
                  <label className={labelClass}>팀 순서</label>
                  <p className="px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-(--bg-input) text-(--text-muted) text-sm">
                    {teamOrder}팀
                  </p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-(--text-primary)">
                      팀원 정보
                    </h3>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={applicantParticipates}
                        onChange={(e) => handleApplicantParticipatesChange(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        신청자도 선수로 참가
                      </span>
                    </label>
                  </div>
                  {(() => {
                    const maxLimit = selectedDivision?.team_member_limit;
                    return (
                      <p className="text-sm text-gray-500 mt-1">
                        {requiredTotal > 0 && (
                          applicantParticipates
                            ? `* 신청자 포함 최소 ${requiredTotal}명 필요`
                            : `* 신청자 제외 ${requiredTotal}명 필요`
                        )}
                        {requiredTotal > 0 && maxLimit && " / "}
                        {maxLimit && `최대 ${maxLimit}명까지 등록 가능`}
                      </p>
                    );
                  })()}
                </div>

                <div className="space-y-2">
                  {/* 신청자(본인) 슬롯 — 참가 시 맨 앞에 자동 표시 */}
                  {applicantParticipates && (() => {
                    const isNonMember = debouncedPlayerName && clubMembers.length > 0 && !isClubMember(debouncedPlayerName);
                    const isDupe = debouncedPlayerName && displayDupeNames.has(debouncedPlayerName.trim());
                    const borderClass = isNonMember
                      ? "border-red-400 bg-(--bg-input)"
                      : isDupe
                      ? "border-amber-400 bg-(--bg-input)"
                      : "border-(--border-color) bg-(--bg-input)";
                    return (
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 w-10 shrink-0 text-center bg-blue-100 dark:bg-blue-900/40 rounded-lg py-2 mt-0.5">
                        본인
                      </span>
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          value={playerName}
                          onChange={(e) => handlePlayerNameChange(e.target.value)}
                          placeholder="이름"
                          className={`w-full px-4 py-3 rounded-xl border ${borderClass} text-(--text-primary) focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                          aria-label="신청자 이름"
                        />
                        {isNonMember && (
                          <p className="mt-1 text-xs text-red-500">클럽 회원이 아닙니다</p>
                        )}
                        {isDupe && !isNonMember && (
                          <p className="mt-1 text-xs text-amber-500">이미 입력된 팀원입니다</p>
                        )}
                      </div>
                      <input
                        type="number"
                        value={playerRating || ""}
                        onChange={(e) =>
                          setPlayerRating(
                            e.target.value ? parseInt(e.target.value) : null,
                          )
                        }
                        placeholder="점수"
                        className="w-32 shrink-0 px-4 py-3 rounded-xl border border-(--border-color) bg-(--bg-input) text-(--text-primary) focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        aria-label="신청자 점수"
                        min="1"
                        max="9999"
                      />
                      {/* 신청자 슬롯은 제거 불가 — 체크박스로 해제 */}
                      <span className="shrink-0 w-6 text-center text-blue-300 dark:text-blue-600 text-xs mt-3">
                        🔒
                      </span>
                    </div>
                    );
                  })()}

                  {teamMembers.map((member, index) => {
                    const debouncedName = debouncedMembers[index]?.name ?? "";
                    const isNonMember = debouncedName && clubMembers.length > 0 && !isClubMember(debouncedName);
                    const isDupe = debouncedName && displayDupeNames.has(debouncedName.trim());
                    const borderClass = isNonMember
                      ? "border-red-400 bg-(--bg-input)"
                      : isDupe
                      ? "border-amber-400 bg-(--bg-input)"
                      : "border-(--border-color) bg-(--bg-input)";
                    return (
                    <div key={index} className="flex items-start gap-2">
                      <span className="text-sm font-medium text-(--text-muted) w-10 shrink-0 text-center mt-3">
                        {applicantParticipates ? index + 2 : index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          value={member.name}
                          onChange={(e) =>
                            updateTeamMember(index, "name", e.target.value)
                          }
                          placeholder="이름"
                          className={`w-full px-4 py-3 rounded-xl border ${borderClass} text-(--text-primary) focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                          aria-label={`팀원 ${applicantParticipates ? index + 2 : index + 1} 이름`}
                        />
                        {isNonMember && (
                          <p className="mt-1 text-xs text-red-500">클럽 회원이 아닙니다</p>
                        )}
                        {isDupe && !isNonMember && (
                          <p className="mt-1 text-xs text-amber-500">이미 입력된 팀원입니다</p>
                        )}
                      </div>
                      <input
                        type="number"
                        value={member.rating || ""}
                        onChange={(e) =>
                          updateTeamMember(
                            index,
                            "rating",
                            parseInt(e.target.value) || 0,
                          )
                        }
                        placeholder="점수(레이팅)"
                        className="w-32 shrink-0 px-4 py-3 rounded-xl border border-(--border-color) bg-(--bg-input) text-(--text-primary) focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        aria-label={`팀원 ${applicantParticipates ? index + 2 : index + 1} 점수`}
                        min="1"
                        max="9999"
                      />
                      <button
                        type="button"
                        onClick={() => removeTeamMember(index)}
                        className="shrink-0 text-red-500 hover:text-red-700 text-sm px-1 mt-3"
                        aria-label={`팀원 ${applicantParticipates ? index + 2 : index + 1} 제거`}
                      >
                        ✕
                      </button>
                    </div>
                    );
                  })}

                  {/* 팀원 추가 버튼 — 리스트 마지막에 위치 */}
                  <button
                    type="button"
                    onClick={addTeamMember}
                    className="w-full mt-1 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 text-(--text-muted) hover:border-green-500 hover:text-green-600 dark:hover:border-green-500 dark:hover:text-green-400 rounded-xl text-sm font-medium transition-colors"
                  >
                    + 팀원 추가
                  </button>
                </div>
              </div>
            </>
          )}

          {/* 참가비 결제 */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-(--text-primary)">
                참가비
              </h3>
              <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                {entryFee === 0 ? "무료" : `${entryFee.toLocaleString()}원`}
              </span>
            </div>

            {entryFee > 0 && bankAccount && (
              <div className="bg-(--bg-input) rounded-lg p-3 space-y-2">
                <p className="text-sm text-(--text-muted)">
                  입금 계좌
                </p>
                <p className="font-medium text-(--text-primary)">
                  {bankAccount}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(bankAccount);
                    setAlertDialog({
                      isOpen: true,
                      title: "복사 완료",
                      message: "계좌번호가 복사되었습니다.",
                      type: "success",
                    });
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  계좌번호 복사
                </button>
              </div>
            )}

            {entryFee > 0 && (
              <p className="text-sm text-(--text-muted)">
                * 참가 신청 후 위 계좌로 참가비를 입금해주세요.
                <br />* 입금자명은 신청자 이름과 동일하게 해주세요.
              </p>
            )}

            {/* 환불 계좌 — 참가비 있는 경우 필수 입력 */}
            {entryFee > 0 && (
              <div className="space-y-3 pt-2 border-t border-blue-200 dark:border-blue-800">
                <p className="text-sm font-medium text-(--text-secondary)">
                  환불 계좌
                  <span className="ml-1 text-xs text-gray-400 font-normal">(취소 시 환불 계좌)</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="refund-bank" className={labelClass}>은행명</label>
                    <input
                      id="refund-bank"
                      type="text"
                      value={refundBank}
                      onChange={(e) => setRefundBank(e.target.value)}
                      placeholder="예: 국민은행"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="refund-holder" className={labelClass}>예금주</label>
                    <input
                      id="refund-holder"
                      type="text"
                      value={refundHolder}
                      onChange={(e) => setRefundHolder(e.target.value)}
                      placeholder="예: 홍길동"
                      className={inputClass}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="refund-account" className={labelClass}>계좌번호</label>
                  <input
                    id="refund-account"
                    type="text"
                    value={refundAccount}
                    onChange={(e) => setRefundAccount(e.target.value)}
                    placeholder="예: 123-456-789012"
                    className={inputClass}
                  />
                </div>
              </div>
            )}
          </div>

        </form>
      </Modal.Body>

      <Modal.Footer>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-(--text-secondary) rounded-xl font-medium transition-colors"
        >
          취소
        </button>
        <button
          type="submit"
          form="entry-form"
          disabled={isSubmitting}
          className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting
            ? editMode
              ? "수정 중..."
              : "신청 중..."
            : editMode
              ? "수정하기"
              : "참가 신청하기"}
        </button>
      </Modal.Footer>

      <AlertDialog
        isOpen={alertDialog.isOpen}
        onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
        title={alertDialog.title}
        message={alertDialog.message}
        type={alertDialog.type}
      />

      {/* 미등록 팀원 확인 다이얼로그 */}
      <ConfirmDialog
        isOpen={showNonMemberConfirm}
        onClose={() => { setShowNonMemberConfirm(false); setPendingFormData(null); }}
        onConfirm={async () => {
          setShowNonMemberConfirm(false);
          if (pendingFormData) await doSubmit(pendingFormData);
        }}
        title="클럽 미등록 팀원 포함"
        message={(() => {
          const allNames = [
            ...(applicantParticipates ? [playerName] : []),
            ...teamMembers.map((m) => m.name).filter(Boolean),
          ];
          const nonMembers = allNames.filter((name) => !isClubMember(name));
          return `${nonMembers.join(", ")} — 클럽 회원 명단에 없는 팀원이 포함되어 있습니다. 계속 신청하시겠습니까?`;
        })()}
        type="warning"
        confirmText="계속 신청"
        cancelText="다시 확인"
      />
    </Modal>
  );
}
