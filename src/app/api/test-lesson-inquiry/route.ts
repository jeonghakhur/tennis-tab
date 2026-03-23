import { NextResponse } from 'next/server'
import { sendLessonReservationAlimtalk, sendAdminLessonNotification } from '@/lib/solapi/alimtalk'

// 테스트용 (삭제 예정)
export async function GET() {
  // 코치 알림톡 직접 테스트
  const coachResult = await sendLessonReservationAlimtalk({
    coachPhone: '01067101748', // 강한 코치
    customerName: '허정학',
    customerPhone: '01085891858',
    lessonStartDate: '09:00~11:00',
    lessonDays: '월, 수',
  })

  // 관리자 알림톡 직접 테스트
  const adminResult = await sendAdminLessonNotification({
    customerName: '허정학',
    customerPhone: '01085891858',
    lessonStartDate: '09:00~11:00',
    lessonDays: '월, 수',
  })

  return NextResponse.json({
    coachResult,
    adminResult,
    adminPhone: process.env.ADMIN_PHONE_NUMBER,
    hasTemplate: !!process.env.SOLAPI_TEMPLATE_LESSON_RESERVATION,
    hasCoachTemplate: !!process.env.SOLAPI_TEMPLATE_LESSON_APPLY_COACH,
  })
}
