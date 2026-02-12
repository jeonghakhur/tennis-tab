"use client";

import { useAuth } from "@/components/AuthProvider";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PhoneInput from "@/components/ui/PhoneInput";
import { formatPhoneNumber, unformatPhoneNumber } from "@/lib/utils/phone";
import { ClubSelector } from "@/components/clubs/ClubSelector";
import { AlertDialog } from "@/components/common/AlertDialog";
import { Modal } from "@/components/common/Modal";
import { createClient } from "@/lib/supabase/client";
import type { StartYear } from "@/lib/supabase/types";

interface FormData {
  name: string;
  phone: string;
  start_year: StartYear | "";
  rating: string;
  gender: "M" | "F" | "";
  birth_year: string;
}

// 입력값 보안 검증 (XSS 방지)
function sanitizeInput(value: string): string {
  // HTML 태그 제거
  const withoutTags = value.replace(/<[^>]*>/g, "");
  // 스크립트 패턴 제거
  const withoutScripts = withoutTags
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "");
  return withoutScripts.trim();
}

// 정수 입력값 검증
function validateIntegerInput(value: string): string {
  // 숫자만 허용 (소수점 제거)
  return value.replace(/[^0-9]/g, "");
}

export default function ProfileEditPage() {
  const { user, profile, loading, refresh } = useAuth();
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({
    name: "",
    phone: "",
    start_year: "",
    rating: "",
    gender: "",
    birth_year: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 회원 탈퇴 상태
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteEmailInput, setDeleteEmailInput] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteAlert, setDeleteAlert] = useState<{
    isOpen: boolean;
    message: string;
    type: "error" | "info";
  }>({ isOpen: false, message: "", type: "error" });

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || "",
        phone: profile.phone ? formatPhoneNumber(profile.phone) : "",
        start_year: profile.start_year || "",
        rating: profile.rating ? profile.rating.toString() : "",
        gender: (profile.gender as "M" | "F") || "",
        birth_year: profile.birth_year || "",
      });
    }
  }, [profile]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;

    if (name === "rating") {
      // 점수는 정수만 허용
      const integer = validateIntegerInput(value);
      setFormData((prev) => ({ ...prev, rating: integer }));
    } else {
      // 다른 필드는 보안 검증 적용
      const sanitized = sanitizeInput(value);
      setFormData((prev) => ({ ...prev, [name]: sanitized }));
    }

    setError(null);
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const { updateProfile } = await import("@/lib/auth/actions");
      // 전화번호는 숫자만 저장
      const phoneDigits = unformatPhoneNumber(formData.phone);
      // "none" 값은 undefined로 처리
      const startYear =
        formData.start_year && (formData.start_year as string) !== "none"
          ? formData.start_year
          : undefined;
      const rating = formData.rating
        ? parseInt(formData.rating, 10)
        : undefined;

      // 점수 범위 검증 (1 ~ 100)
      if (rating !== undefined && (rating < 1 || rating > 100)) {
        setError("실력 점수는 1부터 100 사이여야 합니다.");
        setIsSubmitting(false);
        return;
      }

      const result = await updateProfile({
        name: formData.name,
        phone: phoneDigits || undefined,
        start_year: startYear,
        rating: rating,
        gender: formData.gender || undefined,
        birth_year: formData.birth_year || undefined,
      });

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        await refresh();
        setTimeout(() => {
          router.push("/my/profile");
        }, 1000);
      }
    } catch (err) {
      setError("프로필 업데이트 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAccount = async () => {
    // 이메일 일치 검증
    if (deleteEmailInput.trim() !== profile?.email) {
      setDeleteAlert({
        isOpen: true,
        message: "입력한 이메일이 일치하지 않습니다.",
        type: "error",
      });
      return;
    }

    setDeleteLoading(true);
    try {
      const { deleteAccount } = await import("@/lib/auth/actions");
      const result = await deleteAccount();

      if (result.error) {
        setDeleteModalOpen(false);
        setDeleteEmailInput("");
        setDeleteAlert({ isOpen: true, message: result.error, type: "error" });
        return;
      }

      // 탈퇴 성공 → 클라이언트 세션 정리 (onAuthStateChange SIGNED_OUT 트리거)
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/");
    } catch {
      setDeleteModalOpen(false);
      setDeleteEmailInput("");
      setDeleteAlert({
        isOpen: true,
        message: "회원 탈퇴 처리 중 오류가 발생했습니다.",
        type: "error",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navigation />
        <main
          className="min-h-screen pt-20"
          style={{ backgroundColor: "var(--bg-primary)" }}
        >
          <div className="max-w-2xl mx-auto px-6 py-12">
            <div className="animate-pulse space-y-6">
              <div
                className="h-8 w-48"
                style={{ backgroundColor: "var(--bg-card)" }}
              />
              <div
                className="h-12 w-full rounded-lg"
                style={{ backgroundColor: "var(--bg-card)" }}
              />
              <div
                className="h-12 w-full rounded-lg"
                style={{ backgroundColor: "var(--bg-card)" }}
              />
              <div
                className="h-12 w-full rounded-lg"
                style={{ backgroundColor: "var(--bg-card)" }}
              />
            </div>
          </div>
        </main>
      </>
    );
  }

  if (!user || !profile) {
    return (
      <>
        <Navigation />
        <main
          className="min-h-screen pt-20 flex items-center justify-center"
          style={{ backgroundColor: "var(--bg-primary)" }}
        >
          <div className="text-center">
            <h1
              className="text-3xl font-display mb-4"
              style={{ color: "var(--text-primary)" }}
            >
              로그인이 필요합니다
            </h1>
            <p className="mb-8" style={{ color: "var(--text-muted)" }}>
              프로필을 수정하려면 먼저 로그인해주세요.
            </p>
            <Link
              href="/auth/login"
              className="inline-block px-8 py-3 font-display tracking-wider rounded-xl hover:opacity-90"
              style={{
                backgroundColor: "var(--accent-color)",
                color: "var(--bg-primary)",
              }}
            >
              로그인하기
            </Link>
          </div>
        </main>
      </>
    );
  }

  // 입문 년도 옵션 생성 (현재 년도부터 10년 전까지)
  const currentYear = new Date().getFullYear();
  const yearOptions = [
    ...Array.from({ length: 10 }, (_, i) => {
      const year = currentYear - i;
      return { value: year.toString(), label: `${year}년` };
    }),
    {
      value: `${currentYear - 10}년 이전`,
      label: `${currentYear - 10}년 이전 (10년 이상)`,
    },
  ];

  return (
    <>
      <Navigation />
      <main
        className="min-h-screen pt-20"
        style={{ backgroundColor: "var(--bg-primary)" }}
      >
        <div className="max-w-2xl mx-auto px-6 py-12">
          {/* 헤더 */}
          <div className="flex items-center gap-4 mb-8">
            <Link
              href="/my/profile"
              className="p-2 rounded-lg hover:opacity-80"
              style={{ backgroundColor: "var(--bg-card)" }}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                style={{ color: "var(--text-secondary)" }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Link>
            <h1
              className="text-2xl font-display"
              style={{ color: "var(--text-primary)" }}
            >
              프로필 수정
            </h1>
          </div>

          {/* 폼 */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 이름 */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--text-secondary)" }}
              >
                이름 *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 rounded-lg outline-none"
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-primary)",
                }}
                placeholder="이름을 입력하세요"
              />
            </div>

            {/* 연락처 */}
            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--text-secondary)" }}
              >
                연락처
              </label>
              <PhoneInput
                value={formData.phone}
                onChange={(value) => {
                  setFormData((prev) => ({ ...prev, phone: value }));
                  setError(null);
                  setSuccess(false);
                }}
              />
            </div>

            {/* 성별 */}
            <fieldset>
              <legend
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--text-secondary)" }}
              >
                성별
              </legend>
              <div className="flex gap-4">
                {[
                  { value: "M" as const, label: "남성" },
                  { value: "F" as const, label: "여성" },
                ].map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 px-4 py-3 rounded-lg cursor-pointer flex-1 justify-center"
                    style={{
                      backgroundColor:
                        formData.gender === option.value
                          ? "var(--accent-color)"
                          : "var(--bg-card)",
                      color:
                        formData.gender === option.value
                          ? "var(--bg-primary)"
                          : "var(--text-primary)",
                      border: "1px solid var(--border-color)",
                    }}
                  >
                    <input
                      type="radio"
                      name="gender"
                      value={option.value}
                      checked={formData.gender === option.value}
                      onChange={() => {
                        setFormData((prev) => ({
                          ...prev,
                          gender: prev.gender === option.value ? "" : option.value,
                        }));
                        setError(null);
                        setSuccess(false);
                      }}
                      className="sr-only"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* 출생연도 */}
            <div>
              <label
                htmlFor="birth_year"
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--text-secondary)" }}
              >
                출생연도
              </label>
              <input
                type="text"
                id="birth_year"
                name="birth_year"
                value={formData.birth_year}
                onChange={(e) => {
                  const digits = validateIntegerInput(e.target.value);
                  setFormData((prev) => ({ ...prev, birth_year: digits }));
                  setError(null);
                  setSuccess(false);
                }}
                inputMode="numeric"
                className="w-full px-4 py-3 rounded-lg outline-none"
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-primary)",
                }}
                placeholder="예: 1990"
                maxLength={4}
              />
            </div>

            {/* 입문 년도 */}
            <div>
              <label
                htmlFor="start_year"
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--text-secondary)" }}
              >
                테니스 입문 년도
              </label>
              <Select
                key={`start-year-${formData.start_year}`}
                value={
                  formData.start_year ? formData.start_year.toString() : "NONE"
                }
                onValueChange={(value) => {
                  setFormData((prev) => ({
                    ...prev,
                    start_year: value === "NONE" ? "" : (value as StartYear),
                  }));
                  setError(null);
                  setSuccess(false);
                }}
              >
                <SelectTrigger
                  className="w-full h-12 px-4"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-primary)",
                  }}
                >
                  <SelectValue placeholder="선택 안함" />
                </SelectTrigger>
                <SelectContent
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <SelectItem
                    key="none"
                    value="NONE"
                    style={{ color: "var(--text-muted)" }}
                  >
                    선택 안함
                  </SelectItem>
                  {yearOptions.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      style={{ color: "var(--text-primary)" }}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 실력 점수 */}
            <div>
              <label
                htmlFor="rating"
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--text-secondary)" }}
              >
                실력 점수 (1 ~ 100)
              </label>
              <input
                type="text"
                id="rating"
                name="rating"
                value={formData.rating}
                onChange={handleChange}
                inputMode="numeric"
                className="w-full px-4 py-3 rounded-lg outline-none"
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-primary)",
                }}
                placeholder="예: 50"
                maxLength={3}
              />
              <p
                className="text-xs mt-1"
                style={{ color: "var(--text-muted)" }}
              >
                실력을 1부터 100까지 숫자로 입력하세요
              </p>
            </div>

            {/* 소속 클럽 (ClubSelector — 클럽 검색/가입/탈퇴 통합) */}
            <ClubSelector onClubChange={() => refresh()} />

            {/* 에러 메시지 */}
            {error && (
              <div
                className="px-4 py-3 rounded-lg text-sm"
                style={{
                  backgroundColor: "rgba(239, 68, 68, 0.1)",
                  color: "#ef4444",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                }}
              >
                {error}
              </div>
            )}

            {/* 성공 메시지 */}
            {success && (
              <div
                className="px-4 py-3 rounded-lg text-sm"
                style={{
                  backgroundColor: "rgba(34, 197, 94, 0.1)",
                  color: "#22c55e",
                  border: "1px solid rgba(34, 197, 94, 0.3)",
                }}
              >
                프로필이 성공적으로 업데이트되었습니다. 잠시 후 이동합니다...
              </div>
            )}

            {/* 버튼 */}
            <div className="flex gap-4 pt-4">
              <Link
                href="/my/profile"
                className="flex-1 px-6 py-3 text-center rounded-lg font-display tracking-wider hover:opacity-80"
                style={{
                  backgroundColor: "var(--bg-card)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-color)",
                }}
              >
                취소
              </Link>
              <button
                type="submit"
                disabled={isSubmitting || !formData.name.trim()}
                className="flex-1 px-6 py-3 rounded-lg font-display tracking-wider hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: "var(--accent-color)",
                  color: "var(--bg-primary)",
                }}
              >
                {isSubmitting ? "저장 중..." : "저장"}
              </button>
            </div>
          </form>

          {/* 위험 구역: 회원 탈퇴 */}
          <div className="mt-12 pt-8" style={{ borderTop: "1px solid var(--border-color)" }}>
            <h2 className="text-lg font-semibold text-red-500 mb-2">
              위험 구역
            </h2>
            <p
              className="text-sm mb-4"
              style={{ color: "var(--text-muted)" }}
            >
              회원 탈퇴 시 모든 개인 정보가 삭제되며, 이 작업은 되돌릴 수
              없습니다. 주최한 대회, 생성한 협회 또는 클럽이 있는 경우 먼저
              삭제하거나 양도해야 합니다.
            </p>
            <button
              type="button"
              onClick={() => {
                setDeleteEmailInput("");
                setDeleteModalOpen(true);
              }}
              className="px-6 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors"
              style={{ border: "1px solid rgba(239, 68, 68, 0.5)" }}
            >
              회원 탈퇴
            </button>
          </div>

          {/* 탈퇴 확인 모달 — 이메일 입력 필수 */}
          <Modal
            isOpen={deleteModalOpen}
            onClose={() => {
              if (!deleteLoading) {
                setDeleteModalOpen(false);
                setDeleteEmailInput("");
              }
            }}
            title="회원 탈퇴"
            description="모든 개인 정보가 영구적으로 삭제되며, 이 작업은 되돌릴 수 없습니다."
            size="sm"
          >
            <Modal.Body>
              <div className="space-y-4">
                <p
                  className="text-sm"
                  style={{ color: "var(--text-secondary)" }}
                >
                  탈퇴를 확인하려면 아래에 이메일 주소를 입력하세요.
                </p>
                <div>
                  <label
                    htmlFor="delete-email"
                    className="block text-xs font-medium mb-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {profile?.email}
                  </label>
                  <input
                    id="delete-email"
                    type="email"
                    value={deleteEmailInput}
                    onChange={(e) => setDeleteEmailInput(e.target.value)}
                    placeholder="이메일 주소 입력"
                    autoComplete="off"
                    className="w-full px-4 py-3 rounded-lg outline-none text-sm"
                    style={{
                      backgroundColor: "var(--bg-primary)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <button
                type="button"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setDeleteEmailInput("");
                }}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium"
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  color: "var(--text-secondary)",
                }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={
                  deleteLoading ||
                  deleteEmailInput.trim() !== profile?.email
                }
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: "#ef4444" }}
              >
                {deleteLoading ? "처리 중..." : "탈퇴하기"}
              </button>
            </Modal.Footer>
          </Modal>

          {/* 탈퇴 에러 알림 */}
          <AlertDialog
            isOpen={deleteAlert.isOpen}
            onClose={() => setDeleteAlert({ ...deleteAlert, isOpen: false })}
            title="회원 탈퇴 불가"
            message={deleteAlert.message}
            type={deleteAlert.type}
          />
        </div>
      </main>
    </>
  );
}
