import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canManageTournaments } from '@/lib/auth/roles'
import { decryptProfile } from '@/lib/crypto/profileCrypto'
import * as XLSX from 'xlsx'

interface RouteContext {
  params: Promise<{ id: string }>
}

// 상태 한글 매핑
const ENTRY_STATUS_LABELS: Record<string, string> = {
  PENDING: '승인 대기',
  CONFIRMED: '승인됨',
  APPROVED: '승인됨',
  WAITLISTED: '대기자',
  REJECTED: '거절됨',
  CANCELLED: '취소됨',
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: '미결제',
  COMPLETED: '결제완료',
  FAILED: '실패',
  CANCELLED: '취소',
}

export async function GET(request: Request, context: RouteContext) {
  const { id: tournamentId } = await context.params
  const supabase = await createClient()

  // 인증 확인
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  // 권한 확인
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!canManageTournaments(profile?.role)) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  // 대회 정보
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('title, match_type, organizer_id')
    .eq('id', tournamentId)
    .single()

  if (tournamentError || !tournament) {
    return NextResponse.json({ error: '대회를 찾을 수 없습니다.' }, { status: 404 })
  }

  // MANAGER는 자신이 만든 대회만
  const isAdminOrHigher = ['ADMIN', 'SUPER_ADMIN'].includes(profile?.role ?? '')
  if (!isAdminOrHigher && tournament.organizer_id !== user.id) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  // 참가 신청 조회
  const { data: rawEntries, error: entriesError } = await supabase
    .from('tournament_entries')
    .select(`
      *,
      profiles:user_id (name, email, phone, club),
      tournament_divisions:division_id (name)
    `)
    .eq('tournament_id', tournamentId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })

  if (entriesError) {
    return NextResponse.json({ error: '데이터 조회 실패' }, { status: 500 })
  }

  // profiles.phone 복호화
  const entries = (rawEntries ?? []).map((entry) => ({
    ...entry,
    profiles: entry.profiles ? decryptProfile(entry.profiles) : null,
  }))

  // 단체전 여부 확인
  const isTeamMatch = tournament.match_type === 'TEAM_SINGLES' || tournament.match_type === 'TEAM_DOUBLES'
  const isDoubles = tournament.match_type === 'INDIVIDUAL_DOUBLES'

  // 단체전: 최대 팀원 수 계산 (컬럼 순서 고정용)
  type TeamMemberItem = { name: string; rating: number; club?: string | null }
  const maxTeamMembers = isTeamMatch
    ? Math.max(0, ...entries.map((e) => (e.team_members as TeamMemberItem[] | null)?.length ?? 0))
    : 0

  // 엑셀 데이터 생성
  type ExcelRow = Record<string, string | number>
  const rows: ExcelRow[] = entries.map((entry, index) => {
    const row: ExcelRow = {
      '순번': index + 1,
      '신청일': formatDate(entry.created_at),
      '부문': entry.tournament_divisions?.name ?? '-',
      '신청자명': entry.player_name || entry.profiles?.name || '-',
      '이메일': entry.profiles?.email || '-',
      '전화번호': entry.phone || entry.profiles?.phone || '-',
      '클럽': entry.club_name || entry.profiles?.club || '-',
    }

    // 복식: 파트너 정보
    if (isDoubles && entry.partner_data) {
      const partner = entry.partner_data as { name: string; club: string; rating: number }
      row['파트너'] = partner.name || '-'
      row['파트너 클럽'] = partner.club || '-'
    }

    // 단체전: 팀원 이름 + 점수 (최대 팀원 수만큼 빈 슬롯 포함 → 컬럼 순서 고정)
    if (isTeamMatch) {
      const members = (entry.team_members as TeamMemberItem[] | null) ?? []
      const totalRating = members.reduce((sum, m) => sum + (m?.rating ?? 0), 0)
      row['팀 총점'] = totalRating || '-'
      for (let i = 0; i < maxTeamMembers; i++) {
        const member = members[i]
        row[`팀원${i + 1}`] = member?.name || '-'
        row[`팀원${i + 1} 점수`] = member?.rating ?? '-'
      }
    }

    row['참가상태'] = ENTRY_STATUS_LABELS[entry.status] || entry.status
    row['결제상태'] = PAYMENT_STATUS_LABELS[entry.payment_status] || entry.payment_status

    // 입금자명 (환불 관련)
    const refundHolder = (entry as Record<string, unknown>).refund_holder
    if (typeof refundHolder === 'string' && refundHolder) {
      row['입금자명'] = refundHolder
    }

    return row
  })

  // 워크북 생성
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)

  // 열 너비 자동 조절
  const colWidths = Object.keys(rows[0] ?? {}).map((key) => {
    const maxLen = Math.max(
      key.length,
      ...rows.map((row) => String(row[key] ?? '').length)
    )
    // 한글은 2바이트 근사치로 너비 계산
    return { wch: Math.min(maxLen * 2 + 2, 40) }
  })
  ws['!cols'] = colWidths

  XLSX.utils.book_append_sheet(wb, ws, '참가신청내역')

  // Buffer로 변환
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  // 파일명 생성
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const safeTitle = tournament.title.replace(/[/\\?%*:|"<>]/g, '_')
  const filename = `${safeTitle}_참가신청내역_${today}.xlsx`

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
