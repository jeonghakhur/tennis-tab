"use client";

import { useAuth } from "./AuthProvider";
import Link from "next/link";
import { useState } from "react";

interface UserAvatarProps {
  size?: "sm" | "md" | "lg";
  showDropdown?: boolean;
}

export function UserAvatar({
  size = "md",
  showDropdown = true,
}: UserAvatarProps) {
  const { profile, loading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (loading) {
    return (
      <div
        className="rounded-full animate-pulse"
        style={{
          backgroundColor: "var(--bg-card)",
          width: size === "sm" ? "32px" : size === "md" ? "40px" : "56px",
          height: size === "sm" ? "32px" : size === "md" ? "40px" : "56px",
        }}
      />
    );
  }

  if (!profile) return null;

  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-14 h-14 text-lg",
  };

  // 이름에서 첫 글자 추출 (한글/영문 모두 지원)
  const getInitial = (name: string | null | undefined) => {
    if (!name) return "?";
    return name.charAt(0).toUpperCase();
  };

  const initial = getInitial(profile.name);

  return (
    <div className="relative">
      <button
        onClick={() => showDropdown && setIsOpen(!isOpen)}
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-display font-bold tracking-wider transition-all duration-300 hover:scale-105 cursor-pointer`}
        style={{
          backgroundColor: profile.avatar_url
            ? "transparent"
            : "var(--accent-color)",
          color: profile.avatar_url
            ? "var(--text-primary)"
            : "var(--bg-primary)",
          border: "2px solid var(--border-accent)",
          boxShadow: "0 2px 8px var(--shadow-glow)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.05)";
          e.currentTarget.style.boxShadow = "0 4px 16px var(--shadow-glow)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.boxShadow = "0 2px 8px var(--shadow-glow)";
        }}
      >
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.name}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          <span>{initial}</span>
        )}
      </button>

      {/* 드롭다운 메뉴 */}
      {showDropdown && isOpen && (
        <>
          {/* 배경 클릭 시 닫기 */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          <div
            className="absolute right-0 mt-2 w-64 rounded-xl overflow-hidden z-50 shadow-xl backdrop-blur-sm"
            style={{
              backgroundColor: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
            }}
          >
            {/* 사용자 정보 */}
            <div
              className="px-4 py-3 border-b"
              style={{ borderColor: "var(--border-color)" }}
            >
              <p
                className="font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                {profile.name}
              </p>
              <p
                className="text-sm mt-1"
                style={{ color: "var(--text-muted)" }}
              >
                {profile.email}
              </p>
              {profile.role && profile.role !== "USER" && (
                <span
                  className="inline-block mt-2 px-2 py-1 text-xs rounded-full font-display tracking-wider"
                  style={{
                    backgroundColor: "var(--accent-color)",
                    color: "var(--bg-primary)",
                  }}
                >
                  {profile.role === "SUPER_ADMIN"
                    ? "최고 관리자"
                    : profile.role === "ADMIN"
                      ? "관리자"
                      : profile.role === "MANAGER"
                        ? "운영자"
                        : "일반 회원"}
                </span>
              )}
            </div>

            {/* 메뉴 항목 */}
            <div className="py-2">
              <Link
                href="/my/profile"
                className="block px-4 py-2 text-sm transition-colors duration-200"
                style={{ color: "var(--text-secondary)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    "var(--bg-card-hover)";
                  e.currentTarget.style.color = "var(--text-primary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }}
                onClick={() => setIsOpen(false)}
              >
                <span className="mr-2">👤</span>
                마이페이지
              </Link>

              {(profile.role === "ADMIN" ||
                profile.role === "MANAGER" ||
                profile.role === "SUPER_ADMIN") && (
                <Link
                  href="/admin"
                  className="block px-4 py-2 text-sm transition-colors duration-200"
                  style={{ color: "var(--text-secondary)" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      "var(--bg-card-hover)";
                    e.currentTarget.style.color = "var(--text-primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "var(--text-secondary)";
                  }}
                  onClick={() => setIsOpen(false)}
                >
                  <span className="mr-2">⚙️</span>
                  관리자
                </Link>
              )}
            </div>

            {/* 로그아웃 */}
            <div
              className="border-t py-2"
              style={{ borderColor: "var(--border-color)" }}
            >
              <button
                onClick={async () => {
                  const { signOut } = await import("@/lib/auth/actions");
                  await signOut();
                }}
                className="w-full text-left px-4 py-2 text-sm transition-colors duration-200"
                style={{ color: "var(--text-secondary)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    "var(--bg-card-hover)";
                  e.currentTarget.style.color = "var(--text-primary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }}
              >
                <span className="mr-2">🚪</span>
                로그아웃
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
