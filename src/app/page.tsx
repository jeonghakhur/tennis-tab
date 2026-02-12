"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/components/AuthProvider";
import { UserAvatar } from "@/components/UserAvatar";
import { Badge, type BadgeVariant } from "@/components/common/Badge";
import { ChatSection } from "@/components/chat/ChatSection";

function ScrollIndicator() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setIsVisible(scrollY < 100);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      className="absolute bottom-12 left-1/2 -translate-x-1/2 transition-all duration-500 ease-out"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: `translateX(-50%) translateY(${isVisible ? 0 : 20}px)`,
        pointerEvents: isVisible ? "auto" : "none",
      }}
    >
      <div
        className="w-7 h-11 rounded-full flex justify-center cursor-pointer hover:scale-110 transition-transform duration-300"
        style={{
          border: "2px solid var(--accent-color)",
          boxShadow: "0 0 15px var(--shadow-glow)",
        }}
        onClick={() => {
          document
            .getElementById("features")
            ?.scrollIntoView({ behavior: "smooth" });
        }}
      >
        <div
          className="w-1.5 h-3 rounded-full mt-2 animate-bounce"
          style={{ backgroundColor: "var(--accent-color)" }}
        />
      </div>
      <p
        className="text-xs mt-2 text-center tracking-wider"
        style={{ color: "var(--text-muted)" }}
      >
        SCROLL
      </p>
    </div>
  );
}

function CourtLines() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-[20%] left-0 w-full court-line" />
        <div className="absolute top-[40%] left-0 w-full court-line opacity-50" />
        <div className="absolute top-[60%] left-0 w-full court-line" />
        <div className="absolute top-[80%] left-0 w-full court-line opacity-50" />
      </div>
      <div
        className="absolute top-0 left-[10%] w-px h-full"
        style={{
          background:
            "linear-gradient(to bottom, transparent, var(--border-accent), transparent)",
        }}
      />
      <div
        className="absolute top-0 right-[10%] w-px h-full"
        style={{
          background:
            "linear-gradient(to bottom, transparent, var(--border-accent), transparent)",
        }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[40%] opacity-50"
        style={{ border: "1px solid var(--border-accent)" }}
      />
    </div>
  );
}



function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      <CourtLines />

      <div className="absolute inset-0 noise-bg pointer-events-none" />

      <div className="absolute top-0 right-0 w-[60%] h-[60%] gradient-overlay-top blur-3xl opacity-30" />
      <div className="absolute bottom-0 left-0 w-[40%] h-[40%] gradient-overlay-bottom blur-3xl opacity-20" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 text-center">
        <div className="opacity-0 animate-slide-up">
          <span
            className="inline-block px-4 py-2 text-sm tracking-widest mb-6"
            style={{
              border: "1px solid var(--border-accent)",
              color: "var(--accent-color)",
            }}
          >
            자연어 기반 테니스 대회 플랫폼
          </span>
        </div>

        <h1 className="font-display text-5xl md:text-7xl lg:text-8xl tracking-tight mb-4 opacity-0 animate-slide-up animate-delay-100">
          <span className="hero-text-white">대화로</span>
          <br />
          <span className="hero-text-accent">테니스를</span>
        </h1>

        <p
          className="text-lg md:text-xl max-w-2xl mx-auto mb-10 opacity-0 animate-slide-up animate-delay-200 leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          대회 검색부터 참가 신청, 결과 등록까지
          <br />
          자연스러운 대화로 모든 서비스를 이용하세요
        </p>

        <ChatSection />

        <ScrollIndicator />
      </div>
    </section>
  );
}

function StatCard({
  number,
  label,
  delay,
}: {
  number: string;
  label: string;
  delay: string;
}) {
  return (
    <div
      className="text-center opacity-0 animate-slide-up"
      style={{ animationDelay: delay }}
    >
      <div
        className="font-display text-5xl md:text-6xl mb-2"
        style={{ color: "var(--accent-color)" }}
      >
        {number}
      </div>
      <div
        className="text-sm tracking-wider uppercase"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </div>
    </div>
  );
}

function StatsSection() {
  return (
    <section className="relative py-24 border-themed border-y">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          <StatCard number="500+" label="등록된 대회" delay="0s" />
          <StatCard number="3,200+" label="활성 회원" delay="0.1s" />
          <StatCard number="150+" label="테니스 클럽" delay="0.2s" />
          <StatCard number="98%" label="만족도" delay="0.3s" />
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  index,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  index: number;
}) {
  return (
    <div
      className="glass-card p-8 group cursor-pointer"
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      <div
        className="w-14 h-14 flex items-center justify-center mb-6 transition-colors duration-300"
        style={{ backgroundColor: "var(--bg-card-hover)" }}
      >
        {icon}
      </div>
      <h3
        className="font-display text-2xl mb-3 tracking-wide transition-colors duration-300"
        style={{ color: "var(--text-primary)" }}
      >
        {title}
      </h3>
      <p style={{ color: "var(--text-muted)" }} className="leading-relaxed">
        {description}
      </p>
    </div>
  );
}

function FeaturesSection() {
  const features = [
    {
      icon: (
        <svg
          className="w-7 h-7 icon-accent"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      ),
      title: "자연어 인터페이스",
      description:
        "\"이번 주 서울 대회 뭐 있어?\" 처럼 자연스러운 대화로 원하는 정보를 찾고 서비스를 이용하세요.",
    },
    {
      icon: (
        <svg
          className="w-7 h-7 icon-accent"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      ),
      title: "대회 검색",
      description:
        "지역, 날짜, 형식 등 조건을 말하면 AI가 알아서 맞춤 대회를 찾아드립니다.",
    },
    {
      icon: (
        <svg
          className="w-7 h-7 icon-accent"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          />
        </svg>
      ),
      title: "간편 참가 신청",
      description:
        "\"서울 오픈 참가 신청할게\" 한마디로 대회 참가 신청이 완료됩니다.",
    },
    {
      icon: (
        <svg
          className="w-7 h-7 icon-accent"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
          />
        </svg>
      ),
      title: "대진표 & 결과",
      description:
        "대진표 조회, 경기 결과 확인, 내 경기 일정까지 대화로 물어보세요.",
    },
    {
      icon: (
        <svg
          className="w-7 h-7 icon-accent"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
      ),
      title: "결과 등록",
      description:
        "\"김철수한테 6-4, 6-2로 이겼어\" - 경기 결과도 대화로 간편하게 등록하세요.",
    },
    {
      icon: (
        <svg
          className="w-7 h-7 icon-accent"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
          />
        </svg>
      ),
      title: "대회 생성 (관리자)",
      description:
        "\"3월 15일 강남 오픈 대회 만들어줘\" - 관리자는 대화로 새 대회를 생성할 수 있습니다.",
    },
  ];

  return (
    <section id="features" className="relative py-32">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, transparent, var(--bg-card), transparent)",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <span
            className="inline-block px-4 py-2 text-sm tracking-widest mb-6"
            style={{
              border: "1px solid var(--border-accent)",
              color: "var(--accent-color)",
            }}
          >
            FEATURES
          </span>
          <h2
            className="font-display text-5xl md:text-6xl tracking-tight mb-6"
            style={{ color: "var(--text-primary)" }}
          >
            말로 하는 테니스
          </h2>
          <p
            className="text-lg max-w-2xl mx-auto"
            style={{ color: "var(--text-muted)" }}
          >
            복잡한 메뉴와 버튼 대신, 자연스러운 대화로 모든 것을 해결하세요
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} {...feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TournamentCard({
  title,
  date,
  location,
  participants,
  maxParticipants,
  status,
}: {
  title: string;
  date: string;
  location: string;
  participants: number;
  maxParticipants: number;
  status: "OPEN" | "CLOSED" | "IN_PROGRESS";
}) {
  const statusVariants: Record<string, BadgeVariant> = {
    OPEN: "success",
    CLOSED: "orange",
    IN_PROGRESS: "info",
  };

  const statusLabels = {
    OPEN: "모집 중",
    CLOSED: "마감",
    IN_PROGRESS: "진행 중",
  };

  return (
    <div className="glass-card p-6 group">
      <div className="flex items-start justify-between mb-4">
        <Badge variant={statusVariants[status]} className="font-display tracking-wider">
          {statusLabels[status]}
        </Badge>
        <span style={{ color: "var(--text-muted)" }} className="text-sm">
          {date}
        </span>
      </div>

      <h3
        className="font-display text-xl mb-2 transition-colors duration-300"
        style={{ color: "var(--text-primary)" }}
      >
        {title}
      </h3>

      <div
        className="flex items-center gap-2 text-sm mb-4"
        style={{ color: "var(--text-muted)" }}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        {location}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {[...Array(Math.min(3, participants))].map((_, i) => (
              <div
                key={i}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: "var(--bg-card-hover)",
                  border: "2px solid var(--bg-primary)",
                }}
              >
                <span
                  className="text-xs"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {String.fromCharCode(65 + i)}
                </span>
              </div>
            ))}
          </div>
          <span style={{ color: "var(--text-muted)" }} className="text-sm">
            {participants}/{maxParticipants}명
          </span>
        </div>

        <button
          className="text-sm font-display tracking-wider hover:underline"
          style={{ color: "var(--accent-color)" }}
        >
          상세보기
        </button>
      </div>
    </div>
  );
}

function TournamentsSection() {
  const tournaments = [
    {
      title: "2026 서울 오픈 테니스 챔피언십",
      date: "2026.03.15",
      location: "서울 올림픽공원 테니스장",
      participants: 28,
      maxParticipants: 32,
      status: "OPEN" as const,
    },
    {
      title: "강남 주말 더블스 리그",
      date: "2026.02.20",
      location: "강남구민체육센터",
      participants: 16,
      maxParticipants: 16,
      status: "CLOSED" as const,
    },
    {
      title: "부산 해운대 오픈",
      date: "2026.02.10",
      location: "해운대 스포츠센터",
      participants: 24,
      maxParticipants: 24,
      status: "IN_PROGRESS" as const,
    },
  ];

  return (
    <section id="tournaments" className="relative py-32">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
          <div>
            <span
              className="inline-block px-4 py-2 text-sm tracking-widest mb-6"
              style={{
                border: "1px solid var(--border-accent)",
                color: "var(--accent-color)",
              }}
            >
              TOURNAMENTS
            </span>
            <h2
              className="font-display text-5xl md:text-6xl tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              인기 대회
            </h2>
          </div>
          <Link
            href="/tournaments"
            className="font-display tracking-wider hover:underline mt-6 md:mt-0"
            style={{ color: "var(--accent-color)" }}
          >
            전체 대회 보기 →
          </Link>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tournaments.map((tournament) => (
            <TournamentCard key={tournament.title} {...tournament} />
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="relative py-32 overflow-hidden">
      <div className="absolute inset-0 gradient-overlay-top opacity-50" />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-3xl"
        style={{ backgroundColor: "var(--shadow-glow)", opacity: 0.1 }}
      />

      <div className="absolute inset-0 overflow-hidden">
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className="absolute h-px"
            style={{
              top: `${10 + i * 10}%`,
              left: "-10%",
              right: "-10%",
              transform: "rotate(-5deg)",
              background:
                "linear-gradient(to right, transparent, var(--border-accent), transparent)",
            }}
          />
        ))}
      </div>

      <div className="relative max-w-4xl mx-auto px-6 text-center">
        <h2
          className="font-display text-5xl md:text-7xl tracking-tight mb-6"
          style={{ color: "var(--text-primary)" }}
        >
          지금 바로
          <br />
          <span style={{ color: "var(--accent-color)" }}>시작하세요</span>
        </h2>

        <p
          className="text-lg max-w-xl mx-auto mb-10"
          style={{ color: "var(--text-muted)" }}
        >
          Tennis Tab과 함께 테니스 대회의 새로운 기준을 경험하세요.
          <br />
          무료로 가입하고 첫 대회를 만들어보세요.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/auth/register"
            className="btn-primary animate-pulse-glow"
          >
            <span className="relative z-10">무료 회원가입</span>
          </Link>
          <Link href="/tournaments" className="btn-secondary">
            대회 둘러보기
          </Link>
        </div>
      </div>
    </section>
  );
}



export default function Home() {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      <HeroSection />
      <StatsSection />
      <FeaturesSection />
      <TournamentsSection />
      <CTASection />
    </div>
  );
}
