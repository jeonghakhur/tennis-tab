'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient, getUserWithTimeout } from '@/lib/supabase/server'
import {
  validateUploadFile,
  isAllowedBucket,
  isSafeFolder,
  getFileExtension,
  type UploadFileMeta,
} from './validation'

// 에러 메시지 추출 헬퍼
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return '알 수 없는 오류가 발생했습니다.'
}

export interface SignedUploadInput extends UploadFileMeta {
  bucket: string
  folder: string
  /** true면 이미지만 허용 (포스터·프로필) */
  imagesOnly?: boolean
}

export interface SignedUploadData {
  /** 버킷 내 경로 — uploadToSignedUrl에 그대로 전달 */
  path: string
  /** 서명 토큰 (기본 2시간 유효) */
  token: string
  /** 업로드 완료 후 사용할 공개 URL */
  publicUrl: string
}

/**
 * 브라우저 직접 업로드용 서명 URL 발급
 *
 * 파일 바이트는 서버를 거치지 않고 브라우저 → Supabase Storage로 바로 전송된다.
 * - Vercel 서버리스 요청 본문 제한(4.5MB)을 우회
 * - 뭄바이 리전 왕복 1회 절약
 * 서버는 검증(로그인·버킷·폴더·형식·크기)과 경로 생성만 담당한다.
 */
export async function createSignedUpload(
  input: SignedUploadInput
): Promise<{ data: SignedUploadData | null; error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await getUserWithTimeout(supabase, 3000)
    if (!user) {
      return { data: null, error: '로그인이 필요합니다.' }
    }

    if (!isAllowedBucket(input.bucket)) {
      return { data: null, error: '허용되지 않은 저장소입니다.' }
    }
    if (!isSafeFolder(input.folder)) {
      return { data: null, error: '잘못된 폴더 경로입니다.' }
    }

    const validationError = validateUploadFile(input, { imagesOnly: input.imagesOnly })
    if (validationError) {
      return { data: null, error: validationError }
    }

    // 확장자는 검증을 통과한 원본 파일명에서만 추출 (영숫자로 제한)
    const ext = getFileExtension(input.name).replace(/[^a-z0-9.]/g, '')
    const path = `${input.folder}/${Date.now()}-${Math.random().toString(36).substring(2)}${ext}`

    const supabaseAdmin = createAdminClient()
    const { data, error } = await supabaseAdmin.storage
      .from(input.bucket)
      .createSignedUploadUrl(path)

    if (error || !data) {
      return { data: null, error: error?.message ?? '업로드 URL 발급에 실패했습니다.' }
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(input.bucket)
      .getPublicUrl(data.path)

    return { data: { path: data.path, token: data.token, publicUrl }, error: null }
  } catch (err: unknown) {
    return { data: null, error: getErrorMessage(err) }
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
