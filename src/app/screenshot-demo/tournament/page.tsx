'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { MapPin, Calendar, Trophy, ChevronRight, CheckCircle, Clock, CreditCard, ArrowLeft, Users, FileText } from 'lucide-react'

if (process.env.NODE_ENV !== 'development') {
  // DEV 전용
}

// ─── 공통 더미 데이터 ───────────────────────────────────────────
const TOURNAMENTS = [
  {
    id: '1',
    title: '제28회 마포구청장기 테니스 대회',
    status: 'OPEN',
    statusLabel: '모집 중',
    statusColor: 'var(--color-success-emphasis)',
    date: '2025.03.22',
    location: '마포 테니스장',
    matchType: '개인전 단식·복식',
    fee: '30,000원',
    emoji: '🎾',
  },
  {
    id: '2',
    title: '2025 서울시장기 생활체육 테니스',
    status: 'OPEN',
    statusLabel: '모집 중',
    statusColor: 'var(--color-success-emphasis)',
    date: '2025.04.05',
    location: '올림픽공원 테니스코트',
    matchType: '개인전 단식',
    fee: '20,000원',
    emoji: '🎾',
  },
  {
    id: '3',
    title: '강동구청장기 오픈 테니스',
    status: 'UPCOMING',
    statusLabel: '접수 예정',
    statusColor: '#a78bfa',
    date: '2025.04.12',
    location: '강동 테니스장',
    matchType: '개인전 복식',
    fee: '무료',
    emoji: '🎾',
  },
  {
    id: '4',
    title: '한강오픈 테니스 챔피언십',
    status: 'CLOSED',
    statusLabel: '마감',
    statusColor: '#f97316',
    date: '2025.03.08',
    location: '한강 테니스장',
    matchType: '개인전 단식',
    fee: '25,000원',
    emoji: '🎾',
  },
  {
    id: '5',
    title: '강남오픈 테니스',
    status: 'IN_PROGRESS',
    statusLabel: '진행 중',
    statusColor: '#38bdf8',
    date: '2025.03.15',
    location: '강남 테니스센터',
    matchType: '혼합 복식',
    fee: '15,000원',
    emoji: '🎾',
  },
  {
    id: '6',
    title: '은평구 주민 테니스 대회',
    status: 'COMPLETED',
    statusLabel: '종료',
    statusColor: 'var(--text-muted)',
    date: '2025.02.22',
    location: '은평 테니스장',
    matchType: '개인전 단식',
    fee: '10,000원',
    emoji: '🎾',
  },
]

const TOURNAMENT = TOURNAMENTS[0]
const DIVISIONS = [
  { id: 'd1', name: '일반부 단식 (남자)', fee: 30000, participants: 24, max: 32 },
  { id: 'd2', name: '일반부 단식 (여자)', fee: 30000, participants: 12, max: 16 },
  { id: 'd3', name: '혼합 복식', fee: 30000, participants: 18, max: 24 },
  { id: 'd4', name: '35세 이상 시니어 단식', fee: 20000, participants: 8, max: 16 },
]

// ─── 화면별 컴포넌트 ───────────────────────────────────────────

function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ backgroundColor: color, color: '#fff' }}
    >
      {label}
    </span>
  )
}

/** 1. 대회 목록 */
function TournamentList() {
  return (
    <div style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh' }}>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>대회 일정</h1>
            <p style={{ color: 'var(--text-muted)' }}>참가 가능한 테니스 대회를 확인하세요.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {TOURNAMENTS.map((t) => (
            <div
              key={t.id}
              className="rounded-xl overflow-hidden"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
            >
              {/* 포스터 영역 */}
              <div
                className="relative flex items-center justify-center text-5xl"
                style={{ aspectRatio: '3/2', backgroundColor: 'var(--bg-secondary)' }}
              >
                {t.emoji}
                <div className="absolute top-3 right-3">
                  <StatusBadge label={t.statusLabel} color={t.statusColor} />
                </div>
              </div>
              <div className="p-5">
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--accent-color)' }}>{t.date}</p>
                <h3 className="text-base font-bold mb-2 line-clamp-2" style={{ color: 'var(--text-primary)' }}>{t.title}</h3>
                <div className="flex items-center gap-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                  <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  {t.location}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** 2. 대회 상세 */
function TournamentDetail() {
  return (
    <div style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh' }}>
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* 뒤로가기 */}
        <div className="flex items-center gap-2 mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          대회 목록
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 왼쪽: 상세 정보 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 헤더 */}
            <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <div className="flex items-start gap-4 mb-4">
                <div
                  className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl shrink-0"
                  style={{ backgroundColor: 'var(--bg-secondary)' }}
                >🎾</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <StatusBadge label="모집 중" color="var(--color-success-emphasis)" />
                  </div>
                  <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{TOURNAMENT.title}</h1>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  { icon: <Calendar className="w-4 h-4" aria-hidden="true" />, label: '일시', value: '2025년 3월 22일 (토) 09:00' },
                  { icon: <MapPin className="w-4 h-4" aria-hidden="true" />, label: '장소', value: '마포 테니스장 (서울 마포구)' },
                  { icon: <Trophy className="w-4 h-4" aria-hidden="true" />, label: '종목', value: '개인전 단식·복식' },
                  { icon: <CreditCard className="w-4 h-4" aria-hidden="true" />, label: '참가비', value: '30,000원' },
                ].map(({ icon, label, value }) => (
                  <div key={label} className="flex items-start gap-2">
                    <span style={{ color: 'var(--accent-color)', marginTop: 2 }}>{icon}</span>
                    <div>
                      <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
                      <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 부서 목록 */}
            <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>참가 부서</h2>
              <div className="space-y-3">
                {DIVISIONS.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between rounded-xl px-4 py-3"
                    style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
                  >
                    <div>
                      <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{d.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        참가비 {d.fee.toLocaleString()}원 · {d.participants}/{d.max}명
                      </p>
                    </div>
                    <Users className="w-4 h-4" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 오른쪽: 신청 패널 */}
          <div>
            <div
              className="rounded-2xl p-6 sticky top-6"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
            >
              <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>참가 신청</h2>
              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>신청 마감: 2025년 3월 18일</p>
              <div className="space-y-3 mb-6 text-sm">
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>신청 기간</span>
                  <span style={{ color: 'var(--text-primary)' }}>~3.18(화)</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>참가비</span>
                  <span style={{ color: 'var(--text-primary)' }}>30,000원</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>결제 방법</span>
                  <span style={{ color: 'var(--text-primary)' }}>계좌이체</span>
                </div>
              </div>
              <button
                type="button"
                className="w-full py-3 rounded-xl text-sm font-bold transition-opacity"
                style={{ backgroundColor: 'var(--accent-color)', color: 'var(--bg-primary)' }}
              >
                참가 신청하기
              </button>
              <button
                type="button"
                className="w-full py-2.5 mt-3 rounded-xl text-sm font-medium"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
              >
                대진표 보기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** 3. 참가 신청 폼 */
function TournamentApplyForm() {
  return (
    <div style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh' }}>
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          대회 상세
        </div>
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>참가 신청</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>{TOURNAMENT.title}</p>

        <div className="space-y-5">
          {/* 부서 선택 */}
          <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
            <h2 className="text-base font-bold mb-3" style={{ color: 'var(--text-primary)' }}>부서 선택</h2>
            <div className="space-y-2">
              {DIVISIONS.map((d, idx) => (
                <label
                  key={d.id}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer"
                  style={{
                    backgroundColor: idx === 0 ? 'rgba(204,255,0,0.08)' : 'var(--bg-secondary)',
                    border: idx === 0 ? '1px solid rgba(204,255,0,0.4)' : '1px solid var(--border-color)',
                  }}
                >
                  <div
                    className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                    style={{ borderColor: idx === 0 ? 'var(--accent-color)' : 'var(--border-color)' }}
                  >
                    {idx === 0 && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--accent-color)' }} />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{d.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>참가비 {d.fee.toLocaleString()}원 · {d.participants}/{d.max}명</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* 개인 정보 */}
          <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
            <h2 className="text-base font-bold mb-3" style={{ color: 'var(--text-primary)' }}>신청자 정보</h2>
            <div className="space-y-3">
              {[
                { label: '이름', value: '김민준', placeholder: '' },
                { label: '연락처', value: '010-1234-5678', placeholder: '' },
                { label: '소속 클럽', value: '마포 테니스 클럽', placeholder: '(선택)' },
              ].map(({ label, value, placeholder }) => (
                <div key={label}>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    {label}
                  </label>
                  <div
                    className="w-full px-3 py-2.5 rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', color: value ? 'var(--text-primary)' : 'var(--text-muted)' }}
                  >
                    {value || placeholder}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="w-full py-3.5 rounded-xl text-sm font-bold"
            style={{ backgroundColor: 'var(--accent-color)', color: 'var(--bg-primary)' }}
          >
            신청하기 →
          </button>
        </div>
      </div>
    </div>
  )
}

/** 4. 계좌이체 안내 */
function TournamentPayment() {
  return (
    <div style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh' }}>
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          대회 상세
        </div>
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>참가비 납부</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>계좌이체로 참가비를 납부해 주세요.</p>

        {/* 신청 요약 */}
        <div className="rounded-2xl p-5 mb-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-secondary)' }}>신청 내역</h2>
          <div className="space-y-2 text-sm">
            {[
              { label: '대회', value: TOURNAMENT.title },
              { label: '부서', value: '일반부 단식 (남자)' },
              { label: '신청자', value: '김민준' },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span className="font-medium text-right max-w-[60%] truncate" style={{ color: 'var(--text-primary)' }}>{value}</span>
              </div>
            ))}
            <div className="pt-2 mt-2 border-t flex justify-between font-bold" style={{ borderColor: 'var(--border-color)' }}>
              <span style={{ color: 'var(--text-primary)' }}>참가비</span>
              <span style={{ color: 'var(--accent-color)' }}>30,000원</span>
            </div>
          </div>
        </div>

        {/* 계좌 정보 */}
        <div
          className="rounded-2xl p-5 mb-5"
          style={{ backgroundColor: 'rgba(204,255,0,0.05)', border: '1px solid rgba(204,255,0,0.2)' }}
        >
          <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--accent-color)' }}>입금 계좌</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span style={{ color: 'var(--text-muted)' }}>은행</span>
              <span className="font-bold" style={{ color: 'var(--text-primary)' }}>국민은행</span>
            </div>
            <div className="flex justify-between items-center">
              <span style={{ color: 'var(--text-muted)' }}>계좌번호</span>
              <div className="flex items-center gap-2">
                <span className="font-bold" style={{ color: 'var(--text-primary)' }}>123-456-789012</span>
                <button type="button" className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>복사</button>
              </div>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-muted)' }}>예금주</span>
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>마포구테니스협회</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-muted)' }}>입금 기한</span>
              <span className="font-medium text-orange-400">2025년 3월 18일까지</span>
            </div>
          </div>
        </div>

        <div
          className="rounded-xl p-4 mb-5 text-sm"
          style={{ backgroundColor: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}
        >
          <p style={{ color: '#fbbf24' }}>⚠ 입금자명은 신청자 이름(김민준)과 동일하게 입력해 주세요. 다를 경우 확인이 지연될 수 있습니다.</p>
        </div>

        <button
          type="button"
          className="w-full py-3.5 rounded-xl text-sm font-bold"
          style={{ backgroundColor: 'var(--accent-color)', color: 'var(--bg-primary)' }}
        >
          입금 완료했어요
        </button>
      </div>
    </div>
  )
}

/** 5. 입금 확인 대기 중 */
function TournamentPending() {
  return (
    <div style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh' }}>
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* 상단 신청 완료 알림 */}
        <div
          className="rounded-2xl p-5 mb-6 text-center"
          style={{ backgroundColor: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }}
        >
          <CheckCircle className="w-10 h-10 mx-auto mb-3" style={{ color: '#22c55e' }} aria-hidden="true" />
          <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>신청이 접수되었습니다!</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>참가비 입금 확인 후 최종 승인됩니다.</p>
        </div>

        {/* 신청 상세 */}
        <div className="rounded-2xl p-5 mb-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--text-secondary)' }}>신청 정보</h2>
          <div className="space-y-3 text-sm">
            {[
              { label: '대회', value: TOURNAMENT.title },
              { label: '부서', value: '일반부 단식 (남자)' },
              { label: '신청일', value: '2025년 3월 11일' },
              { label: '참가비', value: '30,000원' },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 상태 타임라인 */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--text-secondary)' }}>진행 상태</h2>
          <div className="space-y-4">
            {[
              { label: '신청 완료', desc: '2025년 3월 11일 오후 2:30', done: true },
              { label: '입금 확인 중', desc: '주최측이 입금을 확인하고 있습니다', done: false, current: true },
              { label: '신청 승인', desc: '입금 확인 후 문자로 안내됩니다', done: false },
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                  {step.done ? (
                    <CheckCircle className="w-5 h-5" style={{ color: '#22c55e' }} aria-hidden="true" />
                  ) : step.current ? (
                    <Clock className="w-5 h-5" style={{ color: 'var(--accent-color)' }} aria-hidden="true" />
                  ) : (
                    <div className="w-5 h-5 rounded-full" style={{ border: '2px solid var(--border-color)' }} />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: step.done || step.current ? 'var(--text-primary)' : 'var(--text-muted)' }}>{step.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Link
          href="/my/entries"
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-medium mt-5"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
        >
          <FileText className="w-4 h-4" aria-hidden="true" />
          내 신청 내역 보기
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}

/** 6. 내 신청 내역 */
function MyEntries() {
  const entries = [
    { title: TOURNAMENT.title, division: '일반부 단식 (남자)', date: '2025.03.22', status: '입금 확인 중', statusColor: '#fbbf24', fee: '30,000원' },
    { title: '서울시장기 생활체육 테니스', division: '개인전 단식', date: '2025.04.05', status: '승인 완료', statusColor: '#22c55e', fee: '20,000원' },
    { title: '강남오픈 테니스', division: '혼합 복식', date: '2025.03.15', status: '진행 중', statusColor: '#38bdf8', fee: '15,000원' },
    { title: '한강오픈 테니스 챔피언십', division: '개인전 단식', date: '2025.03.08', status: '종료', statusColor: 'var(--text-muted)', fee: '25,000원' },
  ]

  return (
    <div style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh' }}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>내 신청 내역</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>참가 신청한 대회 목록입니다.</p>

        {/* 상태 필터 */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {['전체 (4)', '대기 중', '승인', '진행 중', '종료'].map((label, i) => (
            <button
              key={label}
              type="button"
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{
                backgroundColor: i === 0 ? 'var(--accent-color)' : 'var(--bg-card)',
                color: i === 0 ? 'var(--bg-primary)' : 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
              }}
            >{label}</button>
          ))}
        </div>

        <div className="space-y-3">
          {entries.map((e, i) => (
            <div
              key={i}
              className="rounded-2xl p-4"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{e.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{e.division} · {e.date}</p>
                </div>
                <span
                  className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: `${e.statusColor}20`, color: e.statusColor }}
                >{e.status}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>참가비 {e.fee}</span>
                <button type="button" className="text-xs" style={{ color: 'var(--accent-color)' }}>상세 보기 →</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── 라우터 ───────────────────────────────────────────────────
const STEPS: Record<string, React.FC> = {
  'list': TournamentList,
  'detail': TournamentDetail,
  'apply': TournamentApplyForm,
  'payment': TournamentPayment,
  'pending': TournamentPending,
  'my-entries': MyEntries,
}

function TournamentDemoContent() {
  const params = useSearchParams()
  const step = params.get('step') ?? 'list'
  const Component = STEPS[step]
  if (!Component) return null
  return <Component />
}

export default function TournamentScreenshotDemoPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound()
  }
  return (
    <Suspense>
      <TournamentDemoContent />
    </Suspense>
  )
}
