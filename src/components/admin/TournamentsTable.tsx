'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Search,
  ChevronDown,
  ChevronUp,
  Trophy,
  Users,
  Calendar,
  MapPin,
} from 'lucide-react'
import type { Database, TournamentStatus, EntryStatus, PaymentStatus } from '@/lib/supabase/types'
import { Badge, type BadgeVariant } from '@/components/common/Badge'

type Tournament = Database['public']['Tables']['tournaments']['Row'] & {
  profiles: { name: string; email: string } | null
  tournament_entries: { id: string; status: EntryStatus; payment_status: PaymentStatus; division_id: string }[]
  tournament_divisions: { id: string; name: string; max_teams: number | null }[]
}

interface TournamentsTableProps {
  tournaments: Tournament[]
  showOrganizer?: boolean
}

type SortField = 'title' | 'status' | 'start_date' | 'created_at' | 'entries'
type SortOrder = 'asc' | 'desc'

const statusConfig: Record<
  TournamentStatus,
  { label: string; variant: BadgeVariant; order: number }
> = {
  DRAFT: {
    label: '초안',
    variant: 'secondary',
    order: 1
  },
  OPEN: {
    label: '모집중',
    variant: 'success',
    order: 2
  },
  CLOSED: {
    label: '마감',
    variant: 'orange',
    order: 3
  },
  IN_PROGRESS: {
    label: '진행중',
    variant: 'info',
    order: 4
  },
  COMPLETED: {
    label: '완료',
    variant: 'secondary',
    order: 5
  },
  CANCELLED: {
    label: '취소',
    variant: 'danger',
    order: 6
  },
}

export function TournamentsTable({
  tournaments,
  showOrganizer = false,
}: TournamentsTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [statusFilter, setStatusFilter] = useState<TournamentStatus | 'ALL'>('ALL')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const filteredAndSortedTournaments = useMemo(() => {
    let filtered = tournaments

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          t.location?.toLowerCase().includes(query) ||
          t.profiles?.name?.toLowerCase().includes(query)
      )
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter((t) => t.status === statusFilter)
    }

    // Sort
    return [...filtered].sort((a, b) => {
      let aVal: string | number = ''
      let bVal: string | number = ''

      switch (sortField) {
        case 'title':
          aVal = a.title
          bVal = b.title
          break
        case 'status':
          aVal = statusConfig[a.status].order
          bVal = statusConfig[b.status].order
          break
        case 'start_date':
          aVal = new Date(a.start_date).getTime()
          bVal = new Date(b.start_date).getTime()
          break
        case 'created_at':
          aVal = new Date(a.created_at).getTime()
          bVal = new Date(b.created_at).getTime()
          break
        case 'entries':
          aVal = a.tournament_entries?.length ?? 0
          bVal = b.tournament_entries?.length ?? 0
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
  }, [tournaments, searchQuery, sortField, sortOrder, statusFilter])

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    )
  }

  const getEntryCounts = (
    entries: Tournament['tournament_entries'],
    divisions: Tournament['tournament_divisions']
  ) => {
    const total = entries?.length ?? 0
    const pending = entries?.filter((e) => e.status === 'PENDING').length ?? 0
    const approved = entries?.filter((e) => ['APPROVED', 'CONFIRMED'].includes(e.status)).length ?? 0
    const paid = entries?.filter((e) => e.payment_status === 'COMPLETED').length ?? 0

    // 부서별 모집팀 총합
    const totalMaxTeams = divisions?.reduce((sum, d) => sum + (d.max_teams ?? 0), 0) ?? 0

    return { total, pending, approved, paid, totalMaxTeams }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="대회명, 장소, 주최자로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none transition-colors"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as TournamentStatus | 'ALL')
          }
          className="px-4 py-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none transition-colors"
        >
          <option value="ALL">모든 상태</option>
          {Object.entries(statusConfig).map(([key, { label }]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
        <span>
          총 <strong className="text-gray-900 dark:text-gray-100">{tournaments.length}</strong>
          개 대회
        </span>
        {(searchQuery || statusFilter !== 'ALL') && (
          <span>
            검색 결과:{' '}
            <strong className="text-emerald-600 dark:text-emerald-400">
              {filteredAndSortedTournaments.length}
            </strong>
            개
          </span>
        )}
      </div>

      {/* Table */}
      <div className="glass-card rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left p-4">
                  <button
                    onClick={() => handleSort('title')}
                    className="flex items-center gap-1 font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                  >
                    대회 정보
                    <SortIcon field="title" />
                  </button>
                </th>
                <th className="text-left p-4">
                  <button
                    onClick={() => handleSort('status')}
                    className="flex items-center gap-1 font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                  >
                    상태
                    <SortIcon field="status" />
                  </button>
                </th>
                <th className="text-left p-4 hidden lg:table-cell">
                  <button
                    onClick={() => handleSort('start_date')}
                    className="flex items-center gap-1 font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                  >
                    일정
                    <SortIcon field="start_date" />
                  </button>
                </th>
                <th className="text-left p-4">
                  <button
                    onClick={() => handleSort('entries')}
                    className="flex items-center gap-1 font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                  >
                    참가 현황
                    <SortIcon field="entries" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedTournaments.length > 0 ? (
                filteredAndSortedTournaments.map((tournament) => {
                  const counts = getEntryCounts(tournament.tournament_entries, tournament.tournament_divisions)

                  return (
                    <tr
                      key={tournament.id}
                      className="border-b border-gray-200 dark:border-gray-800 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="p-4 relative cursor-pointer">
                        <Link
                          href={`/admin/tournaments/${tournament.id}/entries`}
                          className="absolute inset-0 z-10"
                          aria-label={`${tournament.title} 참가팀 관리`}
                        />
                        <div className="space-y-1.5 relative z-0">
                          <p className="font-medium text-(--text-primary)">
                            {tournament.title}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <MapPin className="w-3.5 h-3.5" />
                            {tournament.location}
                          </div>
                          {showOrganizer && tournament.profiles && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              주최: {tournament.profiles.name}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge variant={statusConfig[tournament.status].variant}>
                          {statusConfig[tournament.status].label}
                        </Badge>
                      </td>
                      <td className="p-4 hidden lg:table-cell">
                        <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {new Date(tournament.start_date).toLocaleDateString('ko-KR')}
                            {tournament.start_date !== tournament.end_date && (
                              <> ~ {new Date(tournament.end_date).toLocaleDateString('ko-KR')}</>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                            <span className="text-sm font-medium text-(--text-primary)">
                              {counts.total}
                              {counts.totalMaxTeams > 0 && (
                                <span className="text-gray-500 dark:text-gray-400 font-normal">
                                  /{counts.totalMaxTeams}팀
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="flex gap-3 text-sm font-medium">
                            {counts.pending > 0 && (
                              <span className="text-orange-600 dark:text-orange-400">
                                대기 {counts.pending}
                              </span>
                            )}
                            <span className="text-emerald-600 dark:text-emerald-400">
                              승인 {counts.approved}
                            </span>
                            <span className="text-blue-600 dark:text-blue-400">
                              결제 {counts.paid}
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={4} className="p-8 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-500 dark:text-gray-400">
                      <Trophy className="w-12 h-12 opacity-50" />
                      <p>검색 결과가 없습니다.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Actions */}
      <div className="sm:hidden space-y-2">
        {filteredAndSortedTournaments.map((tournament) => (
          <Link
            key={tournament.id}
            href={`/tournaments/${tournament.id}`}
            className="block p-4 glass-card rounded-xl border border-gray-200 dark:border-gray-800 hover:border-emerald-500 dark:hover:border-emerald-400 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {tournament.title}
              </span>
              <Badge variant={statusConfig[tournament.status].variant}>
                {statusConfig[tournament.status].label}
              </Badge>
            </div>
            <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">
              상세보기 →
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
