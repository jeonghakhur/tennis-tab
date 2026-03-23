import { NextResponse } from 'next/server'
import { sendLessonApplyAlimtalk, sendLessonApplyToCoachAlimtalk, sendAdminLessonNotification } from '@/lib/solapi/alimtalk'

export async function GET() {
  const programTitle = '강한 코치 레슨'
  const coachName = '강한'
  const lessonInfo = `${programTitle} · ${coachName} 코치`

  const customerResult = await sendLessonApplyAlimtalk({
    phone: '01085891858',
    customerName: '허정학',
    lessonName: programTitle,
    coachName,
    lessonStartDate: '-',
    lessonInfo: '-',
    lessonDays: '-',
    venue: '망원 한강공원 테니스장',
  })

  const coachResult = await sendLessonApplyToCoachAlimtalk({
    coachPhone: '01067101748',
    customerName: '허정학',
    customerPhone: '01085891858',
    lessonStartDate: lessonInfo,
    lessonDays: '-',
  })

  const adminResult = await sendAdminLessonNotification({
    customerName: '허정학',
    customerPhone: '01085891858',
    lessonStartDate: lessonInfo,
    lessonDays: '-',
  })

  return NextResponse.json({ customerResult, coachResult, adminResult })
}
