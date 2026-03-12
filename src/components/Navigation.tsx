'use client'

import Link from 'next/link'
import { useState, useRef, useLayoutEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from './ThemeToggle'
import { FontSizeToggle } from './FontSizeToggle'
import { UserAvatar } from './UserAvatar'
import { useAuth } from './AuthProvider'
import { AvatarSkeleton } from './Skeleton'
import { NotificationBell } from './notifications/NotificationBell'

const NAV_LINKS = [
  { href: '/tournaments', label: '대회' },
  { href: '/clubs', label: '클럽' },
  { href: '/awards', label: '명예의 전당' },
  { href: '/community', label: '커뮤니티' },
]

export function Navigation() {
  const { user, profile, loading } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()
  // 링크 컨테이너 ref — indicator의 기준점
  const containerRef = useRef<HTMLDivElement>(null)
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([])
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null)

  const activeIndex = NAV_LINKS.findIndex(({ href }) => pathname?.startsWith(href))

  // getBoundingClientRect로 컨테이너 기준 상대 좌표 계산
  // el과 container가 같은 레이아웃 컨텍스트에 있으므로 스크롤바 생겨도 차이값은 불변
  // useLayoutEffect: 페인트 전 동기 측정 → 깜빡임 없음
  // Safari에서 position:fixed 내부 offsetParent가 null 반환하는 버그 우회
  const updateIndicator = useCallback(() => {
    if (activeIndex === -1) {
      setIndicator(null)
      return
    }
    const el = linkRefs.current[activeIndex]
    const container = containerRef.current
    if (el && container) {
      const elRect = el.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      setIndicator({
        left: elRect.left - containerRect.left,
        width: elRect.width,
      })
    }
  }, [activeIndex])

  useLayoutEffect(() => {
    updateIndicator()
    window.addEventListener('resize', updateIndicator)
    return () => window.removeEventListener('resize', updateIndicator)
  }, [updateIndicator])

  if (pathname?.startsWith('/admin')) return null

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

        {/* 데스크톱 메뉴 — containerRef 기준으로 indicator 위치 계산 */}
        <div ref={containerRef} className="hidden md:flex self-stretch items-stretch gap-8 relative">
          {NAV_LINKS.map(({ href, label }, i) => {
            const isActive = pathname?.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                ref={(el) => { linkRefs.current[i] = el }}
                className="nav-link-enhanced tracking-wide flex items-center px-1 my-[-16px] py-4"
                style={{
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 700 : 500,
                }}
              >
                {label}
              </Link>
            )
          })}

          {/* 슬라이딩 인디케이터 — 컨테이너 하단 기준 absolute */}
          {indicator && (
            <span
              className="nav-indicator"
              style={{ left: indicator.left, width: indicator.width }}
            />
          )}
        </div>

        <div className="flex items-center gap-4">
          <FontSizeToggle />
          <ThemeToggle />
          {user && <NotificationBell />}
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
          <div className="max-w-content mx-auto px-6 py-1.5 flex flex-col">
            {NAV_LINKS.map(({ href, label }) => {
              const isActive = pathname?.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className="relative tracking-wide py-1.5 text-sm pl-3 transition-all duration-200 flex items-center"
                  style={{
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: isActive ? 700 : 500,
                  }}
                  onClick={() => setMenuOpen(false)}
                >
                  {/* 텍스트 높이만큼의 좌측 인디케이터 */}
                  {isActive && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full"
                      style={{
                        width: '2px',
                        height: '1.2em',
                        backgroundColor: 'var(--accent-color)',
                      }}
                    />
                  )}
                  {label}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </nav>
  )
}
