'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Trophy,
  Settings,
  ChevronLeft,
  Menu,
} from 'lucide-react'
import { useState } from 'react'
import type { UserRole } from '@/lib/supabase/types'
import { ROLE_LABELS } from '@/lib/auth/roles'

interface AdminSidebarProps {
  currentRole: UserRole
}

const menuItems = [
  {
    name: '대시보드',
    href: '/admin',
    icon: LayoutDashboard,
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] as UserRole[],
  },
  {
    name: '회원 관리',
    href: '/admin/users',
    icon: Users,
    roles: ['SUPER_ADMIN', 'ADMIN'] as UserRole[],
  },
  {
    name: '대회 관리',
    href: '/admin/tournaments',
    icon: Trophy,
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] as UserRole[],
  },
]

export function AdminSidebar({ currentRole }: AdminSidebarProps) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  const filteredMenuItems = menuItems.filter((item) =>
    item.roles.includes(currentRole)
  )

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)]"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-40 h-screen w-64
          bg-[var(--bg-secondary)] border-r border-[var(--border-color)]
          transform transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo & Close button */}
          <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)]">
            <Link href="/admin" className="flex items-center gap-2">
              <span className="font-display text-xl font-bold text-[var(--accent-color)]">
                Tennis Tab
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-[var(--accent-color)] text-[var(--bg-primary)] font-medium">
                Admin
              </span>
            </Link>
            <button
              onClick={() => setIsOpen(false)}
              className="lg:hidden p-1 rounded hover:bg-[var(--bg-card)]"
            >
              <ChevronLeft className="w-5 h-5 text-[var(--text-secondary)]" />
            </button>
          </div>

          {/* Role Badge */}
          <div className="px-6 py-3 border-b border-[var(--border-color)]">
            <span className="text-xs text-[var(--text-muted)]">권한</span>
            <p className="text-sm font-medium text-[var(--text-primary)]">
              {ROLE_LABELS[currentRole]}
            </p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {filteredMenuItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/admin' && pathname.startsWith(item.href))
              const Icon = item.icon

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg
                    transition-all duration-200
                    ${
                      isActive
                        ? 'bg-[var(--accent-color)] text-[var(--bg-primary)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              )
            })}
          </nav>

          {/* Back to main site */}
          <div className="p-4 border-t border-[var(--border-color)]">
            <Link
              href="/"
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)] transition-all duration-200"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="font-medium">메인 사이트로</span>
            </Link>
          </div>
        </div>
      </aside>
    </>
  )
}
