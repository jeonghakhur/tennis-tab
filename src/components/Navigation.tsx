'use client'

import Link from 'next/link'
import { ThemeToggle } from './ThemeToggle'
import { UserAvatar } from './UserAvatar'
import { useAuth } from './AuthProvider'
import { AvatarSkeleton } from './Skeleton'

export function Navigation() {
  const { user, profile, loading } = useAuth()

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 nav-container">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <span
            className="font-display text-2xl tracking-wider"
            style={{ color: 'var(--text-primary)' }}
          >
            TENNIS TAB
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <Link href="/#features" className="nav-link text-sm tracking-wide">
            기능
          </Link>
          <Link href="/tournaments" className="nav-link text-sm tracking-wide">
            대회
          </Link>
          <Link href="/#clubs" className="nav-link text-sm tracking-wide">
            클럽
          </Link>
          <Link href="/#community" className="nav-link text-sm tracking-wide">
            커뮤니티
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          {loading ? (
            <AvatarSkeleton size={40} />
          ) : user && profile ? (
            <UserAvatar />
          ) : (
            <>
              <Link
                href="/auth/login"
                className="nav-link text-sm transition-colors duration-300"
              >
                로그인
              </Link>
              <Link
                href="/auth/login"
                className="px-5 py-2 font-display tracking-wider text-sm transition-all duration-300 rounded-md hover:opacity-90"
                style={{
                  backgroundColor: 'var(--accent-color)',
                  color: 'var(--bg-primary)',
                }}
              >
                시작하기
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
