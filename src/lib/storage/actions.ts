'use server'

import { createAdminClient } from '@/lib/supabase/admin'

// 에러 메시지 추출 헬퍼
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return '알 수 없는 오류가 발생했습니다.'
}

export async function uploadImage(
  formData: FormData
): Promise<{ url: string | null; error: string | null }> {
  const file = formData.get('file') as File
  const bucket = formData.get('bucket') as string || 'tournaments'
  const folder = formData.get('folder') as string || 'posters'

  if (!file) {
    return { url: null, error: '파일이 없습니다.' }
  }

  // 파일 유효성 검사
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    return { url: null, error: 'JPG, PNG, WebP, GIF 형식만 지원됩니다.' }
  }

  const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
  if (file.size > MAX_FILE_SIZE) {
    return { url: null, error: '파일 크기는 5MB 이하여야 합니다.' }
  }

  try {
    const supabaseAdmin = createAdminClient()

    // 파일 이름 생성
    const fileExt = file.name.split('.').pop()
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`

    // ArrayBuffer로 변환
    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    // 업로드
    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(fileName, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      return { url: null, error: uploadError.message }
    }

    // 공개 URL 가져오기
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(fileName)

    return { url: publicUrl, error: null }
  } catch (err: unknown) {
    return { url: null, error: getErrorMessage(err) }
  }
}

// 이미지 + 문서 파일 업로드 (커뮤니티 포스트 등에서 사용)
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const DOCUMENT_TYPES = [
  'application/pdf',                                                             // .pdf
  'application/msword',                                                          // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',      // .docx
  'application/vnd.ms-excel',                                                    // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',           // .xlsx
  'application/vnd.ms-powerpoint',                                               // .ppt
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',   // .pptx
  'application/x-hwp',                                                           // .hwp
  'application/haansofthwp',                                                     // .hwp (대체)
  'application/octet-stream',                                                    // .hwp (브라우저 폴백)
]
const DOCUMENT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.hwp']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export async function uploadFile(
  formData: FormData
): Promise<{ url: string | null; error: string | null }> {
  const file = formData.get('file') as File
  const bucket = (formData.get('bucket') as string) || 'posts'
  const folder = (formData.get('folder') as string) || 'attachments'

  if (!file) {
    return { url: null, error: '파일이 없습니다.' }
  }

  // 확장자 추출
  const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '')
  const isImage = IMAGE_TYPES.includes(file.type)
  const isDocument = DOCUMENT_TYPES.includes(file.type) || DOCUMENT_EXTENSIONS.includes(ext)

  if (!isImage && !isDocument) {
    return {
      url: null,
      error: '지원하지 않는 파일 형식입니다. (이미지: JPG/PNG/WebP/GIF, 문서: PDF/Word/Excel/PPT/HWP)',
    }
  }

  if (file.size > MAX_FILE_SIZE) {
    return { url: null, error: '파일 크기는 10MB 이하여야 합니다.' }
  }

  try {
    const supabaseAdmin = createAdminClient()
    const fileExt = file.name.split('.').pop()
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(fileName, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      return { url: null, error: uploadError.message }
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(fileName)

    return { url: publicUrl, error: null }
  } catch (err: unknown) {
    return { url: null, error: getErrorMessage(err) }
  }
}

export async function deleteImage(
  url: string,
  bucket: string = 'tournaments'
): Promise<{ error: string | null }> {
  try {
    const supabaseAdmin = createAdminClient()

    // URL에서 파일 경로 추출
    const urlObj = new URL(url)
    const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)/)

    if (!pathMatch) {
      return { error: '잘못된 파일 URL입니다.' }
    }

    const filePath = pathMatch[1]

    const { error } = await supabaseAdmin.storage
      .from(bucket)
      .remove([filePath])

    if (error) {
      return { error: error.message }
    }

    return { error: null }
  } catch (err: unknown) {
    return { error: getErrorMessage(err) }
  }
}
