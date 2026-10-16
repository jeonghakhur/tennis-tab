/**
 * 업로드 파일 검증 — 서버(서명 URL 발급)와 클라이언트(사전 검증)에서 공용
 * 순수 함수라 'use server' 파일과 분리
 */

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
export const DOCUMENT_TYPES = [
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
] as const
export const DOCUMENT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.hwp'] as const

/** 업로드 최종 상한 — Storage 버킷 file_size_limit(10MB)과 동일 */
export const MAX_UPLOAD_SIZE = 10 * 1024 * 1024

/** 서명 URL 발급을 허용하는 버킷 — 임의 버킷 업로드 차단 */
export const ALLOWED_BUCKETS = ['posts', 'tournaments', 'coaches'] as const
export type UploadBucket = (typeof ALLOWED_BUCKETS)[number]

export type UploadKind = 'image' | 'document'

export interface UploadFileMeta {
  name: string
  type: string
  size: number
}

export function getFileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  if (dot <= 0 || dot === name.length - 1) return ''
  return name.slice(dot).toLowerCase()
}

/**
 * 파일 종류 판별 — MIME 우선, 문서는 확장자 폴백 (hwp 등 브라우저가 MIME를 못 주는 경우)
 * application/octet-stream은 MIME만으로 신뢰하지 않고 확장자가 문서일 때만 허용 (.exe 등 차단)
 */
export function getUploadKind(file: UploadFileMeta): UploadKind | null {
  if ((IMAGE_TYPES as readonly string[]).includes(file.type)) return 'image'
  const ext = getFileExtension(file.name)
  const extIsDocument = (DOCUMENT_EXTENSIONS as readonly string[]).includes(ext)
  const mimeIsDocument =
    file.type !== 'application/octet-stream' &&
    (DOCUMENT_TYPES as readonly string[]).includes(file.type)
  if (mimeIsDocument || extIsDocument) return 'document'
  return null
}

/**
 * 업로드 파일 검증 — 통과하면 null, 실패하면 사용자용 에러 메시지
 * @param imagesOnly true면 이미지만 허용 (포스터·프로필 등)
 */
export function validateUploadFile(
  file: UploadFileMeta,
  options: { imagesOnly?: boolean } = {}
): string | null {
  const kind = getUploadKind(file)
  if (!kind) {
    return '지원하지 않는 파일 형식입니다. (이미지: JPG/PNG/WebP/GIF, 문서: PDF/Word/Excel/PPT/HWP)'
  }
  if (options.imagesOnly && kind !== 'image') {
    return 'JPG, PNG, WebP, GIF 형식만 지원됩니다.'
  }
  if (file.size > MAX_UPLOAD_SIZE) {
    return '파일 크기는 10MB 이하여야 합니다.'
  }
  return null
}

export function isAllowedBucket(bucket: string): bucket is UploadBucket {
  return (ALLOWED_BUCKETS as readonly string[]).includes(bucket)
}

/** 폴더명은 영문 소문자·숫자·하이픈·언더스코어만 (경로 조작 방지) */
export function isSafeFolder(folder: string): boolean {
  return /^[a-z0-9_-]{1,40}$/.test(folder)
}
