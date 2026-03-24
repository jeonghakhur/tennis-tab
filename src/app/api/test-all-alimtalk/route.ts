import { NextResponse } from 'next/server'
import { sendLessonApplyAlimtalk, sendLessonApplyToCoachAlimtalk, sendAdminLessonNotification, sendLessonConfirmAlimtalk } from '@/lib/solapi/alimtalk'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'apply'

  const days = ['일','월','화','수','목','금','토']
  const startDate = new Date('2026-04-01T00:00:00')
  const lessonStartDate = `${startDate.getMonth()+1}/${startDate.getDate()}(${days[startDate.getDay()]}) 09:00`
  const lessonDays = '월, 수 주2회'

  if (type === 'apply') {
    // 플랜 신청 알림 3개
    const r1 = await sendLessonApplyAlimtalk({
      phone: '01085891858',
      customerName: '허정학',
      lessonName: '강한 코치 레슨',
      coachName: '강한',
      lessonStartDate,
      lessonInfo: '강한 코치 레슨',
      lessonDays,
      venue: '망원나들목 4번 코트',
    })
    const r2 = await sendLessonApplyToCoachAlimtalk({
      coachPhone: '01085891858',
      customerName: '허정학',
      customerPhone: '01085891858',
      lessonStartDate,
      lessonDays,
    })
    const r3 = await sendAdminLessonNotification({
      customerName: '허정학',
      customerPhone: '01085891858',
      lessonStartDate,
      lessonDays,
    })
    return NextResponse.json({ type: 'apply', 고객: r1, 코치: r2, 관리자: r3 })
  }

  if (type === 'confirm') {
    // 레슨 확정 알림
    const r1 = await sendLessonConfirmAlimtalk({
      customerPhone: '01085891858',
      customerName: '허정학',
      bankInfo: '국민은행 123-456-789 마포구테니스협회',
      lessonStartDate,
      lessonInfo: '주2회 8회 패키지 (30분)',
      lessonDays,
    })
    return NextResponse.json({ type: 'confirm', 고객: r1 })
  }

  return NextResponse.json({ error: 'type=apply or confirm' })
}
