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
  ExternalLink,
  Edit,
} from 'lucide-react'
import type { Database, TournamentStatus, EntryStatus, PaymentStatus } from '@/lib/supabase/types'

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
  { label: string; className: string; order: number }
> = {
  DRAFT: { label: '초안', className: 'bg-gray-500/20 text-gray-400', order: 1 },
  OPEN: { label: '모집중', className: 'bg-green-500/20 text-green-400', order: 2 },
  CLOSED: { label: '마감', className: 'bg-yellow-500/20 text-yellow-400', order: 3 },
  IN_PROGRESS: { label: '진행중', className: 'bg-blue-500/20 text-blue-400', order: 4 },
  COMPLETED: { label: '완료', className: 'bg-gray-500/20 text-gray-500', order: 5 },
  CANCELLED: { label: '취소', className: 'bg-red-500/20 text-red-400', order: 6 },
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="대회명, 장소, 주최자로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-color)] focus:outline-none transition-colors"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as TournamentStatus | 'ALL')
          }
          className="px-4 py-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:border-[var(--accent-color)] focus:outline-none transition-colors"
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
      <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
        <span>
          총 <strong className="text-[var(--text-primary)]">{tournaments.length}</strong>
          개 대회
        </span>
        {(searchQuery || statusFilter !== 'ALL') && (
          <span>
            검색 결과:{' '}
            <strong className="text-[var(--accent-color)]">
              {filteredAndSortedTournaments.length}
            </strong>
            개
          </span>
        )}
      </div>

      {/* Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-color)]">
                <th className="text-left p-4">
                  <button
                    onClick={() => handleSort('title')}
                    className="flex items-center gap-1 font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    대회 정보
                    <SortIcon field="title" />
                  </button>
                </th>
                <th className="text-left p-4">
                  <button
                    onClick={() => handleSort('status')}
                    className="flex items-center gap-1 font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    상태
                    <SortIcon field="status" />
                  </button>
                </th>
                <th className="text-left p-4 hidden lg:table-cell">
                  <button
                    onClick={() => handleSort('start_date')}
                    className="flex items-center gap-1 font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    일정
                    <SortIcon field="start_date" />
                  </button>
                </th>
                <th className="text-left p-4">
                  <button
                    onClick={() => handleSort('entries')}
                    className="flex items-center gap-1 font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    참가 현황
                    <SortIcon field="entries" />
                  </button>
                </th>
                <th className="text-left p-4 hidden sm:table-cell">
                  <span className="font-medium text-[var(--text-secondary)]">
                    관리
                  </span>
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
                      className="border-b border-[var(--border-color)] last:border-b-0 hover:bg-[var(--bg-card-hover)] transition-colors"
                    >
                      <td className="p-4">
                        <div className="space-y-1">
                          <p className="font-medium text-[var(--text-primary)]">
                            {tournament.title}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                            <MapPin className="w-3 h-3" />
                            {tournament.location}
                          </div>
                          {showOrganizer && tournament.profiles && (
                            <p className="text-xs text-[var(--text-muted)]">
                              주최: {tournament.profiles.name}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            statusConfig[tournament.status].className
                          }`}
                        >
                          {statusConfig[tournament.status].label}
                        </span>
                      </td>
                      <td className="p-4 hidden lg:table-cell">
                        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {new Date(tournament.start_date).toLocaleDateString('ko-KR')}
                          </span>
                        </div>
                        {tournament.start_date !== tournament.end_date && (
                          <p className="text-xs text-[var(--text-muted)] mt-0.5">
                            ~ {new Date(tournament.end_date).toLocaleDateString('ko-KR')}
                          </p>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-[var(--text-muted)]" />
                            <span className="text-sm font-medium text-[var(--text-primary)]">
                              {counts.total}
                              {counts.totalMaxTeams > 0 && (
                                <span className="text-[var(--text-muted)] font-normal">
                                  /{counts.totalMaxTeams}팀
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="flex gap-2 text-xs">
                            {counts.pending > 0 && (
                              <span className="text-yellow-400">
                                대기 {counts.pending}
                              </span>
                            )}
                            <span className="text-green-400">
                              승인 {counts.approved}
                            </span>
                            <span className="text-blue-400">
                              결제 {counts.paid}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 hidden sm:table-cell">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/tournaments/${tournament.id}/entries`}
                            className="p-2 rounded-lg hover:bg-[var(--bg-card)] text-[var(--accent-color)] transition-colors"
                            title="참가팀 관리"
                          >
                            <Users className="w-5 h-5" />
                          </Link>
                          <Link
                            href={`/admin/tournaments/${tournament.id}/bracket`}
                            className="p-2 rounded-lg hover:bg-[var(--bg-card)] text-amber-400 transition-colors"
                            title="대진표 관리"
                          >
                            <Trophy className="w-5 h-5" />
                          </Link>
                          <Link
                            href={`/tournaments/${tournament.id}/edit`}
                            className="p-2 rounded-lg hover:bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                            title="대회 수정"
                          >
                            <Edit className="w-5 h-5" />
                          </Link>
                          <Link
                            href={`/tournaments/${tournament.id}`}
                            className="p-2 rounded-lg hover:bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                            title="대회 상세"
                            target="_blank"
                          >
                            <ExternalLink className="w-5 h-5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center">
                    <div className="flex flex-col items-center gap-2 text-[var(--text-muted)]">
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
            href={`/admin/tournaments/${tournament.id}/entries`}
            className="block p-4 glass-card rounded-xl"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {tournament.title}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs ${
                  statusConfig[tournament.status].className
                }`}
              >
                {statusConfig[tournament.status].label}
              </span>
            </div>
            <p className="text-xs text-[var(--accent-color)] mt-1">
              참가팀 관리하기 →
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
