'use client'

import { useState, useMemo } from 'react'
import {
  Search,
  ChevronDown,
  ChevronUp,
  Users,
  Phone,
  Trash2,
} from 'lucide-react'
import type {
  Database,
  EntryStatus,
  PaymentStatus,
  PartnerData,
  TeamMember,
} from '@/lib/supabase/types'
import {
  updateEntryStatus,
  updatePaymentStatus,
  deleteEntry,
} from '@/lib/admin/entries'

type Entry = Database['public']['Tables']['tournament_entries']['Row'] & {
  profiles: {
    name: string
    email: string
    phone: string | null
    avatar_url: string | null
    club: string | null
  } | null
  tournament_divisions: { name: string } | null
}

type Division = {
  id: string
  name: string
  max_teams: number | null
}

interface EntriesManagerProps {
  tournamentId: string
  entries: Entry[]
  divisions: Division[]
  maxParticipants: number
}

type SortField = 'created_at' | 'player_name' | 'status' | 'payment_status' | 'division'
type SortOrder = 'asc' | 'desc'

// 프론트 페이지와 동일한 상태 값만 사용
const entryStatusConfig: Record<
  'PENDING' | 'APPROVED' | 'REJECTED',
  { label: string; className: string; order: number }
> = {
  PENDING: {
    label: '승인 대기',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
    order: 1,
  },
  APPROVED: {
    label: '승인됨',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
    order: 2,
  },
  REJECTED: {
    label: '거절됨',
    className: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
    order: 3,
  },
}

// 결제 상태는 결제/미결제만
const paymentStatusConfig: Record<
  'PENDING' | 'COMPLETED',
  { label: string; className: string }
> = {
  PENDING: {
    label: '미결제',
    className: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
  },
  COMPLETED: {
    label: '결제완료',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
  },
}

// 상태 값 정규화 (기존 다른 상태들을 주요 상태로 매핑)
function normalizeStatus(status: EntryStatus): 'PENDING' | 'APPROVED' | 'REJECTED' {
  if (status === 'CONFIRMED' || status === 'WAITLISTED') return 'APPROVED'
  if (status === 'CANCELLED') return 'REJECTED'
  return status as 'PENDING' | 'APPROVED' | 'REJECTED'
}

function normalizePaymentStatus(status: PaymentStatus): 'PENDING' | 'COMPLETED' {
  return status === 'COMPLETED' ? 'COMPLETED' : 'PENDING'
}

export function EntriesManager({
  tournamentId,
  entries,
  divisions,
  maxParticipants,
}: EntriesManagerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('ALL')
  const [paymentFilter, setPaymentFilter] = useState<'PENDING' | 'COMPLETED' | 'ALL'>('ALL')
  const [divisionFilter, setDivisionFilter] = useState<string>('ALL')
  const [selectedEntries, setSelectedEntries] = useState<string[]>([])
  const [processing, setProcessing] = useState<string | null>(null)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const handleStatusChange = async (entryId: string, status: EntryStatus) => {
    if (processing) return
    setProcessing(entryId)
    try {
      const result = await updateEntryStatus(entryId, status)
      if (result.error) {
        alert(result.error)
      }
    } catch {
      alert('상태 변경 중 오류가 발생했습니다.')
    } finally {
      setProcessing(null)
    }
  }

  const handlePaymentChange = async (entryId: string, status: PaymentStatus) => {
    if (processing) return
    setProcessing(entryId)
    try {
      const result = await updatePaymentStatus(entryId, status)
      if (result.error) {
        alert(result.error)
      }
    } catch {
      alert('결제 상태 변경 중 오류가 발생했습니다.')
    } finally {
      setProcessing(null)
    }
  }

  const handleDelete = async (entryId: string) => {
    if (processing) return
    if (!confirm('정말로 이 참가 신청을 삭제하시겠습니까?')) return

    setProcessing(entryId)
    try {
      const result = await deleteEntry(entryId)
      if (result.error) {
        alert(result.error)
      }
    } catch {
      alert('삭제 중 오류가 발생했습니다.')
    } finally {
      setProcessing(null)
    }
  }

  const toggleSelectAll = () => {
    if (selectedEntries.length === filteredAndSortedEntries.length) {
      setSelectedEntries([])
    } else {
      setSelectedEntries(filteredAndSortedEntries.map((e) => e.id))
    }
  }

  const toggleSelect = (entryId: string) => {
    setSelectedEntries((prev) =>
      prev.includes(entryId)
        ? prev.filter((id) => id !== entryId)
        : [...prev, entryId]
    )
  }

  const filteredAndSortedEntries = useMemo(() => {
    let filtered = entries

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (e) =>
          e.player_name?.toLowerCase().includes(query) ||
          e.profiles?.name?.toLowerCase().includes(query) ||
          e.profiles?.email?.toLowerCase().includes(query) ||
          e.phone?.includes(query) ||
          e.club_name?.toLowerCase().includes(query)
      )
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter((e) => normalizeStatus(e.status) === statusFilter)
    }

    // Payment filter
    if (paymentFilter !== 'ALL') {
      filtered = filtered.filter((e) => normalizePaymentStatus(e.payment_status) === paymentFilter)
    }

    // Division filter
    if (divisionFilter !== 'ALL') {
      filtered = filtered.filter((e) => e.division_id === divisionFilter)
    }

    // Sort
    return [...filtered].sort((a, b) => {
      let aVal: string | number = ''
      let bVal: string | number = ''

      switch (sortField) {
        case 'player_name':
          aVal = a.player_name ?? ''
          bVal = b.player_name ?? ''
          break
        case 'status':
          aVal = entryStatusConfig[normalizeStatus(a.status)].order
          bVal = entryStatusConfig[normalizeStatus(b.status)].order
          break
        case 'payment_status':
          aVal = a.payment_status === 'COMPLETED' ? 1 : 0
          bVal = b.payment_status === 'COMPLETED' ? 1 : 0
          break
        case 'division':
          aVal = a.tournament_divisions?.name ?? ''
          bVal = b.tournament_divisions?.name ?? ''
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
  }, [entries, searchQuery, sortField, sortOrder, statusFilter, paymentFilter, divisionFilter])

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    )
  }

  // Stats
  const stats = {
    total: entries.length,
    pending: entries.filter((e) => normalizeStatus(e.status) === 'PENDING').length,
    approved: entries.filter((e) => normalizeStatus(e.status) === 'APPROVED').length,
    paid: entries.filter((e) => e.payment_status === 'COMPLETED').length,
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card rounded-xl p-5 text-center">
          <p className="text-3xl font-display font-bold text-[var(--text-primary)]">
            {stats.total}
          </p>
          <p className="text-sm text-[var(--text-secondary)] mt-1">전체 신청</p>
        </div>
        <div className="glass-card rounded-xl p-5 text-center">
          <p className="text-3xl font-display font-bold text-amber-500">
            {stats.pending}
          </p>
          <p className="text-sm text-[var(--text-secondary)] mt-1">승인 대기</p>
        </div>
        <div className="glass-card rounded-xl p-5 text-center">
          <p className="text-3xl font-display font-bold text-emerald-500">
            {stats.approved}
          </p>
          <p className="text-sm text-[var(--text-secondary)] mt-1">승인 완료</p>
        </div>
        <div className="glass-card rounded-xl p-5 text-center">
          <p className="text-3xl font-display font-bold text-sky-500">
            {stats.paid}
          </p>
          <p className="text-sm text-[var(--text-secondary)] mt-1">결제 완료</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="이름, 이메일, 전화번호, 클럽명으로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] text-base placeholder:text-[var(--text-muted)] focus:border-[var(--accent-color)] focus:outline-none transition-colors"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL')}
            className="px-4 py-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] text-base focus:border-[var(--accent-color)] focus:outline-none transition-colors"
          >
            <option value="ALL">모든 상태</option>
            {Object.entries(entryStatusConfig).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          {/* Payment Filter */}
          <select
            value={paymentFilter}
            onChange={(e) =>
              setPaymentFilter(e.target.value as 'PENDING' | 'COMPLETED' | 'ALL')
            }
            className="px-4 py-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] text-base focus:border-[var(--accent-color)] focus:outline-none transition-colors"
          >
            <option value="ALL">모든 결제</option>
            {Object.entries(paymentStatusConfig).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          {/* Division Filter */}
          {divisions.length > 0 && (
            <select
              value={divisionFilter}
              onChange={(e) => setDivisionFilter(e.target.value)}
              className="px-4 py-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] text-base focus:border-[var(--accent-color)] focus:outline-none transition-colors"
            >
              <option value="ALL">모든 부서</option>
              {divisions.map((div) => (
                <option key={div.id} value={div.id}>
                  {div.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between text-base text-[var(--text-secondary)]">
        <span>
          검색 결과:{' '}
          <strong className="text-[var(--text-primary)]">
            {filteredAndSortedEntries.length}
          </strong>
          명
        </span>
        {selectedEntries.length > 0 && (
          <span className="text-[var(--accent-color)] font-medium">
            {selectedEntries.length}명 선택됨
          </span>
        )}
      </div>

      {/* Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-[var(--bg-card)]">
                <th className="p-4 w-14">
                  <input
                    type="checkbox"
                    checked={
                      selectedEntries.length === filteredAndSortedEntries.length &&
                      filteredAndSortedEntries.length > 0
                    }
                    onChange={toggleSelectAll}
                    className="w-5 h-5 rounded border-[var(--border-color)]"
                  />
                </th>
                <th className="text-left p-4 w-16">
                  <span className="text-base font-semibold text-[var(--text-secondary)]">#</span>
                </th>
                <th className="text-left p-4">
                  <button
                    onClick={() => handleSort('player_name')}
                    className="flex items-center gap-2 text-base font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    참가자 정보
                    <SortIcon field="player_name" />
                  </button>
                </th>
                <th className="text-left p-4 hidden lg:table-cell">
                  <button
                    onClick={() => handleSort('division')}
                    className="flex items-center gap-2 text-base font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    부서
                    <SortIcon field="division" />
                  </button>
                </th>
                <th className="text-left p-4">
                  <button
                    onClick={() => handleSort('status')}
                    className="flex items-center gap-2 text-base font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    상태
                    <SortIcon field="status" />
                  </button>
                </th>
                <th className="text-left p-4">
                  <button
                    onClick={() => handleSort('payment_status')}
                    className="flex items-center gap-2 text-base font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    결제
                    <SortIcon field="payment_status" />
                  </button>
                </th>
                <th className="text-left p-4 hidden sm:table-cell">
                  <button
                    onClick={() => handleSort('created_at')}
                    className="flex items-center gap-2 text-base font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    신청일
                    <SortIcon field="created_at" />
                  </button>
                </th>
                <th className="p-4 w-20">
                  <span className="text-base font-semibold text-[var(--text-secondary)]">관리</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedEntries.length > 0 ? (
                filteredAndSortedEntries.map((entry, index) => {
                  const isProcessing = processing === entry.id
                  const normalizedStatus = normalizeStatus(entry.status)
                  const normalizedPayment = normalizePaymentStatus(entry.payment_status)

                  return (
                    <tr
                      key={entry.id}
                      className={`border-b border-[var(--border-color)] last:border-b-0 transition-colors ${
                        selectedEntries.includes(entry.id)
                          ? 'bg-[var(--accent-color)]/5'
                          : 'hover:bg-[var(--bg-card-hover)]'
                      } ${isProcessing ? 'opacity-50' : ''}`}
                    >
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selectedEntries.includes(entry.id)}
                          onChange={() => toggleSelect(entry.id)}
                          className="w-5 h-5 rounded border-[var(--border-color)]"
                        />
                      </td>
                      <td className="p-4">
                        <span className="text-base font-semibold text-[var(--text-muted)]">
                          {index + 1}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 font-display font-bold text-base shrink-0">
                              {entry.profiles?.avatar_url ? (
                                <img
                                  src={entry.profiles.avatar_url}
                                  alt={entry.player_name}
                                  className="w-full h-full object-cover rounded-full"
                                />
                              ) : (
                                entry.player_name?.charAt(0).toUpperCase() || '?'
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-base font-semibold text-[var(--text-primary)]">
                                {entry.player_name}
                                {entry.player_rating && (
                                  <span className="ml-2 text-sm font-medium text-sky-600 dark:text-sky-400">
                                    {entry.player_rating}점
                                  </span>
                                )}
                              </p>
                              <p className="text-sm text-[var(--text-secondary)]">
                                {entry.club_name || entry.profiles?.club || '-'}
                              </p>
                            </div>
                          </div>
                          {/* Partner/Team info */}
                          {entry.partner_data && (
                            <p className="text-sm text-[var(--text-secondary)] pl-13 ml-13">
                              파트너: {(entry.partner_data as PartnerData).name}
                            </p>
                          )}
                          {entry.team_members && (entry.team_members as TeamMember[]).length > 0 && (
                            <p className="text-sm text-[var(--text-secondary)] pl-13 ml-13">
                              팀원: {(entry.team_members as TeamMember[]).map((m) => m.name).join(', ')}
                            </p>
                          )}
                          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                            <Phone className="w-4 h-4" />
                            {entry.phone}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 hidden lg:table-cell">
                        <span className="text-base text-[var(--text-primary)]">
                          {entry.tournament_divisions?.name || '-'}
                        </span>
                      </td>
                      <td className="p-4">
                        <select
                          value={normalizedStatus}
                          onChange={(e) =>
                            handleStatusChange(entry.id, e.target.value as EntryStatus)
                          }
                          disabled={isProcessing}
                          className={`px-3 py-2 rounded-lg text-sm font-semibold border-2 border-transparent focus:outline-none transition-colors cursor-pointer ${
                            entryStatusConfig[normalizedStatus].className
                          }`}
                        >
                          {Object.entries(entryStatusConfig).map(([key, { label }]) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-4">
                        <select
                          value={normalizedPayment}
                          onChange={(e) =>
                            handlePaymentChange(
                              entry.id,
                              e.target.value as PaymentStatus
                            )
                          }
                          disabled={isProcessing}
                          className={`px-3 py-2 rounded-lg text-sm font-semibold border-2 border-transparent focus:outline-none transition-colors cursor-pointer ${
                            paymentStatusConfig[normalizedPayment].className
                          }`}
                        >
                          {Object.entries(paymentStatusConfig).map(
                            ([key, { label }]) => (
                              <option key={key} value={key}>
                                {label}
                              </option>
                            )
                          )}
                        </select>
                      </td>
                      <td className="p-4 hidden sm:table-cell">
                        <p className="text-base text-[var(--text-primary)]">
                          {new Date(entry.created_at).toLocaleDateString('ko-KR')}
                        </p>
                        <p className="text-sm text-[var(--text-secondary)]">
                          {new Date(entry.created_at).toLocaleTimeString('ko-KR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => handleDelete(entry.id)}
                          disabled={isProcessing}
                          className="p-2.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-500 transition-colors"
                          title="삭제"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-3 text-[var(--text-muted)]">
                      <Users className="w-16 h-16 opacity-50" />
                      <p className="text-lg">참가 신청이 없습니다.</p>
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
