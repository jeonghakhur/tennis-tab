import { describe, it, expect } from 'vitest'
import {
  getUploadKind,
  validateUploadFile,
  isAllowedBucket,
  isSafeFolder,
  getFileExtension,
  MAX_UPLOAD_SIZE,
} from '../validation'

const img = (over: Partial<{ name: string; type: string; size: number }> = {}) => ({
  name: 'a.jpg', type: 'image/jpeg', size: 1000, ...over,
})

describe('getUploadKind', () => {
  it('이미지 MIME → image', () => {
    expect(getUploadKind(img())).toBe('image')
    expect(getUploadKind(img({ type: 'image/gif' }))).toBe('image')
  })
  it('문서 MIME 또는 확장자 폴백 → document (hwp octet-stream)', () => {
    expect(getUploadKind({ name: 'x.pdf', type: 'application/pdf', size: 1 })).toBe('document')
    expect(getUploadKind({ name: 'x.hwp', type: 'application/octet-stream', size: 1 })).toBe('document')
    expect(getUploadKind({ name: 'x.hwp', type: '', size: 1 })).toBe('document')
  })
  it('그 외 → null (octet-stream이라도 확장자가 문서가 아니면 거부)', () => {
    expect(getUploadKind({ name: 'x.exe', type: 'application/octet-stream', size: 1 })).toBeNull()
    expect(getUploadKind({ name: 'x.svg', type: 'image/svg+xml', size: 1 })).toBeNull()
  })
})

describe('validateUploadFile', () => {
  it('정상 파일은 null', () => {
    expect(validateUploadFile(img())).toBeNull()
  })
  it('10MB 초과는 에러', () => {
    expect(validateUploadFile(img({ size: MAX_UPLOAD_SIZE + 1 }))).toContain('10MB')
    expect(validateUploadFile(img({ size: MAX_UPLOAD_SIZE }))).toBeNull()
  })
  it('imagesOnly면 문서 거부', () => {
    const doc = { name: 'x.pdf', type: 'application/pdf', size: 1 }
    expect(validateUploadFile(doc)).toBeNull()
    expect(validateUploadFile(doc, { imagesOnly: true })).not.toBeNull()
  })
})

describe('bucket/folder 가드', () => {
  it('허용 버킷만 통과', () => {
    expect(isAllowedBucket('posts')).toBe(true)
    expect(isAllowedBucket('coaches')).toBe(true)
    expect(isAllowedBucket('private')).toBe(false)
  })
  it('폴더는 영문소문자·숫자·-_만, 경로 구분자 거부', () => {
    expect(isSafeFolder('images')).toBe(true)
    expect(isSafeFolder('profile_pics-2')).toBe(true)
    expect(isSafeFolder('../etc')).toBe(false)
    expect(isSafeFolder('a/b')).toBe(false)
    expect(isSafeFolder('')).toBe(false)
  })
  it('확장자 추출은 소문자·점 포함', () => {
    expect(getFileExtension('Photo.JPG')).toBe('.jpg')
    expect(getFileExtension('noext')).toBe('')
  })
})
