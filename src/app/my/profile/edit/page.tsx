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
import type { StartYear } from "@/lib/supabase/types";

interface FormData {
  name: string;
  phone: string;
  start_year: StartYear | "";
  rating: string;
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
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || "",
        phone: profile.phone ? formatPhoneNumber(profile.phone) : "",
        start_year: profile.start_year || "",
        rating: profile.rating ? profile.rating.toString() : "",
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
        </div>
      </main>
    </>
  );
}
