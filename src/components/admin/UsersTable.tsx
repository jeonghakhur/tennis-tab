'use client'

import { useState, useMemo } from 'react'
import { Search, ChevronDown, ChevronUp, User } from 'lucide-react'
import type { Database } from '@/lib/supabase/types'
import type { UserRole } from '@/lib/supabase/types'
import { ROLE_LABELS, ROLE_COLORS, isSuperAdmin, isAdmin } from '@/lib/auth/roles'
import { changeUserRole } from '@/lib/auth/admin'

type Profile = Database['public']['Tables']['profiles']['Row']

interface UsersTableProps {
  users: Profile[]
  currentUserId: string
  currentUserRole: UserRole
}

type SortField = 'name' | 'email' | 'role' | 'created_at'
type SortOrder = 'asc' | 'desc'

const roles: UserRole[] = ['USER', 'MANAGER', 'ADMIN', 'SUPER_ADMIN']

export function UsersTable({
  users,
  currentUserId,
  currentUserRole,
}: UsersTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'ALL'>('ALL')
  const [changingRole, setChangingRole] = useState<string | null>(null)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (changingRole) return

    setChangingRole(userId)
    try {
      const result = await changeUserRole(userId, newRole)
      if (result.error) {
        alert(result.error)
      }
    } catch {
      alert('권한 변경 중 오류가 발생했습니다.')
    } finally {
      setChangingRole(null)
    }
  }

  const filteredAndSortedUsers = useMemo(() => {
    let filtered = users

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (user) =>
          user.name?.toLowerCase().includes(query) ||
          user.email?.toLowerCase().includes(query) ||
          user.phone?.includes(query) ||
          user.club?.toLowerCase().includes(query)
      )
    }

    // Role filter
    if (roleFilter !== 'ALL') {
      filtered = filtered.filter((user) => user.role === roleFilter)
    }

    // Sort
    return [...filtered].sort((a, b) => {
      let aVal: string | number = ''
      let bVal: string | number = ''

      switch (sortField) {
        case 'name':
          aVal = a.name ?? ''
          bVal = b.name ?? ''
          break
        case 'email':
          aVal = a.email ?? ''
          bVal = b.email ?? ''
          break
        case 'role':
          aVal = roles.indexOf(a.role ?? 'USER')
          bVal = roles.indexOf(b.role ?? 'USER')
          break
        case 'created_at':
          aVal = new Date(a.created_at).getTime()
          bVal = new Date(b.created_at).getTime()
          break
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }

      return sortOrder === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number)
    })
  }, [users, searchQuery, sortField, sortOrder, roleFilter])

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="이름, 이메일, 전화번호, 클럽명으로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-color)] focus:outline-none transition-colors"
          />
        </div>

        {/* Role Filter */}
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as UserRole | 'ALL')}
          className="px-4 py-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:border-[var(--accent-color)] focus:outline-none transition-colors"
        >
          <option value="ALL">모든 권한</option>
          {roles.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
        <span>
          총 <strong className="text-[var(--text-primary)]">{users.length}</strong>명
        </span>
        {searchQuery || roleFilter !== 'ALL' ? (
          <span>
            검색 결과:{' '}
            <strong className="text-[var(--accent-color)]">
              {filteredAndSortedUsers.length}
            </strong>
            명
          </span>
        ) : null}
      </div>

      {/* Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-color)]">
                <th className="text-left p-4">
                  <button
                    onClick={() => handleSort('name')}
                    className="flex items-center gap-1 font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    회원 정보
                    <SortIcon field="name" />
                  </button>
                </th>
                <th className="text-left p-4 hidden md:table-cell">
                  <button
                    onClick={() => handleSort('email')}
                    className="flex items-center gap-1 font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    이메일
                    <SortIcon field="email" />
                  </button>
                </th>
                <th className="text-left p-4 hidden lg:table-cell">
                  <span className="font-medium text-[var(--text-secondary)]">
                    클럽
                  </span>
                </th>
                <th className="text-left p-4">
                  <button
                    onClick={() => handleSort('role')}
                    className="flex items-center gap-1 font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    권한
                    <SortIcon field="role" />
                  </button>
                </th>
                <th className="text-left p-4 hidden sm:table-cell">
                  <button
                    onClick={() => handleSort('created_at')}
                    className="flex items-center gap-1 font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    가입일
                    <SortIcon field="created_at" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedUsers.length > 0 ? (
                filteredAndSortedUsers.map((user) => {
                  // 권한 변경 가능 여부 판단
                  const isCurrentUserSuperAdmin = isSuperAdmin(currentUserRole)
                  const isCurrentUserAdmin = isAdmin(currentUserRole)
                  const isTargetSuperAdmin = user.role === 'SUPER_ADMIN'
                  const isTargetAdmin = user.role === 'ADMIN'
                  const isSelf = user.id === currentUserId

                  // 권한 변경 가능 조건:
                  // - 자기 자신은 변경 불가
                  // - SUPER_ADMIN: 다른 SUPER_ADMIN 제외 모두 변경 가능
                  // - ADMIN: MANAGER, USER만 변경 가능
                  const canChangeThisUserRole =
                    !isSelf &&
                    (isCurrentUserSuperAdmin
                      ? !isTargetSuperAdmin
                      : isCurrentUserAdmin && !isTargetSuperAdmin && !isTargetAdmin)

                  // 선택 가능한 역할 (ADMIN은 MANAGER, USER만)
                  const availableRoles = isCurrentUserSuperAdmin
                    ? roles
                    : (['USER', 'MANAGER'] as UserRole[])

                  return (
                    <tr
                      key={user.id}
                      className="border-b border-[var(--border-color)] last:border-b-0 hover:bg-[var(--bg-card-hover)] transition-colors"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[var(--accent-color)]/20 flex items-center justify-center text-[var(--accent-color)] font-display font-bold shrink-0">
                            {user.avatar_url ? (
                              <img
                                src={user.avatar_url}
                                alt={user.name}
                                className="w-full h-full object-cover rounded-full"
                              />
                            ) : (
                              user.name?.charAt(0).toUpperCase() || '?'
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-[var(--text-primary)] truncate">
                              {user.name}
                            </p>
                            <p className="text-xs text-[var(--text-muted)] md:hidden truncate">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 hidden md:table-cell">
                        <p className="text-[var(--text-secondary)] truncate max-w-[200px]">
                          {user.email}
                        </p>
                        {user.phone && (
                          <p className="text-xs text-[var(--text-muted)]">
                            {user.phone}
                          </p>
                        )}
                      </td>
                      <td className="p-4 hidden lg:table-cell">
                        <p className="text-[var(--text-secondary)]">
                          {user.club || '-'}
                        </p>
                        {user.club_city && (
                          <p className="text-xs text-[var(--text-muted)]">
                            {user.club_city} {user.club_district}
                          </p>
                        )}
                      </td>
                      <td className="p-4">
                        {canChangeThisUserRole ? (
                          <select
                            value={user.role ?? 'USER'}
                            onChange={(e) =>
                              handleRoleChange(user.id, e.target.value as UserRole)
                            }
                            disabled={changingRole === user.id}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--bg-card)] border border-[var(--border-color)] focus:border-[var(--accent-color)] focus:outline-none transition-colors ${
                              changingRole === user.id ? 'opacity-50' : ''
                            } ${ROLE_COLORS[user.role ?? 'USER']}`}
                          >
                            {availableRoles.map((role) => (
                              <option key={role} value={role}>
                                {ROLE_LABELS[role]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                              ROLE_COLORS[user.role ?? 'USER']
                            }`}
                          >
                            {ROLE_LABELS[user.role ?? 'USER']}
                            {user.id === currentUserId && ' (나)'}
                          </span>
                        )}
                      </td>
                      <td className="p-4 hidden sm:table-cell">
                        <p className="text-[var(--text-secondary)] text-sm">
                          {new Date(user.created_at).toLocaleDateString('ko-KR')}
                        </p>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center">
                    <div className="flex flex-col items-center gap-2 text-[var(--text-muted)]">
                      <User className="w-12 h-12 opacity-50" />
                      <p>검색 결과가 없습니다.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
