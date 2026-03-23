import { NextResponse } from 'next/server'
import { sendLessonApplyAlimtalk, sendLessonApplyToCoachAlimtalk, sendAdminLessonNotification } from '@/lib/solapi/alimtalk'

export async function GET() {
  const days = ['일','월','화','수','목','금','토']
  const startDate = new Date('2026-04-01T00:00:00')
  const lessonStartDate = `${startDate.getMonth()+1}/${startDate.getDate()}(${days[startDate.getDay()]})`
  const lessonDays = '월, 수 주2회'
  const lessonInfo = '강한 코치 레슨 · 강한 코치'

  const r1 = await sendLessonApplyAlimtalk({
    phone: '01085891858',
    customerName: '허정학',
    lessonName: '강한 코치 레슨',
    coachName: '강한',
    lessonStartDate,
    lessonInfo,
    lessonDays,
    venue: '망원 한강공원 테니스장',
  })

  const r2 = await sendLessonApplyToCoachAlimtalk({
    coachPhone: '01067101748',
    customerName: '허정학',
    customerPhone: '01085891858',
    lessonStartDate: lessonInfo,
    lessonDays: '-',
  })

  const r3 = await sendAdminLessonNotification({
    customerName: '허정학',
    customerPhone: '01085891858',
    lessonStartDate: lessonInfo,
    lessonDays: '-',
  })

  return NextResponse.json({ 고객: r1, 코치: r2, 관리자: r3 })
}
