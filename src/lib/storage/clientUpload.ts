'use client'

import { createClient } from '@/lib/supabase/client'
import { createSignedUpload } from './actions'
import { validateUploadFile } from './validation'
import {
  compressImage,
  shouldCompressImage,
  MAX_RAW_IMAGE_SIZE,
  type ImageCompressOptions,
} from '@/lib/utils/imageCompress'

export interface DirectUploadOptions {
  bucket: 'posts' | 'tournaments' | 'coaches'
  folder: string
  /** 이미지만 허용 (포스터·프로필) */
  imagesOnly?: boolean
  /** 지정하면 압축 가능한 이미지(JPEG/PNG/WebP)를 업로드 전에 리사이즈·WebP 변환 */
  compress?: ImageCompressOptions
}

export interface DirectUploadResult {
  url: string | null
  /** 실제 업로드된 파일 (압축됐으면 압축본) — 이름·크기 기록용 */
  file: File
  error: string | null
}

/**
 * 브라우저 → Supabase Storage 직접 업로드
 * 1) (옵션) 클라이언트 압축
 * 2) 서버 액션으로 검증 + 서명 URL 발급 (메타데이터만 전송)
 * 3) 브라우저가 파일 바이트를 Storage로 직접 전송 — Vercel 4.5MB 본문 제한 우회
 */
export async function uploadDirect(
  file: File,
  options: DirectUploadOptions
): Promise<DirectUploadResult> {
  // 압축 전 원본이 지나치게 크면 캔버스 메모리 보호를 위해 거부
  if (options.compress && shouldCompressImage(file) && file.size > MAX_RAW_IMAGE_SIZE) {
    return { url: null, file, error: '이미지 원본이 너무 큽니다. (최대 25MB)' }
  }

  const uploadFile = options.compress ? await compressImage(file, options.compress) : file

  // 서버와 동일한 검증을 먼저 돌려 불필요한 왕복 방지
  const clientError = validateUploadFile(uploadFile, { imagesOnly: options.imagesOnly })
  if (clientError) {
    return { url: null, file: uploadFile, error: clientError }
  }

  const { data, error } = await createSignedUpload({
    bucket: options.bucket,
    folder: options.folder,
    name: uploadFile.name,
    type: uploadFile.type,
    size: uploadFile.size,
    imagesOnly: options.imagesOnly,
  })
  if (error || !data) {
    return { url: null, file: uploadFile, error: error ?? '업로드 URL 발급에 실패했습니다.' }
  }

  const supabase = createClient()
  const { error: uploadError } = await supabase.storage
    .from(options.bucket)
    .uploadToSignedUrl(data.path, data.token, uploadFile, {
      contentType: uploadFile.type || undefined,
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) {
    return { url: null, file: uploadFile, error: uploadError.message }
  }

  return { url: data.publicUrl, file: uploadFile, error: null }
}
