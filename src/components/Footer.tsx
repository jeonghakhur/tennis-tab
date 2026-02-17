'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Footer() {
    const pathname = usePathname();

    // 홈(채팅 전체 화면)에서는 푸터 숨김
    if (pathname === '/') return null;

    return (
        <footer className="border-t border-themed py-16">
            <div className="max-w-7xl mx-auto px-6">
                <div className="grid md:grid-cols-4 gap-12 mb-12">
                    <div>
                        <Link href="/" className="flex items-center gap-3 mb-6">
                            <span
                                className="font-display text-xl font-black tracking-tight"
                                style={{ color: "var(--text-primary)" }}
                            >
                                TENNIS TAB
                            </span>
                        </Link>
                        <p
                            className="text-sm leading-relaxed"
                            style={{ color: "var(--text-muted)" }}
                        >
                            테니스 대회의 새로운 기준.
                            <br />
                            당신의 코트가 기다리고 있습니다.
                        </p>
                    </div>

                    <div>
                        <h4
                            className="font-display text-lg mb-4 tracking-wider"
                            style={{ color: "var(--text-primary)" }}
                        >
                            서비스
                        </h4>
                        <ul className="space-y-3">
                            <li>
                                <Link href="/tournaments" className="footer-link text-sm">
                                    대회
                                </Link>
                            </li>
                            <li>
                                <Link href="/clubs" className="footer-link text-sm">
                                    클럽
                                </Link>
                            </li>
                            <li>
                                <Link href="/community" className="footer-link text-sm">
                                    커뮤니티
                                </Link>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h4
                            className="font-display text-lg mb-4 tracking-wider"
                            style={{ color: "var(--text-primary)" }}
                        >
                            지원
                        </h4>
                        <ul className="space-y-3">
                            <li>
                                <Link href="/support" className="footer-link text-sm">
                                    고객센터
                                </Link>
                            </li>
                            <li>
                                <Link href="/faq" className="footer-link text-sm">
                                    자주 묻는 질문
                                </Link>
                            </li>
                            <li>
                                <Link href="/support/inquiry" className="footer-link text-sm">
                                    문의하기
                                </Link>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h4
                            className="font-display text-lg mb-4 tracking-wider"
                            style={{ color: "var(--text-primary)" }}
                        >
                            법적 고지
                        </h4>
                        <ul className="space-y-3">
                            <li>
                                <Link href="/terms" className="footer-link text-sm">
                                    이용약관
                                </Link>
                            </li>
                            <li>
                                <Link href="/privacy" className="footer-link text-sm">
                                    개인정보처리방침
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="pt-8 border-t border-themed flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                        © 2026 Tennis Tab. All rights reserved.
                    </p>
                    <div className="flex gap-6">
                        <a
                            href="#"
                            className="footer-link transition-colors"
                            aria-label="Instagram"
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                            </svg>
                        </a>
                        <a
                            href="#"
                            className="footer-link transition-colors"
                            aria-label="YouTube"
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                            </svg>
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
