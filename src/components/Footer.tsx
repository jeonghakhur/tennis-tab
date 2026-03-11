"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Footer() {
  const pathname = usePathname();
  if (pathname === "/" || pathname?.startsWith('/admin')) return null;

  return (
    <footer className="border-t border-themed">
      <div className="max-w-content mx-auto px-6 py-6 md:py-10">

        {/* 모바일: 링크 2줄 + 카피라이트 / 데스크탑: 가로 레이아웃 */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

          {/* 브랜드 */}
          <Link href="/" className="hidden md:block">
            <span className="font-display text-base font-black tracking-tight"
              style={{ color: "var(--text-primary)" }}>
              TENNIS TAB
            </span>
          </Link>

          {/* 링크 */}
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm"
            style={{ color: "var(--text-muted)" }}>
            <Link href="/tournaments" className="hover:text-(--text-primary) transition-colors">대회</Link>
            <Link href="/clubs" className="hover:text-(--text-primary) transition-colors">클럽</Link>
            <Link href="/community" className="hover:text-(--text-primary) transition-colors">커뮤니티</Link>
            <Link href="/support" className="hover:text-(--text-primary) transition-colors">고객센터</Link>
            <Link href="/guide" className="hover:text-(--text-primary) transition-colors">이용 안내</Link>
            <Link href="/terms" className="hover:text-(--text-primary) transition-colors">이용약관</Link>
            <Link href="/privacy" className="hover:text-(--text-primary) transition-colors">개인정보처리방침</Link>
          </div>

          {/* 카피라이트 + SNS */}
          <div className="flex items-center justify-between md:justify-end gap-4">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              © 2026 Tennis Tab
            </p>
            <div className="flex gap-3">
              <a href="#" aria-label="Instagram"
                className="transition-colors hover:text-(--text-primary)"
                style={{ color: "var(--text-muted)" }}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
              <a href="#" aria-label="YouTube"
                className="transition-colors hover:text-(--text-primary)"
                style={{ color: "var(--text-muted)" }}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </a>
            </div>
          </div>

        </div>
      </div>
    </footer>
  );
}
