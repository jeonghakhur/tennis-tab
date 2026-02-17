// 1:1 문의 관련 타입

export type InquiryCategory = 'SERVICE' | 'TOURNAMENT' | 'ACCOUNT' | 'ETC'
export type InquiryStatus = 'PENDING' | 'IN_PROGRESS' | 'RESOLVED'

export const INQUIRY_CATEGORY_LABELS: Record<InquiryCategory, string> = {
  SERVICE: '서비스 이용',
  TOURNAMENT: '대회 관련',
  ACCOUNT: '계정/인증',
  ETC: '기타',
}

export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  PENDING: '대기중',
  IN_PROGRESS: '처리중',
  RESOLVED: '완료',
}

export interface Inquiry {
  id: string
  category: InquiryCategory
  title: string
  content: string
  author_id: string
  status: InquiryStatus
  reply_content: string | null
  reply_by: string | null
  replied_at: string | null
  created_at: string
  updated_at: string
  // JOIN 결과
  author?: { name: string; email: string }
  replier?: { name: string }
}

export interface CreateInquiryInput {
  category: InquiryCategory
  title: string
  content: string
}

export interface ReplyInquiryInput {
  inquiry_id: string
  reply_content: string
}
