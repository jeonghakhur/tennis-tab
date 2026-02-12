"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/components/AuthProvider";
import { UserAvatar } from "@/components/UserAvatar";
import { ChatSection } from "@/components/chat/ChatSection";

export default function Home() {
  const { user, profile } = useAuth();

  return (
    <div
      className="h-dvh flex flex-col"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      {/* 헤더 */}
      <header
        className="shrink-0 flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "var(--border-color)" }}
      >
        <div className="flex items-center gap-3">
          <h1
            className="font-display text-xl tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Tennis Tab
          </h1>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              color: "var(--accent-color)",
            }}
          >
            AI
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/tournaments"
            className="text-sm px-3 py-1.5 rounded-lg transition-colors hover:opacity-80"
            style={{ color: "var(--text-secondary)" }}
          >
            대회 목록
          </Link>
          <ThemeToggle />
          {user ? (
            <UserAvatar user={user} profile={profile} />
          ) : (
            <Link
              href="/auth/login"
              className="text-sm px-3 py-1.5 rounded-lg"
              style={{
                backgroundColor: "var(--accent-color)",
                color: "var(--bg-primary)",
              }}
            >
              로그인
            </Link>
          )}
        </div>
      </header>

      {/* 채팅 영역 (남은 공간 전체) */}
      <ChatSection />
    </div>
  );
}
