'use client'

import { notFound } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import { MessageCircle } from 'lucide-react'

// DEV 전용 페이지
if (process.env.NODE_ENV !== 'development') {
  // 프로덕션에서는 404
}

interface DemoMessage {
  role: 'user' | 'assistant'
  content: string
  links?: Array<{ href: string; label: string }>
}

const DEMO_SCENARIOS: Record<string, { title: string; messages: DemoMessage[] }> = {
  'tournament-search': {
    title: '대회 검색',
    messages: [
      { role: 'user', content: '지금 신청 가능한 대회 알려줘' },
      {
        role: 'assistant',
        content: `현재 신청 가능한 대회를 찾았어요! 🎾\n\n**1. 마포구청장기 테니스 대회**\n📅 2025년 3월 22일 (토)\n📍 마포 테니스장\n💰 참가비: 30,000원\n🏷️ 상태: 접수 중\n\n**2. 서울시장기 생활체육 테니스**\n📅 2025년 4월 5일 (토)\n📍 올림픽공원 테니스코트\n💰 참가비: 20,000원\n🏷️ 상태: 접수 중\n\n**3. 강동구청장기 오픈 테니스**\n📅 2025년 4월 12일 (토)\n📍 강동 테니스장\n💰 무료\n🏷️ 상태: 접수 중\n\n원하시는 대회를 클릭해서 자세한 내용을 확인하세요!`,
        links: [
          { href: '/tournaments', label: '전체 대회 보기' },
        ],
      },
    ],
  },
  'my-application': {
    title: '나의 참가 신청',
    messages: [
      { role: 'user', content: '내가 신청한 대회 목록 보여줘' },
      {
        role: 'assistant',
        content: `신청하신 대회 목록입니다! 📋\n\n**✅ 마포구청장기 테니스 대회**\n📅 2025년 3월 22일 (토) 09:00\n📍 마포 테니스장\n👤 부서: 일반부 단식\n💳 결제: 완료 (30,000원)\n🏷️ 상태: 승인 완료\n\n**⏳ 서울시장기 생활체육 테니스**\n📅 2025년 4월 5일 (토) 10:00\n📍 올림픽공원 테니스코트\n👤 부서: 혼합 복식\n💳 결제: 입금 대기 중\n🏷️ 상태: 검토 중\n\n총 2개 대회에 신청하셨습니다.\n다음 경기는 **3월 22일 마포구청장기**입니다!`,
        links: [
          { href: '/my', label: '내 신청 내역' },
        ],
      },
    ],
  },
  'winners': {
    title: '우승자 조회',
    messages: [
      { role: 'user', content: '최근 우승자 누구야?' },
      {
        role: 'assistant',
        content: `최근 대회 입상자를 알려드릴게요! 🏆\n\n**마포구청장기 (2025년 2월)**\n🥇 우승: 김민준 (일반부 단식)\n🥈 준우승: 이상현\n🥉 3위: 박지호, 최우성\n\n**서초구청장기 (2025년 1월)**\n🥇 우승: 정하은 (여자부 단식)\n🥈 준우승: 김서연\n🥉 3위: 이지수, 박민아\n\n**강남오픈 (2025년 1월)**\n🥇 우승: 오형준·최준혁 (혼합 복식)\n🥈 준우승: 황성민·배소현\n\n더 자세한 입상 기록을 보시겠어요?`,
        links: [
          { href: '/awards', label: '수상자 전체 보기' },
        ],
      },
    ],
  },
  'club-schedule': {
    title: '클럽 모임 일정',
    messages: [
      { role: 'user', content: '이번 주 클럽 모임 일정 알려줘' },
      {
        role: 'assistant',
        content: `이번 주 가입 클럽의 모임 일정이에요! 📅\n\n**마포 테니스 클럽**\n🗓️ 수요일 (3월 12일) 오후 7:00\n📍 마포 실내 테니스장 3코트\n👥 참석자: 8/12명\n📝 정기 복식 연습 — 내 응답: **참석**\n\n**한강 오픈 테니스**\n🗓️ 토요일 (3월 15일) 오전 9:00\n📍 한강 테니스장 A구역\n👥 참석자: 14/20명\n📝 주말 클럽 경기 — 내 응답: **미정**\n\n🟡 토요일 모임 참석 여부를 아직 응답하지 않으셨어요!\n지금 바로 응답하시겠어요?`,
        links: [
          { href: '/clubs', label: '클럽 모임 보기' },
        ],
      },
    ],
  },
  'tournament-registration': {
    title: '대회 참가 신청',
    messages: [
      { role: 'user', content: '마포구청장기 테니스 대회 신청하고 싶어' },
      {
        role: 'assistant',
        content: `마포구청장기 테니스 대회 참가 신청을 도와드릴게요! ✍️\n\n**마포구청장기 테니스 대회**\n📅 2025년 3월 22일 (토) 09:00\n📍 마포 테니스장\n💰 참가비: 30,000원 (계좌이체)\n\n아래 부서 중 어디에 신청하시겠어요?\n\n1️⃣ 일반부 단식 (남자)\n2️⃣ 일반부 단식 (여자)\n3️⃣ 혼합 복식\n4️⃣ 35세 이상 시니어 단식\n\n번호를 입력하거나 직접 부서명을 말씀해 주세요.\n("취소"를 입력하면 신청을 중단합니다)`,
      },
      { role: 'user', content: '1번으로 할게' },
      {
        role: 'assistant',
        content: `일반부 단식 (남자) 선택하셨습니다! 👍\n\n신청 전 아래 정보를 확인해 주세요:\n\n📋 **신청 정보**\n• 대회: 마포구청장기 테니스 대회\n• 부서: 일반부 단식 (남자)\n• 참가비: 30,000원\n• 입금 계좌: 국민은행 123-456-789012 (마포구테니스협회)\n\n✅ 위 내용으로 신청을 진행할까요?\n"확인" 입력 시 신청이 완료됩니다.`,
        links: [
          { href: '/tournaments', label: '대회 상세 보기' },
        ],
      },
    ],
  },
}

function ChatDemoContent() {
  const params = useSearchParams()
  const type = params.get('type') ?? 'tournament-search'
  const scenario = DEMO_SCENARIOS[type]

  if (!scenario) return null

  return (
    <div className="fixed inset-0 flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* 헤더 */}
      <div
        className="shrink-0 flex items-center justify-between px-4 h-14 border-b"
        style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}
      >
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5" style={{ color: 'var(--accent-color)' }} aria-hidden="true" />
          <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>AI 어시스턴트</span>
        </div>
      </div>

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto" role="log" aria-label="대화 내용">
        <div className="max-w-[1920px] mx-auto px-4 py-6 space-y-5">
          {scenario.messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'user' ? (
                <div
                  className="rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%]"
                  style={{ backgroundColor: 'var(--accent-color)', color: 'var(--bg-primary)' }}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-line">{msg.content}</p>
                </div>
              ) : (
                <div
                  className="rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] space-y-3"
                  style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--text-primary)' }}>
                    {msg.content}
                  </p>
                  {msg.links && msg.links.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
                      {msg.links.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-opacity hover:opacity-80"
                          style={{ backgroundColor: 'var(--accent-color)', color: 'var(--bg-primary)' }}
                        >
                          {link.label}
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 입력창 (비활성) */}
      <div className="shrink-0 border-t" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
        <div className="max-w-[1920px] mx-auto px-4 py-3">
          <div
            className="relative rounded-2xl"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
          >
            <div className="flex items-center px-4 py-3">
              <input
                type="text"
                placeholder="메시지를 입력하세요..."
                readOnly
                className="flex-1 bg-transparent outline-none text-base"
                style={{ color: 'var(--text-muted)' }}
              />
              <button
                type="button"
                disabled
                className="ml-3 p-2 rounded-xl opacity-40"
                style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-muted)' }}
                aria-label="전송"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ScreenshotDemoPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound()
  }
  return (
    <Suspense>
      <ChatDemoContent />
    </Suspense>
  )
}
