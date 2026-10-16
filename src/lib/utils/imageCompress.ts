/**
 * 브라우저 이미지 압축 유틸 — 업로드 전 리사이즈 + WebP 변환
 *
 * 왜 클라이언트에서 하나:
 * - Vercel 서버리스 요청 본문 제한(4.5MB)을 피하고 전송량 자체를 줄이기 위해
 * - 서버(sharp)는 원본을 먼저 뭄바이까지 올려야 해서 체감 속도 개선이 없음
 */

export interface ImageCompressOptions {
  /** 최대 가로 px — 넘으면 비율 유지 축소 */
  maxWidth: number
  /** WebP 품질 0~1 */
  quality: number
}

/** 용도별 프리셋 */
export const IMAGE_COMPRESS_PRESETS = {
  /** 대회 포스터·프로필: 카드/상세에서 보는 크기 */
  poster: { maxWidth: 1200, quality: 0.82 },
  /** 게시글 본문 삽입: 포스터보다 크게 보는 경우가 있어 여유 */
  editor: { maxWidth: 1600, quality: 0.82 },
  /** 게시글 첨부: 원본 성격이 강해 덜 줄임 */
  attachment: { maxWidth: 2000, quality: 0.85 },
} as const satisfies Record<string, ImageCompressOptions>

/** 압축 전 원본 허용 상한 — 캔버스 메모리 보호용 (이보다 크면 거부) */
export const MAX_RAW_IMAGE_SIZE = 25 * 1024 * 1024
/** 업로드 최종 상한 — Storage 버킷·서버 검증과 동일 */
export const MAX_UPLOAD_SIZE = 10 * 1024 * 1024

const COMPRESSIBLE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/** 압축 대상인지 — GIF는 애니메이션이 깨지므로 제외 */
export function shouldCompressImage(file: { type: string }): boolean {
  return COMPRESSIBLE_TYPES.includes(file.type)
}

/** 최대 가로 기준 비율 유지 축소 크기 계산 (확대는 하지 않음) */
export function calcScaledSize(
  width: number,
  height: number,
  maxWidth: number
): { width: number; height: number } {
  if (width <= maxWidth) return { width, height }
  const scale = maxWidth / width
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  }
}

/** 확장자를 .webp로 교체 (확장자가 없으면 덧붙임) */
export function toWebpFileName(name: string): string {
  return /\.[^./\\]+$/.test(name) ? name.replace(/\.[^./\\]+$/, '.webp') : `${name}.webp`
}

/**
 * 이미지를 WebP로 변환 + 최대 너비 리사이즈 (브라우저 전용)
 * - 압축 대상이 아니거나(GIF 등) 실패하면 원본 그대로 반환
 * - 압축 결과가 원본보다 크면 원본 반환
 */
export async function compressImage(file: File, options: ImageCompressOptions): Promise<File> {
  if (typeof window === 'undefined' || !shouldCompressImage(file)) return file

  return new Promise((resolve) => {
    const img = new window.Image()
    const objectUrl = URL.createObjectURL(file)
    const done = (result: File) => {
      URL.revokeObjectURL(objectUrl)
      resolve(result)
    }

    img.onload = () => {
      const { width, height } = calcScaledSize(img.width, img.height, options.maxWidth)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        done(file)
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            done(file)
            return
          }
          const compressed = new File([blob], toWebpFileName(file.name), { type: 'image/webp' })
          done(compressed.size < file.size ? compressed : file)
        },
        'image/webp',
        options.quality
      )
    }
    img.onerror = () => done(file)
    img.src = objectUrl
  })
}
