import { NextResponse } from 'next/server'
import { createLessonInquiry } from '@/lib/lessons/slot-actions'

// 테스트용 (삭제 예정)
export async function GET() {
  const result = await createLessonInquiry({
    coachId: '486c5090-13a5-458e-b848-236e95258d66', // 강한 코치
    name: '허정학',
    phone: '01085891858',
    message: '알림톡 발송 테스트입니다.',
    preferredDays: ['월', '수'],
    preferredTime: '09:00~11:00',
  })
  return NextResponse.json(result)
}
