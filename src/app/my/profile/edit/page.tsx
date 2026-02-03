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

interface FormData {
  name: string;
  phone: string;
  skill_level: SkillLevel | "";
  ntrp_rating: string;
  club: string;
  club_city: string;
  club_district: string;
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

// 입력값 보안 검증 (XSS 방지)
function sanitizeInput(value: string): string {
  // HTML 태그 제거
  const withoutTags = value.replace(/<[^>]*>/g, '');
  // 스크립트 패턴 제거
  const withoutScripts = withoutTags.replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
  return withoutScripts.trim();
}

// 숫자 입력값 검증
function validateNumericInput(value: string): string {
  // 숫자와 소수점만 허용
  return value.replace(/[^0-9.]/g, '');
}

export default function ProfileEditPage() {
  const { user, profile, loading, refresh } = useAuth();
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({
    name: "",
    phone: "",
    skill_level: "",
    ntrp_rating: "",
    club: "",
    club_city: "",
    club_district: "",
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
        ntrp_rating: profile.ntrp_rating ? profile.ntrp_rating.toString() : "",
        club: profile.club || "",
        club_city: profile.club_city || "",
        club_district: profile.club_district || "",
      });
    }
  }, [profile]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    if (name === "phone") {
      // 전화번호는 숫자만 허용 후 자동 포맷팅
      const formatted = formatPhoneNumber(value);
      setFormData((prev) => ({ ...prev, phone: formatted }));
    } else if (name === "ntrp_rating") {
      // NTRP 점수는 숫자만 허용
      const numeric = validateNumericInput(value);
      setFormData((prev) => ({ ...prev, ntrp_rating: numeric }));
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
      const skillLevel =
        formData.skill_level && (formData.skill_level as string) !== "none"
          ? formData.skill_level
          : undefined;
      const ntrpRating = formData.ntrp_rating ? parseFloat(formData.ntrp_rating) : undefined;
      
      // NTRP 점수 범위 검증 (1.0 ~ 7.0)
      if (ntrpRating !== undefined && (ntrpRating < 1.0 || ntrpRating > 7.0)) {
        setError("NTRP 점수는 1.0부터 7.0 사이여야 합니다.");
        setIsSubmitting(false);
        return;
      }
      
      const result = await updateProfile({
        name: formData.name,
        phone: phoneDigits || undefined,
        skill_level: skillLevel,
        ntrp_rating: ntrpRating,
        club: formData.club || undefined,
        club_city: formData.club_city || undefined,
        club_district: formData.club_district || undefined,
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
    { value: "", label: "선택 안함" },
    ...Array.from({ length: 10 }, (_, i) => {
      const year = currentYear - i;
      return { value: year.toString(), label: `${year}년` };
    }),
    { value: `${currentYear - 10}년 이전`, label: `${currentYear - 10}년 이전 (10년 이상)` },
  ];

  // 한국 시도 데이터
  const cityOptions = [
    { value: "", label: "선택 안함" },
    { value: "서울특별시", label: "서울특별시" },
    { value: "부산광역시", label: "부산광역시" },
    { value: "대구광역시", label: "대구광역시" },
    { value: "인천광역시", label: "인천광역시" },
    { value: "광주광역시", label: "광주광역시" },
    { value: "대전광역시", label: "대전광역시" },
    { value: "울산광역시", label: "울산광역시" },
    { value: "세종특별자치시", label: "세종특별자치시" },
    { value: "경기도", label: "경기도" },
    { value: "강원도", label: "강원도" },
    { value: "충청북도", label: "충청북도" },
    { value: "충청남도", label: "충청남도" },
    { value: "전라북도", label: "전라북도" },
    { value: "전라남도", label: "전라남도" },
    { value: "경상북도", label: "경상북도" },
    { value: "경상남도", label: "경상남도" },
    { value: "제주특별자치도", label: "제주특별자치도" },
  ];

  // 시군구 데이터 (시도별)
  const districtOptions: Record<string, { value: string; label: string }[]> = {
    서울특별시: [
      { value: "", label: "선택 안함" },
      { value: "강남구", label: "강남구" },
      { value: "강동구", label: "강동구" },
      { value: "강북구", label: "강북구" },
      { value: "강서구", label: "강서구" },
      { value: "관악구", label: "관악구" },
      { value: "광진구", label: "광진구" },
      { value: "구로구", label: "구로구" },
      { value: "금천구", label: "금천구" },
      { value: "노원구", label: "노원구" },
      { value: "도봉구", label: "도봉구" },
      { value: "동대문구", label: "동대문구" },
      { value: "동작구", label: "동작구" },
      { value: "마포구", label: "마포구" },
      { value: "서대문구", label: "서대문구" },
      { value: "서초구", label: "서초구" },
      { value: "성동구", label: "성동구" },
      { value: "성북구", label: "성북구" },
      { value: "송파구", label: "송파구" },
      { value: "양천구", label: "양천구" },
      { value: "영등포구", label: "영등포구" },
      { value: "용산구", label: "용산구" },
      { value: "은평구", label: "은평구" },
      { value: "종로구", label: "종로구" },
      { value: "중구", label: "중구" },
      { value: "중랑구", label: "중랑구" },
    ],
    경기도: [
      { value: "", label: "선택 안함" },
      { value: "수원시", label: "수원시" },
      { value: "성남시", label: "성남시" },
      { value: "고양시", label: "고양시" },
      { value: "용인시", label: "용인시" },
      { value: "부천시", label: "부천시" },
      { value: "안산시", label: "안산시" },
      { value: "안양시", label: "안양시" },
      { value: "남양주시", label: "남양주시" },
      { value: "화성시", label: "화성시" },
      { value: "평택시", label: "평택시" },
      { value: "의정부시", label: "의정부시" },
      { value: "시흥시", label: "시흥시" },
      { value: "파주시", label: "파주시" },
      { value: "김포시", label: "김포시" },
      { value: "광명시", label: "광명시" },
      { value: "광주시", label: "광주시" },
      { value: "군포시", label: "군포시" },
      { value: "하남시", label: "하남시" },
      { value: "오산시", label: "오산시" },
      { value: "양주시", label: "양주시" },
      { value: "이천시", label: "이천시" },
      { value: "구리시", label: "구리시" },
      { value: "안성시", label: "안성시" },
      { value: "포천시", label: "포천시" },
      { value: "의왕시", label: "의왕시" },
      { value: "양평군", label: "양평군" },
      { value: "여주시", label: "여주시" },
      { value: "동두천시", label: "동두천시" },
      { value: "과천시", label: "과천시" },
      { value: "가평군", label: "가평군" },
      { value: "연천군", label: "연천군" },
    ],
  };

  // 선택된 시도에 따른 시군구 옵션
  const availableDistricts =
    districtOptions[formData.club_city] || [{ value: "", label: "시도를 먼저 선택하세요" }];

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
                inputMode="numeric"
                className="w-full px-4 py-3 rounded-lg outline-none"
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-primary)",
                }}
                placeholder="010-0000-0000"
              />
            </div>

            {/* 입문 년도 */}
            <div>
              <label
                htmlFor="skill_level"
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--text-secondary)" }}
              >
                테니스 입문 년도
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
                  {yearOptions.map((option) => (
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

            {/* NTRP 점수 */}
            <div>
              <label
                htmlFor="ntrp_rating"
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--text-secondary)" }}
              >
                NTRP 점수 (1.0 ~ 7.0)
              </label>
              <input
                type="text"
                id="ntrp_rating"
                name="ntrp_rating"
                value={formData.ntrp_rating}
                onChange={handleChange}
                inputMode="numeric"
                className="w-full px-4 py-3 rounded-lg outline-none"
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-primary)",
                }}
                placeholder="예: 3.5"
              />
              <p
                className="text-xs mt-1"
                style={{ color: "var(--text-muted)" }}
              >
                NTRP(National Tennis Rating Program) 점수를 입력하세요
              </p>
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

            {/* 클럽 지역 - 시도 */}
            <div>
              <label
                htmlFor="club_city"
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--text-secondary)" }}
              >
                클럽 지역 - 시도
              </label>
              <Select
                value={formData.club_city}
                onValueChange={(value) => {
                  setFormData((prev) => ({
                    ...prev,
                    club_city: value,
                    club_district: "", // 시도가 변경되면 시군구 초기화
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
                  {cityOptions.map((option) => (
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

            {/* 클럽 지역 - 시군구 */}
            <div>
              <label
                htmlFor="club_district"
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--text-secondary)" }}
              >
                클럽 지역 - 시군구
              </label>
              <Select
                value={formData.club_district}
                onValueChange={(value) => {
                  setFormData((prev) => ({
                    ...prev,
                    club_district: value,
                  }));
                  setError(null);
                  setSuccess(false);
                }}
                disabled={!formData.club_city}
              >
                <SelectTrigger
                  className="w-full h-12 px-4"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-primary)",
                    opacity: !formData.club_city ? 0.5 : 1,
                  }}
                >
                  <SelectValue placeholder="시도를 먼저 선택하세요" />
                </SelectTrigger>
                <SelectContent
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  {availableDistricts.map((option) => (
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
