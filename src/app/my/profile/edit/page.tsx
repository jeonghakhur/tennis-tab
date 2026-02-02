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
import type { SkillLevel } from "@/lib/supabase/types";

type DominantHand = "LEFT" | "RIGHT" | "BOTH";

interface FormData {
  name: string;
  phone: string;
  skill_level: SkillLevel | "";
  dominant_hand: DominantHand | "";
  club: string;
}

// 전화번호 포맷팅 (010-1234-5678)
function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 3) {
    return digits;
  } else if (digits.length <= 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  } else {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  }
}

// 전화번호에서 숫자만 추출
function unformatPhoneNumber(value: string): string {
  return value.replace(/\D/g, "");
}

export default function ProfileEditPage() {
  const { user, profile, loading, refresh } = useAuth();
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({
    name: "",
    phone: "",
    skill_level: "",
    dominant_hand: "",
    club: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || "",
        phone: profile.phone ? formatPhoneNumber(profile.phone) : "",
        skill_level: profile.skill_level || "",
        dominant_hand: profile.dominant_hand || "",
        club: profile.club || "",
      });
    }
  }, [profile]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    if (name === "phone") {
      // 전화번호는 자동 포맷팅
      const formatted = formatPhoneNumber(value);
      setFormData((prev) => ({ ...prev, phone: formatted }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
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
      const skillLevel =
        formData.skill_level && (formData.skill_level as string) !== "none"
          ? formData.skill_level
          : undefined;
      const dominantHand =
        formData.dominant_hand && (formData.dominant_hand as string) !== "none"
          ? formData.dominant_hand
          : undefined;
      const result = await updateProfile({
        name: formData.name,
        phone: phoneDigits || undefined,
        skill_level: skillLevel,
        dominant_hand: dominantHand,
        club: formData.club || undefined,
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

  const skillLevelOptions = [
    { value: "", label: "선택 안함" },
    { value: "1_YEAR", label: "1년" },
    { value: "2_YEARS", label: "2년" },
    { value: "3_YEARS", label: "3년" },
    { value: "4_YEARS", label: "4년" },
    { value: "5_YEARS", label: "5년" },
    { value: "6_YEARS", label: "6년" },
    { value: "7_YEARS", label: "7년" },
    { value: "8_YEARS", label: "8년" },
    { value: "9_YEARS", label: "9년" },
    { value: "10_PLUS_YEARS", label: "10년 이상" },
  ];

  const dominantHandOptions = [
    { value: "", label: "선택 안함" },
    { value: "RIGHT", label: "오른손" },
    { value: "LEFT", label: "왼손" },
    { value: "BOTH", label: "양손" },
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
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg outline-none"
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-primary)",
                }}
                placeholder="010-0000-0000"
              />
            </div>

            {/* 실력 수준 */}
            <div>
              <label
                htmlFor="skill_level"
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--text-secondary)" }}
              >
                구력 (테니스 경력)
              </label>
              <Select
                value={formData.skill_level}
                onValueChange={(value) => {
                  setFormData((prev) => ({
                    ...prev,
                    skill_level: value as SkillLevel | "",
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
                  {skillLevelOptions.map((option) => (
                    <SelectItem
                      key={option.value || "empty"}
                      value={option.value || "none"}
                      style={{ color: "var(--text-primary)" }}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 주 사용 손 */}
            <div>
              <label
                htmlFor="dominant_hand"
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--text-secondary)" }}
              >
                주 사용 손
              </label>
              <Select
                value={formData.dominant_hand}
                onValueChange={(value) => {
                  setFormData((prev) => ({
                    ...prev,
                    dominant_hand: value as DominantHand | "",
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
                  {dominantHandOptions.map((option) => (
                    <SelectItem
                      key={option.value || "empty"}
                      value={option.value || "none"}
                      style={{ color: "var(--text-primary)" }}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 소속 클럽 */}
            <div>
              <label
                htmlFor="club"
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--text-secondary)" }}
              >
                소속 클럽
              </label>
              <input
                type="text"
                id="club"
                name="club"
                value={formData.club}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg outline-none"
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-primary)",
                }}
                placeholder="소속 클럽명을 입력하세요"
              />
            </div>

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
