import { describe, it, expect } from 'vitest'
import {
  shouldCompressImage,
  calcScaledSize,
  toWebpFileName,
  IMAGE_COMPRESS_PRESETS,
  MAX_RAW_IMAGE_SIZE,
  MAX_UPLOAD_SIZE,
} from '../imageCompress'

describe('shouldCompressImage', () => {
  it('JPEG/PNG/WebP는 압축 대상', () => {
    expect(shouldCompressImage({ type: 'image/jpeg' })).toBe(true)
    expect(shouldCompressImage({ type: 'image/png' })).toBe(true)
    expect(shouldCompressImage({ type: 'image/webp' })).toBe(true)
  })

  it('GIF(애니메이션 보호)·문서·빈 타입은 제외', () => {
    expect(shouldCompressImage({ type: 'image/gif' })).toBe(false)
    expect(shouldCompressImage({ type: 'application/pdf' })).toBe(false)
    expect(shouldCompressImage({ type: '' })).toBe(false)
  })
})

describe('calcScaledSize', () => {
  it('maxWidth 이하면 그대로 (확대 없음)', () => {
    expect(calcScaledSize(800, 600, 1200)).toEqual({ width: 800, height: 600 })
    expect(calcScaledSize(1200, 900, 1200)).toEqual({ width: 1200, height: 900 })
  })

  it('maxWidth 초과 시 비율 유지 축소', () => {
    expect(calcScaledSize(4000, 3000, 1200)).toEqual({ width: 1200, height: 900 })
    expect(calcScaledSize(3001, 2000, 1500)).toEqual({ width: 1500, height: 1000 })
  })

  it('세로 사진도 가로 기준으로만 축소', () => {
    expect(calcScaledSize(3000, 4000, 1600)).toEqual({ width: 1600, height: 2133 })
  })
})

describe('toWebpFileName', () => {
  it('확장자를 .webp로 교체', () => {
    expect(toWebpFileName('photo.JPG')).toBe('photo.webp')
    expect(toWebpFileName('a.b.png')).toBe('a.b.webp')
  })

  it('확장자가 없으면 덧붙임', () => {
    expect(toWebpFileName('photo')).toBe('photo.webp')
  })
})

describe('상수', () => {
  it('프리셋은 모두 0<quality<=1, maxWidth>0', () => {
    for (const p of Object.values(IMAGE_COMPRESS_PRESETS)) {
      expect(p.quality).toBeGreaterThan(0)
      expect(p.quality).toBeLessThanOrEqual(1)
      expect(p.maxWidth).toBeGreaterThan(0)
    }
  })

  it('원본 허용 상한은 업로드 상한보다 크다 (압축 후 검증 전제)', () => {
    expect(MAX_RAW_IMAGE_SIZE).toBeGreaterThan(MAX_UPLOAD_SIZE)
  })
})
