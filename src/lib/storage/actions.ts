'use server'

import { createAdminClient } from '@/lib/supabase/admin'

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

  if (file.size > 5 * 1024 * 1024) {
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
      console.error('Upload error:', uploadError)
      return { url: null, error: uploadError.message }
    }

    // 공개 URL 가져오기
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(fileName)

    return { url: publicUrl, error: null }
  } catch (err: any) {
    console.error('Upload error:', err)
    return { url: null, error: err.message || '업로드에 실패했습니다.' }
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
      console.error('Delete error:', error)
      return { error: error.message }
    }

    return { error: null }
  } catch (err: any) {
    console.error('Delete error:', err)
    return { error: err.message || '삭제에 실패했습니다.' }
  }
}
