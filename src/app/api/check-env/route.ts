// 환경변수 확인용 (임시)
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    hasApiKey: !!process.env.SOLAPI_API_KEY,
    hasApiSecret: !!process.env.SOLAPI_API_SECRET,
    hasPfId: !!process.env.SOLAPI_PFID,
    hasSender: !!process.env.SOLAPI_SENDER_NUMBER,
    pfId: process.env.SOLAPI_PFID,
    sender: process.env.SOLAPI_SENDER_NUMBER,
  })
}
