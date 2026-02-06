'use client'

import { useTheme } from '@/components/ThemeProvider'
import { Sun, Moon, Bell } from 'lucide-react'
import type { UserRole } from '@/lib/supabase/types'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/auth/roles'

interface AdminHeaderProps {
  userName: string
  userEmail: string
  userAvatar: string | null
  userRole: UserRole
}

export function AdminHeader({
  userName,
  userEmail,
  userAvatar,
  userRole,
}: AdminHeaderProps) {
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="shrink-0 bg-(--bg-secondary) border-b border-(--border-color)">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Page Title - Hidden on mobile for space */}
        <div className="hidden lg:block">
          <h1 className="font-display text-lg font-semibold text-(--text-primary)">
            관리자 대시보드
          </h1>
        </div>

        {/* Mobile spacer for hamburger menu */}
        <div className="lg:hidden w-10" />

        {/* Right side actions */}
        <div className="flex items-center gap-4">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-(--bg-card) transition-colors"
            title={theme === 'dark' ? '라이트 모드' : '다크 모드'}
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 text-(--text-secondary)" />
            ) : (
              <Moon className="w-5 h-5 text-(--text-secondary)" />
            )}
          </button>

          {/* User Info */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-(--text-primary)">
                {userName}
              </p>
              <p className={`text-xs ${ROLE_COLORS[userRole]}`}>
                {ROLE_LABELS[userRole]}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full overflow-hidden bg-(--bg-card) border-2 border-(--border-accent)">
              {userAvatar ? (
                <img
                  src={userAvatar}
                  alt={userName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-(--accent-color) font-display font-bold">
                  {userName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
