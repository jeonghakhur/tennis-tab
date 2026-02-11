'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Users, Phone, Trash2 } from 'lucide-react'
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
  bulkUpdateEntryStatus,
  bulkUpdatePaymentStatus,
} from '@/lib/admin/entries'
import { AlertDialog, ConfirmDialog } from '@/components/common/AlertDialog'

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
}

// 목록은 항상 참가 신청 순(created_at 오름차순)으로 고정

type NormalizedStatus = 'PENDING' | 'APPROVED' | 'WAITLISTED' | 'REJECTED'

const entryStatusConfig: Record<
  NormalizedStatus,
  { label: string; className: string; order: number }
> = {
  PENDING: {
    label: '승인 대기',
    className: 'bg-(--color-warning-subtle) text-(--color-warning)',
    order: 1,
  },
  APPROVED: {
    label: '승인됨',
    className: 'bg-(--color-success-subtle) text-(--color-success)',
    order: 2,
  },
  WAITLISTED: {
    label: '대기자',
    className: 'bg-(--color-purple-subtle) text-(--color-purple)',
    order: 3,
  },
  REJECTED: {
    label: '거절됨',
    className: 'bg-(--color-danger-subtle) text-(--color-danger)',
    order: 4,
  },
}

// 결제 상태는 결제/미결제만
const paymentStatusConfig: Record<
  'PENDING' | 'COMPLETED',
  { label: string; className: string }
> = {
  PENDING: {
    label: '미결제',
    className: 'bg-(--color-danger-subtle) text-(--color-danger)'
  },
  COMPLETED: {
    label: '결제완료',
    className: 'bg-(--color-success-subtle) text-(--color-success)'
  },
}

// 상태 값 정규화 (DB enum → UI 상태 매핑)
function normalizeStatus(status: EntryStatus): NormalizedStatus {
  if (status === 'CONFIRMED') return 'APPROVED'
  if (status === 'WAITLISTED') return 'WAITLISTED'
  if (status === 'CANCELLED') return 'REJECTED'
  return status as NormalizedStatus
}

function normalizePaymentStatus(status: PaymentStatus): 'PENDING' | 'COMPLETED' {
  return status === 'COMPLETED' ? 'COMPLETED' : 'PENDING'
}

export function EntriesManager({
  tournamentId,
  entries,
  divisions,
}: EntriesManagerProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<NormalizedStatus | 'ALL'>('ALL')
  const [paymentFilter, setPaymentFilter] = useState<'PENDING' | 'COMPLETED' | 'ALL'>('ALL')
  const [divisionFilter, setDivisionFilter] = useState<string>('ALL')
  const [selectedEntries, setSelectedEntries] = useState<string[]>([])
  const [processing, setProcessing] = useState<string | null>(null)
  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    type: 'info' | 'warning' | 'error' | 'success'
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  })
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    entryId: string | null
  }>({
    isOpen: false,
    entryId: null,
  })

  const handleStatusChange = async (entryId: string, status: EntryStatus) => {
    if (processing) return
    setProcessing(entryId)
    try {
      const result = await updateEntryStatus(entryId, status)
      if (result.error) {
        setAlertDialog({
          isOpen: true,
          title: '상태 변경 실패',
          message: result.error,
          type: 'error',
        })
      } else {
        router.refresh()
      }
    } catch {
      setAlertDialog({
        isOpen: true,
        title: '오류',
        message: '상태 변경 중 오류가 발생했습니다.',
        type: 'error',
      })
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
        setAlertDialog({
          isOpen: true,
          title: '결제 상태 변경 실패',
          message: result.error,
          type: 'error',
        })
      } else {
        router.refresh()
      }
    } catch {
      setAlertDialog({
        isOpen: true,
        title: '오류',
        message: '결제 상태 변경 중 오류가 발생했습니다.',
        type: 'error',
      })
    } finally {
      setProcessing(null)
    }
  }

  const handleDeleteConfirm = async () => {
    if (processing || !confirmDialog.entryId) return

    setProcessing(confirmDialog.entryId)
    try {
      const result = await deleteEntry(confirmDialog.entryId)
      if (result.error) {
        setAlertDialog({
          isOpen: true,
          title: '삭제 실패',
          message: result.error,
          type: 'error',
        })
      } else {
        router.refresh()
        setAlertDialog({
          isOpen: true,
          title: '삭제 완료',
          message: '참가 신청이 삭제되었습니다.',
          type: 'success',
        })
      }
    } catch {
      setAlertDialog({
        isOpen: true,
        title: '오류',
        message: '삭제 중 오류가 발생했습니다.',
        type: 'error',
      })
    } finally {
      setProcessing(null)
      setConfirmDialog({ isOpen: false, entryId: null })
    }
  }

  const handleBulkStatusChange = async (status: EntryStatus) => {
    if (selectedEntries.length === 0 || processing) return

    setProcessing('bulk')
    try {
      const result = await bulkUpdateEntryStatus(selectedEntries, status)
      if (result.error) {
        setAlertDialog({
          isOpen: true,
          title: '일괄 변경 실패',
          message: result.error,
          type: 'error',
        })
      } else {
        router.refresh()
        setSelectedEntries([])
        setAlertDialog({
          isOpen: true,
          title: '일괄 변경 완료',
          message: `${selectedEntries.length}개 항목의 상태가 변경되었습니다.`,
          type: 'success',
        })
      }
    } catch {
      setAlertDialog({
        isOpen: true,
        title: '오류',
        message: '일괄 변경 중 오류가 발생했습니다.',
        type: 'error',
      })
    } finally {
      setProcessing(null)
    }
  }

  const handleBulkPaymentChange = async (status: PaymentStatus) => {
    if (selectedEntries.length === 0 || processing) return

    setProcessing('bulk')
    try {
      const result = await bulkUpdatePaymentStatus(selectedEntries, status)
      if (result.error) {
        setAlertDialog({
          isOpen: true,
          title: '일괄 변경 실패',
          message: result.error,
          type: 'error',
        })
      } else {
        router.refresh()
        setSelectedEntries([])
        setAlertDialog({
          isOpen: true,
          title: '일괄 변경 완료',
          message: `${selectedEntries.length}개 항목의 결제 상태가 변경되었습니다.`,
          type: 'success',
        })
      }
    } catch {
      setAlertDialog({
        isOpen: true,
        title: '오류',
        message: '일괄 변경 중 오류가 발생했습니다.',
        type: 'error',
      })
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

    // 항상 참가 신청 순(created_at → id) 고정. 동일 created_at이어도 id로 순서 유지
    return [...filtered].sort((a, b) => {
      const t1 = new Date(a.created_at).getTime()
      const t2 = new Date(b.created_at).getTime()
      if (t1 !== t2) return t1 - t2
      return a.id.localeCompare(b.id)
    })
  }, [entries, searchQuery, statusFilter, paymentFilter, divisionFilter])

  // 선택된 부서별 신청 현황 (부서 선택 시 해당 부서만, 전체 선택 시 전체)
  const entriesForStats =
    divisionFilter === 'ALL'
      ? entries
      : entries.filter((e) => e.division_id === divisionFilter)
  const stats = {
    total: entriesForStats.length,
    pending: entriesForStats.filter((e) => normalizeStatus(e.status) === 'PENDING').length,
    approved: entriesForStats.filter((e) => normalizeStatus(e.status) === 'APPROVED').length,
    waitlisted: entriesForStats.filter((e) => normalizeStatus(e.status) === 'WAITLISTED').length,
    paid: entriesForStats.filter((e) => e.payment_status === 'COMPLETED').length,
  }
  const selectedDivisionName =
    divisionFilter === 'ALL'
      ? null
      : divisions.find((d) => d.id === divisionFilter)?.name ?? null

  // 부서별 신청 현황
  const divisionStats = divisions.map((division) => {
    const divisionEntries = entries.filter((e) => e.division_id === division.id)
    return {
      id: division.id,
      name: division.name,
      maxTeams: division.max_teams,
      total: divisionEntries.length,
      approved: divisionEntries.filter((e) => normalizeStatus(e.status) === 'APPROVED').length,
      paid: divisionEntries.filter((e) => e.payment_status === 'COMPLETED').length,
    }
  })

  return (
    <div className="space-y-6">
      {/* 부서별 모집 현황 */}
      {divisions.length > 0 && (
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-(--text-primary)">
              부서별 모집 현황
            </h3>
            {divisionFilter !== 'ALL' && (
              <button
                onClick={() => setDivisionFilter('ALL')}
                className="text-sm text-(--accent-color) hover:underline"
              >
                전체 보기
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {divisionStats.map((div) => {
              const fillPercent = div.maxTeams ? Math.min((div.total / div.maxTeams) * 100, 100) : 0
              const isFull = div.maxTeams && div.total >= div.maxTeams
              const isSelected = divisionFilter === div.id

              return (
                <button
                  key={div.id}
                  onClick={() => setDivisionFilter(isSelected ? 'ALL' : div.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'border-(--accent-color) bg-(--accent-color)/10 ring-2 ring-(--accent-color)/30'
                      : isFull
                        ? 'border-(--color-danger-border) bg-(--color-danger-subtle) hover:border-(--color-danger)'
                        : 'border-(--border-color) bg-(--bg-card) hover:border-(--border-accent)'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-(--text-primary)">{div.name}</span>
                    <div className="flex items-center gap-1">
                      {isSelected && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-(--accent-color)/20 text-(--accent-color)">
                          선택됨
                        </span>
                      )}
                      {isFull && !isSelected && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-(--color-danger-subtle) text-(--color-danger)">
                          마감
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-2xl font-display font-bold text-(--text-primary)">
                      {div.total}
                    </span>
                    {div.maxTeams && (
                      <span className="text-sm text-(--text-muted)">/ {div.maxTeams}팀</span>
                    )}
                  </div>
                  {div.maxTeams && (
                    <div className="h-2 bg-(--bg-secondary) rounded-full overflow-hidden mb-2">
                      <div
                        className={`h-full transition-all ${
                          isFull ? 'bg-(--color-danger)' : 'bg-(--accent-color)'
                        }`}
                        style={{ width: `${fillPercent}%` }}
                      />
                    </div>
                  )}
                  <div className="flex gap-3 text-xs text-(--text-muted)">
                    <span>승인 <span className="text-emerald-500">{div.approved}</span></span>
                    <span>결제 <span className="text-sky-500">{div.paid}</span></span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Stats (선택된 부서별) */}
      <div className="space-y-2">
        {selectedDivisionName && (
          <p className="text-sm font-medium text-(--text-secondary)">
            {selectedDivisionName} 신청 현황
          </p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="glass-card rounded-xl p-5 text-center">
            <p className="text-3xl font-display font-bold text-(--text-primary)">
              {stats.total}
            </p>
            <p className="text-sm text-(--text-secondary) mt-1">전체 신청</p>
          </div>
          <div className="glass-card rounded-xl p-5 text-center">
            <p className="text-3xl font-display font-bold text-amber-500">
              {stats.pending}
            </p>
            <p className="text-sm text-(--text-secondary) mt-1">승인 대기</p>
          </div>
          <div className="glass-card rounded-xl p-5 text-center">
            <p className="text-3xl font-display font-bold text-emerald-500">
              {stats.approved}
            </p>
            <p className="text-sm text-(--text-secondary) mt-1">승인 완료</p>
          </div>
          <div className="glass-card rounded-xl p-5 text-center">
            <p className="text-3xl font-display font-bold text-purple-500">
              {stats.waitlisted}
            </p>
            <p className="text-sm text-(--text-secondary) mt-1">대기자</p>
          </div>
          <div className="glass-card rounded-xl p-5 text-center">
            <p className="text-3xl font-display font-bold text-sky-500">
              {stats.paid}
            </p>
            <p className="text-sm text-(--text-secondary) mt-1">결제 완료</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-(--text-muted)" />
          <input
            type="text"
            placeholder="이름, 이메일, 전화번호, 클럽명으로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl bg-(--bg-card) border border-(--border-color) text-(--text-primary) text-base placeholder:text-(--text-muted) focus:border-(--accent-color) focus:outline-none transition-colors"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as NormalizedStatus | 'ALL')}
            className="px-4 py-3 rounded-xl bg-(--bg-card) border border-(--border-color) text-(--text-primary) text-base focus:border-(--accent-color) focus:outline-none transition-colors"
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
            className="px-4 py-3 rounded-xl bg-(--bg-card) border border-(--border-color) text-(--text-primary) text-base focus:border-(--accent-color) focus:outline-none transition-colors"
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
              className="px-4 py-3 rounded-xl bg-(--bg-card) border border-(--border-color) text-(--text-primary) text-base focus:border-(--accent-color) focus:outline-none transition-colors"
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

      {/* Results count and bulk actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <span className="text-base text-(--text-secondary)">
          검색 결과:{' '}
          <strong className="text-(--text-primary)">
            {filteredAndSortedEntries.length}
          </strong>
          명
          {selectedEntries.length > 0 && (
            <span className="ml-3 text-(--accent-color) font-medium">
              {selectedEntries.length}명 선택됨
            </span>
          )}
        </span>

        {selectedEntries.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleBulkStatusChange(e.target.value as EntryStatus)
                  e.target.value = ''
                }
              }}
              disabled={processing !== null}
              className="px-3 py-2 rounded-lg bg-(--color-success-subtle) text-(--color-success) font-medium border-2 border-(--color-success-border) hover:border-(--color-success) focus:border-(--color-success) focus:outline-none transition-colors text-sm"
            >
              <option value="">상태 일괄 변경</option>
              {Object.entries(entryStatusConfig).map(([key, { label }]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>

            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleBulkPaymentChange(e.target.value as PaymentStatus)
                  e.target.value = ''
                }
              }}
              disabled={processing !== null}
              className="px-3 py-2 rounded-lg bg-(--color-info-subtle) text-(--color-info) font-medium border-2 border-(--color-info-border) hover:border-(--color-info) focus:border-(--color-info) focus:outline-none transition-colors text-sm"
            >
              <option value="">결제 일괄 변경</option>
              {Object.entries(paymentStatusConfig).map(([key, { label }]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-(--border-color) bg-(--bg-card)">
                <th className="p-4 w-14">
                  <input
                    type="checkbox"
                    checked={
                      selectedEntries.length === filteredAndSortedEntries.length &&
                      filteredAndSortedEntries.length > 0
                    }
                    onChange={toggleSelectAll}
                    className="w-5 h-5 rounded border-(--border-color)"
                  />
                </th>
                <th className="text-left p-4 w-12">
                  <span className="text-base font-semibold text-(--text-secondary)">#</span>
                </th>
                <th className="text-left p-4">
                  <span className="text-base font-semibold text-(--text-secondary)">참가자 정보</span>
                </th>
                <th className="text-left p-4 hidden lg:table-cell">
                  <span className="text-base font-semibold text-(--text-secondary)">부서</span>
                </th>
                <th className="text-left p-4">
                  <span className="text-base font-semibold text-(--text-secondary)">상태</span>
                </th>
                <th className="text-left p-4">
                  <span className="text-base font-semibold text-(--text-secondary)">결제</span>
                </th>
                <th className="text-left p-4 hidden sm:table-cell">
                  <span className="text-base font-semibold text-(--text-secondary)">신청일</span>
                </th>
                <th className="p-4 w-20">
                  <span className="text-base font-semibold text-(--text-secondary)">관리</span>
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
                      className={`border-b border-(--border-color) last:border-b-0 transition-colors ${
                        selectedEntries.includes(entry.id)
                          ? 'bg-(--accent-color)/5'
                          : 'hover:bg-(--bg-card-hover)'
                      } ${isProcessing ? 'opacity-50' : ''}`}
                    >
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selectedEntries.includes(entry.id)}
                          onChange={() => toggleSelect(entry.id)}
                          className="w-5 h-5 rounded border-(--border-color)"
                        />
                      </td>
                      <td className="p-4">
                        <span className="text-base font-semibold text-(--text-muted)">
                          {index + 1}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="space-y-2">
                          <div className="min-w-0">
                            <p className="text-base font-semibold text-(--text-primary)">
                              {entry.player_name}
                              {(entry.club_name || entry.profiles?.club) && (
                                <span className="ml-2 text-sm text-(--text-secondary)">
                                  ({entry.club_name || entry.profiles?.club})
                                </span>
                              )}
                              {entry.player_rating && (
                                <span className="ml-2 text-sm font-medium text-sky-600 dark:text-sky-400">
                                  {entry.player_rating}점
                                </span>
                              )}
                            </p>
                            <div className="flex items-center gap-1.5 text-sm text-(--text-secondary)">
                              <Phone className="w-4 h-4" />
                              {entry.phone}
                            </div>
                          </div>
                          {/* Partner/Team info */}
                          {entry.partner_data && (
                            <div className="pt-2 border-t border-(--border-color)">
                              <p className="text-base font-semibold text-(--text-primary)">
                                {(entry.partner_data as PartnerData).name}
                                {(entry.partner_data as PartnerData).club && (
                                  <span className="ml-2 text-sm text-(--text-secondary)">
                                    ({(entry.partner_data as PartnerData).club})
                                  </span>
                                )}
                                {(entry.partner_data as PartnerData).rating && (
                                  <span className="ml-2 text-sm font-medium text-sky-600 dark:text-sky-400">
                                    {(entry.partner_data as PartnerData).rating}점
                                  </span>
                                )}
                              </p>
                            </div>
                          )}
                          {entry.team_members && (entry.team_members as TeamMember[]).length > 0 && (() => {
                            const teamMembers = entry.team_members as TeamMember[]
                            const totalRating = (entry.player_rating || 0) + teamMembers.reduce((sum, m) => sum + (m.rating || 0), 0)

                            return (
                              <div className="pt-2 border-t border-(--border-color)">
                                <p className="text-base font-semibold text-(--text-primary)">
                                  {teamMembers.map((member, idx) => (
                                    <span key={idx}>
                                      {idx > 0 && ', '}
                                      {member.name}
                                      {member.club && (
                                        <span className="text-sm text-(--text-secondary)">
                                          ({member.club})
                                        </span>
                                      )}
                                      {member.rating && (
                                        <span className="text-sm font-medium text-sky-600 dark:text-sky-400">
                                          {member.rating}점
                                        </span>
                                      )}
                                    </span>
                                  ))}
                                </p>
                                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                                  팀 합계: {totalRating}점
                                </p>
                              </div>
                            )
                          })()}
                        </div>
                      </td>
                      <td className="p-4 hidden lg:table-cell">
                        <span className="text-base text-(--text-primary)">
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
                        <p className="text-base text-(--text-primary)">
                          {new Date(entry.created_at).toLocaleDateString('ko-KR')}
                        </p>
                        <p className="text-sm text-(--text-secondary)">
                          {new Date(entry.created_at).toLocaleTimeString('ko-KR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => setConfirmDialog({ isOpen: true, entryId: entry.id })}
                          disabled={isProcessing}
                          className="p-2.5 rounded-lg hover:bg-(--color-danger-subtle) text-(--color-danger) transition-colors"
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
                    <div className="flex flex-col items-center gap-3 text-(--text-muted)">
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

      {/* Alert Dialog */}
      <AlertDialog
        isOpen={alertDialog.isOpen}
        onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
        title={alertDialog.title}
        message={alertDialog.message}
        type={alertDialog.type}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, entryId: null })}
        onConfirm={handleDeleteConfirm}
        title="참가 신청 삭제"
        message="정말로 이 참가 신청을 삭제하시겠습니까?"
        type="error"
        isLoading={processing !== null}
      />
    </div>
  )
}
