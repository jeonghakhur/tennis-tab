'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ThemeToggle } from './ThemeToggle'
import { FontSizeToggle } from './FontSizeToggle'
import { UserAvatar } from './UserAvatar'
import { useAuth } from './AuthProvider'
import { AvatarSkeleton } from './Skeleton'

const NAV_LINKS = [
  { href: '/tournaments', label: '대회' },
  { href: '/clubs', label: '클럽' },
  { href: '/awards', label: '명예의 전당' },
  { href: '/community', label: '커뮤니티' },
]

export function Navigation() {
  const { user, profile, loading } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 nav-container">
      <div className="max-w-content mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <span
            className="font-display text-lg md:text-2xl tracking-wider"
            style={{ color: 'var(--text-primary)' }}
          >
            TENNIS TAB
          </span>
        </Link>

        {/* 데스크톱 메뉴 */}
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map(({ href, label }) => (
            <Link key={href} href={href} className="nav-link text-sm tracking-wide">
              {label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <FontSizeToggle />
          <ThemeToggle />
          {loading ? (
            <AvatarSkeleton size={40} />
          ) : user && profile ? (
            <UserAvatar />
          ) : (
            <Link
              href="/auth/login"
              className="nav-link text-sm transition-colors duration-300"
            >
              로그인
            </Link>
          )}

          {/* 모바일 햄버거 버튼 */}
          <button
            type="button"
            aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((prev) => !prev)}
            className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-1.5"
          >
            <span
              className="block w-5 h-0.5 transition-all duration-200"
              style={{
                backgroundColor: 'var(--text-primary)',
                transform: menuOpen ? 'translateY(8px) rotate(45deg)' : undefined,
              }}
            />
            <span
              className="block w-5 h-0.5 transition-all duration-200"
              style={{
                backgroundColor: 'var(--text-primary)',
                opacity: menuOpen ? 0 : 1,
              }}
            />
            <span
              className="block w-5 h-0.5 transition-all duration-200"
              style={{
                backgroundColor: 'var(--text-primary)',
                transform: menuOpen ? 'translateY(-8px) rotate(-45deg)' : undefined,
              }}
            />
          </button>
        </div>
      </div>

      {/* 모바일 드롭다운 메뉴 */}
      {menuOpen && (
        <div className="md:hidden nav-container border-t" style={{ borderColor: 'var(--border-color)' }}>
          <div className="max-w-content mx-auto px-6 py-4 flex flex-col gap-4">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="nav-link text-sm tracking-wide py-1"
                onClick={() => setMenuOpen(false)}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}
