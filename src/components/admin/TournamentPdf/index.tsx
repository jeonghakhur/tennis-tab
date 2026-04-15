import path from 'path'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'

// ────────────────────────────────────────────────────────────
// 한국어 폰트 등록 — Route Handler(서버) 컨텍스트에서만 실행됨
// ────────────────────────────────────────────────────────────

const fontDir = path.join(process.cwd(), 'public/font')

// NotoSansKR TTF — @react-pdf/renderer는 TTF/OTF만 안정적으로 지원 (WOFF/WOFF2 불안정)
Font.register({
  family: 'NotoSansKR',
  fonts: [
    { src: path.join(fontDir, 'NotoSansKR-Regular.ttf'), fontWeight: 400 },
    { src: path.join(fontDir, 'NotoSansKR-Bold.ttf'), fontWeight: 700 },
  ],
})

// ────────────────────────────────────────────────────────────
// 타입
// ────────────────────────────────────────────────────────────

export type PdfDivision = {
  id: string
  name: string
  max_teams: number | null
  prize_winner: string | null
  prize_runner_up: string | null
  prize_third: string | null
  confirmedCount: number   // 승인된 참가팀 수
  participantCount: number // 실제 참가 인원 수 (단체전은 팀원 합산)
}

export type PdfEntry = {
  id: string
  divisionId: string
  divisionName: string
  playerName: string
  clubName: string | null
  // 복식
  partnerName: string | null
  partnerClub: string | null
  // 단체전
  teamMembers: { name: string; rating: number }[] | null
  applicantParticipates: boolean // false면 본인 미참가
  matchType: string
}

export type PdfTournament = {
  title: string
  startDate: string | null
  endDate: string | null
  location: string | null
  host: string | null
  organizerName: string | null
  matchType: string | null
  teamMatchCount: number | null
  ballType: string | null
  eligibility: string | null
  openingCeremony: string | null
  entryStartDate: string | null
  entryEndDate: string | null
  entryFee: number | null
  bankAccount: string | null
  divisions: PdfDivision[]
  entries: PdfEntry[]
}

// ────────────────────────────────────────────────────────────
// 날짜 / 금액 포맷
// ────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return '-'
  if (!end || start === end) return formatDate(start)
  return `${formatDate(start)} ~ ${formatDate(end)}`
}

function formatCurrency(amount: number | null): string {
  if (!amount) return '-'
  return `${amount.toLocaleString('ko-KR')}원`
}

function formatMatchType(matchType: string | null, teamMatchCount: number | null): string {
  if (!matchType) return '-'
  const labels: Record<string, string> = {
    INDIVIDUAL_SINGLES: '개인전 단식',
    INDIVIDUAL_DOUBLES: '개인전 복식',
    TEAM_SINGLES: '단체전 단식',
    TEAM_DOUBLES: '단체전 복식',
  }
  if ((matchType === 'TEAM_SINGLES' || matchType === 'TEAM_DOUBLES') && teamMatchCount) {
    const suffix = matchType.includes('SINGLES') ? '단식' : '복식'
    return `단체전 ${teamMatchCount}${suffix}`
  }
  return labels[matchType] || matchType
}

// ────────────────────────────────────────────────────────────
// 스타일
// ────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    fontFamily: 'NotoSansKR',
    fontWeight: 400,
    fontSize: 9,
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 40,
    color: '#1a1a1a',
  },
  // 헤더
  header: {
    marginBottom: 20,
    borderBottom: '2px solid #1a1a1a',
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 4,
  },
  headerSub: {
    fontSize: 10,
    color: '#555',
  },
  printDate: {
    fontSize: 8,
    color: '#888',
    marginTop: 2,
  },
  // 섹션
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 6,
    marginTop: 16,
    paddingBottom: 3,
    borderBottom: '1px solid #ccc',
  },
  // 기본정보 테이블
  infoTable: {
    width: '100%',
  },
  infoRow: {
    flexDirection: 'row',
    borderBottom: '1px solid #eee',
  },
  infoLabel: {
    width: 80,
    padding: '5 6',
    backgroundColor: '#f4f4f4',
    fontWeight: 700,
    fontSize: 8,
    color: '#444',
  },
  infoValue: {
    flex: 1,
    padding: '5 6',
    fontSize: 9,
  },
  // 부서 현황 테이블
  table: {
    width: '100%',
    borderTop: '1px solid #ccc',
    borderLeft: '1px solid #ccc',
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableHeader: {
    backgroundColor: '#f4f4f4',
  },
  tableCell: {
    borderRight: '1px solid #ccc',
    borderBottom: '1px solid #ccc',
    padding: '5 6',
    fontSize: 8,
  },
  tableCellBold: {
    fontWeight: 700,
    fontSize: 8,
  },
  // 참가자 테이블 컬럼 너비
  colNo: { width: 28 },
  colDivision: { width: 80 },
  colName: { width: 70 },
  colClub: { flex: 1 },
  colPartner: { width: 70 },
  colPartnerClub: { flex: 1 },
  colTeamMember: { flex: 1 },
  // 페이지 번호
  pageNumber: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 8,
    color: '#999',
  },
  // 부서 구분 헤더 (참가자 목록 내)
  divisionHeader: {
    backgroundColor: '#e8f4e8',
    padding: '4 6',
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    marginTop: 6,
  },
})

// ────────────────────────────────────────────────────────────
// 하위 컴포넌트: 대회 기본 정보
// ────────────────────────────────────────────────────────────

function GuidelinesSection({ t }: { t: PdfTournament }) {
  const rows: [string, string][] = [
    ['대회 일시', formatDateRange(t.startDate, t.endDate)],
    ['장소', t.location || '-'],
    ['주최', t.host || '-'],
    ['주관', t.organizerName || '-'],
    ['경기 방식', formatMatchType(t.matchType, t.teamMatchCount)],
    ['사용구', t.ballType || '-'],
    ['참가 자격', t.eligibility || '-'],
    ['개회식', formatDate(t.openingCeremony)],
    ['접수 기간', formatDateRange(t.entryStartDate, t.entryEndDate)],
    ['참가비', formatCurrency(t.entryFee)],
    ['입금 계좌', t.bankAccount || '-'],
  ]

  return (
    <View>
      <Text style={S.sectionTitle}>대회 요강</Text>
      <View style={S.infoTable}>
        {rows.map(([label, value]) => (
          <View key={label} style={S.infoRow}>
            <Text style={S.infoLabel}>{label}</Text>
            <Text style={S.infoValue}>{value}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

// ────────────────────────────────────────────────────────────
// 하위 컴포넌트: 부서별 참가 현황
// ────────────────────────────────────────────────────────────

function DivisionsSection({ divisions }: { divisions: PdfDivision[] }) {
  const totalTeams = divisions.reduce((sum, d) => sum + d.confirmedCount, 0)
  const totalParticipants = divisions.reduce((sum, d) => sum + d.participantCount, 0)

  return (
    <View>
      <Text style={S.sectionTitle}>부서별 참가 현황</Text>
      <View style={S.table}>
        {/* 헤더 */}
        <View style={[S.tableRow, S.tableHeader]}>
          <Text style={[S.tableCell, S.tableCellBold, { flex: 1 }]}>참가부서</Text>
          <Text style={[S.tableCell, S.tableCellBold, { width: 55, textAlign: 'center' }]}>정원</Text>
          <Text style={[S.tableCell, S.tableCellBold, { width: 55, textAlign: 'center' }]}>참가팀수</Text>
          <Text style={[S.tableCell, S.tableCellBold, { width: 55, textAlign: 'center' }]}>참가자수</Text>
          <Text style={[S.tableCell, S.tableCellBold, { width: 85 }]}>우승</Text>
          <Text style={[S.tableCell, S.tableCellBold, { width: 85 }]}>준우승</Text>
          <Text style={[S.tableCell, S.tableCellBold, { width: 75 }]}>3위</Text>
        </View>
        {divisions.map((d) => (
          <View key={d.id} style={S.tableRow}>
            <Text style={[S.tableCell, { flex: 1 }]}>{d.name}</Text>
            <Text style={[S.tableCell, { width: 55, textAlign: 'center' }]}>
              {d.max_teams ?? '-'}
            </Text>
            <Text style={[S.tableCell, { width: 55, textAlign: 'center' }]}>
              {d.confirmedCount}
            </Text>
            <Text style={[S.tableCell, { width: 55, textAlign: 'center' }]}>
              {d.participantCount}
            </Text>
            <Text style={[S.tableCell, { width: 85 }]}>{d.prize_winner || '-'}</Text>
            <Text style={[S.tableCell, { width: 85 }]}>{d.prize_runner_up || '-'}</Text>
            <Text style={[S.tableCell, { width: 75 }]}>{d.prize_third || '-'}</Text>
          </View>
        ))}
        {/* 합계 행 */}
        <View style={[S.tableRow, S.tableHeader]}>
          <Text style={[S.tableCell, S.tableCellBold, { flex: 1 }]}>합계</Text>
          <Text style={[S.tableCell, { width: 55, textAlign: 'center' }]}>-</Text>
          <Text style={[S.tableCell, S.tableCellBold, { width: 55, textAlign: 'center' }]}>
            {totalTeams}
          </Text>
          <Text style={[S.tableCell, S.tableCellBold, { width: 55, textAlign: 'center' }]}>
            {totalParticipants}
          </Text>
          <Text style={[S.tableCell, { width: 85 }]}> </Text>
          <Text style={[S.tableCell, { width: 85 }]}> </Text>
          <Text style={[S.tableCell, { width: 75 }]}> </Text>
        </View>
      </View>
    </View>
  )
}

// ────────────────────────────────────────────────────────────
// 하위 컴포넌트: 참가자 목록 (경기 타입별 분기)
// ────────────────────────────────────────────────────────────

function EntriesSection({ entries, matchType, divisions }: {
  entries: PdfEntry[]
  matchType: string | null
  divisions: PdfDivision[]
}) {
  const isTeamMatch = matchType === 'TEAM_SINGLES' || matchType === 'TEAM_DOUBLES'
  const isDoubles = matchType === 'INDIVIDUAL_DOUBLES'

  // 부서 순서대로 그룹화
  const divisionOrder = divisions.map((d) => d.id)
  const grouped = divisionOrder.reduce<Record<string, PdfEntry[]>>((acc, divId) => {
    acc[divId] = entries.filter((e) => e.divisionId === divId)
    return acc
  }, {})

  // 단체전: 전체 최대 팀원 수 계산 (컬럼 수 통일)
  const maxTeamMembers = isTeamMatch
    ? Math.max(0, ...entries.map((e) => {
        const members = e.teamMembers ?? []
        // 본인 참가 시 1명 추가
        return members.length + (e.applicantParticipates ? 1 : 0)
      }))
    : 0

  if (isTeamMatch) {
    return (
      <View break>
        <Text style={S.sectionTitle}>참가자 명단</Text>
        <View style={S.table}>
          {/* 헤더 */}
          <View style={[S.tableRow, S.tableHeader]}>
            <Text style={[S.tableCell, S.tableCellBold, S.colNo, { textAlign: 'center' }]}>순번</Text>
            <Text style={[S.tableCell, S.tableCellBold, S.colDivision]}>참가부서</Text>
            {Array.from({ length: maxTeamMembers }, (_, i) => (
              <Text key={i} style={[S.tableCell, S.tableCellBold, S.colTeamMember]}>
                팀원{i + 1}
              </Text>
            ))}
          </View>
          {/* 데이터 행 */}
          {Object.entries(grouped).map(([divId, divEntries]) => {
            if (divEntries.length === 0) return null
            return divEntries.map((entry, idx) => {
              // 본인 참가 시 팀원 목록 앞에 추가
              const members = entry.teamMembers ?? []
              const allMembers = entry.applicantParticipates
                ? [{ name: entry.playerName }, ...members]
                : members

              return (
                <View key={entry.id} style={S.tableRow}>
                  <Text style={[S.tableCell, S.colNo, { textAlign: 'center' }]}>{idx + 1}</Text>
                  <Text style={[S.tableCell, S.colDivision]}>{entry.divisionName}</Text>
                  {Array.from({ length: maxTeamMembers }, (_, i) => (
                    <Text key={i} style={[S.tableCell, S.colTeamMember]}>
                      {allMembers[i]?.name || ''}
                    </Text>
                  ))}
                </View>
              )
            })
          })}
        </View>
      </View>
    )
  }

  if (isDoubles) {
    return (
      <View break>
        <Text style={S.sectionTitle}>참가자 명단</Text>
        <View style={S.table}>
          <View style={[S.tableRow, S.tableHeader]}>
            <Text style={[S.tableCell, S.tableCellBold, S.colNo, { textAlign: 'center' }]}>순번</Text>
            <Text style={[S.tableCell, S.tableCellBold, S.colDivision]}>참가부서</Text>
            <Text style={[S.tableCell, S.tableCellBold, S.colName]}>이름</Text>
            <Text style={[S.tableCell, S.tableCellBold, S.colClub]}>클럽</Text>
            <Text style={[S.tableCell, S.tableCellBold, S.colPartner]}>파트너</Text>
            <Text style={[S.tableCell, S.tableCellBold, S.colPartnerClub]}>파트너 클럽</Text>
          </View>
          {Object.entries(grouped).map(([, divEntries]) =>
            divEntries.map((entry, idx) => (
              <View key={entry.id} style={S.tableRow}>
                <Text style={[S.tableCell, S.colNo, { textAlign: 'center' }]}>{idx + 1}</Text>
                <Text style={[S.tableCell, S.colDivision]}>{entry.divisionName}</Text>
                <Text style={[S.tableCell, S.colName]}>{entry.playerName}</Text>
                <Text style={[S.tableCell, S.colClub]}>{entry.clubName || '-'}</Text>
                <Text style={[S.tableCell, S.colPartner]}>{entry.partnerName || '-'}</Text>
                <Text style={[S.tableCell, S.colPartnerClub]}>{entry.partnerClub || '-'}</Text>
              </View>
            ))
          )}
        </View>
      </View>
    )
  }

  // 개인전
  return (
    <View break>
      <Text style={S.sectionTitle}>참가자 명단</Text>
      <View style={S.table}>
        <View style={[S.tableRow, S.tableHeader]}>
          <Text style={[S.tableCell, S.tableCellBold, S.colNo, { textAlign: 'center' }]}>순번</Text>
          <Text style={[S.tableCell, S.tableCellBold, S.colDivision]}>참가부서</Text>
          <Text style={[S.tableCell, S.tableCellBold, S.colName]}>이름</Text>
          <Text style={[S.tableCell, S.tableCellBold, S.colClub]}>클럽</Text>
        </View>
        {Object.entries(grouped).map(([, divEntries]) =>
          divEntries.map((entry, idx) => (
            <View key={entry.id} style={S.tableRow}>
              <Text style={[S.tableCell, S.colNo, { textAlign: 'center' }]}>{idx + 1}</Text>
              <Text style={[S.tableCell, S.colDivision]}>{entry.divisionName}</Text>
              <Text style={[S.tableCell, S.colName]}>{entry.playerName}</Text>
              <Text style={[S.tableCell, S.colClub]}>{entry.clubName || '-'}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  )
}

// ────────────────────────────────────────────────────────────
// 메인 PDF Document
// ────────────────────────────────────────────────────────────

export function TournamentPdfDocument({ t }: { t: PdfTournament }) {
  const today = formatDate(new Date().toISOString())

  return (
    <Document>
      <Page size="A4" style={S.page}>
        {/* 헤더 */}
        <View style={S.header}>
          <Text style={S.headerTitle}>{t.title}</Text>
          <Text style={S.headerSub}>대회 요강 및 참가자 명단</Text>
          <Text style={S.printDate}>출력일: {today}</Text>
        </View>

        {/* 대회 요강 */}
        <GuidelinesSection t={t} />

        {/* 부서별 참가 현황 */}
        <DivisionsSection divisions={t.divisions} />

        {/* 참가자 목록 (별도 페이지로 분리) */}
        <EntriesSection
          entries={t.entries}
          matchType={t.matchType}
          divisions={t.divisions}
        />

        {/* 페이지 번호 */}
        <Text
          style={S.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  )
}
