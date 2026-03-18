'use client'

import { useState, useRef, useCallback } from 'react'
import { X, Upload, User, FileText, Loader2 } from 'lucide-react'
import { Modal } from '@/components/common/Modal'
import { AlertDialog } from '@/components/common/AlertDialog'
import { uploadImage, uploadFile } from '@/lib/storage/actions'
import type { Coach, CreateCoachInput } from '@/lib/lessons/types'

interface CoachFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateCoachInput) => Promise<{ error: string | null }>
  /** 수정 시 기존 데이터 */
  initialData?: Coach
  /** 삭제 콜백 (수정 모드에서만) */
  onDelete?: () => void
}

export function CoachForm({ isOpen, onClose, onSubmit, initialData, onDelete }: CoachFormProps) {
  const isEdit = !!initialData

  const [name, setName] = useState(initialData?.name || '')
  const [phone, setPhone] = useState(initialData?.phone || '')
  const [bio, setBio] = useState(initialData?.bio || '')
  const [experience, setExperience] = useState(initialData?.experience || '')
  const [lessonLocation, setLessonLocation] = useState(initialData?.lesson_location || '')
  const [certifications, setCertifications] = useState<string[]>(initialData?.certifications || [])
  const [certInput, setCertInput] = useState('')
  const [certificationFiles, setCertificationFiles] = useState<string[]>(initialData?.certification_files || [])
  const [profileImageUrl, setProfileImageUrl] = useState<string>(initialData?.profile_image_url || '')
  const [submitting, setSubmitting] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadingCert, setUploadingCert] = useState(false)
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })

  const nameRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const certFileInputRef = useRef<HTMLInputElement>(null)

  // ── 프로필 이미지 업로드 ──────────────────────────────────────────────────
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingImage(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('bucket', 'coaches')
    formData.append('folder', 'profiles')

    const { url, error } = await uploadImage(formData)
    setUploadingImage(false)

    if (error || !url) {
      setAlert({ isOpen: true, message: error || '이미지 업로드에 실패했습니다.', type: 'error' })
      return
    }
    setProfileImageUrl(url)
    // input 초기화 (같은 파일 재선택 허용)
    e.target.value = ''
  }

  // ── 자격증 파일 업로드 ────────────────────────────────────────────────────
  const handleCertFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setUploadingCert(true)
    const uploaded: string[] = []

    for (const file of files) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('bucket', 'coaches')
      formData.append('folder', 'certifications')

      const { url, error } = await uploadFile(formData)
      if (error || !url) {
        setAlert({ isOpen: true, message: `${file.name}: ${error || '업로드 실패'}`, type: 'error' })
        continue
      }
      uploaded.push(url)
    }

    setUploadingCert(false)
    if (uploaded.length > 0) {
      setCertificationFiles((prev) => [...prev, ...uploaded])
    }
    e.target.value = ''
  }

  const handleAddCert = useCallback(() => {
    const trimmed = certInput.trim()
    if (!trimmed || certifications.includes(trimmed)) return
    setCertifications((prev) => [...prev, trimmed])
    setCertInput('')
  }, [certInput, certifications])

  const handleCertKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAddCert() }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim() || name.trim().length < 2) {
      setAlert({ isOpen: true, message: '코치 이름은 2자 이상이어야 합니다.', type: 'error' })
      return
    }

    setSubmitting(true)
    const result = await onSubmit({
      name: name.trim(),
      phone: phone.trim() || undefined,
      bio: bio.trim() || undefined,
      experience: experience.trim() || undefined,
      lesson_location: lessonLocation.trim() || undefined,
      certifications: certifications.length > 0 ? certifications : undefined,
      certification_files: certificationFiles.length > 0 ? certificationFiles : undefined,
      profile_image_url: profileImageUrl || undefined,
    })
    setSubmitting(false)

    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }

    resetForm()
    onClose()
  }

  const resetForm = () => {
    if (!isEdit) {
      setName('')
      setPhone('')
      setBio('')
      setExperience('')
      setLessonLocation('')
      setCertifications([])
      setCertInput('')
      setCertificationFiles([])
      setProfileImageUrl('')
    }
  }

  const inputStyle = {
    backgroundColor: 'var(--bg-input)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
  }

  /** 파일 URL에서 원본 파일명 추출 */
  const getFileName = (url: string) => {
    try {
      const parts = decodeURIComponent(new URL(url).pathname).split('/')
      const raw = parts[parts.length - 1]
      // "timestamp-random.ext" → "ext" 만 보여주거나 원본명이 있으면 그것을 사용
      return raw
    } catch {
      return url.split('/').pop() || '파일'
    }
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={isEdit ? '코치 수정' : '코치 등록'}
        size="lg"
      >
        <Modal.Body>
          <form id="coach-form" onSubmit={handleSubmit} noValidate>
            <div className="space-y-5">

              {/* 프로필 이미지 업로드 */}
              <div>
                <p className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  프로필 사진
                </p>
                <div className="flex items-center gap-4">
                  {/* 미리보기 */}
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center shrink-0 overflow-hidden"
                    style={{ backgroundColor: 'var(--bg-card-hover)' }}
                  >
                    {profileImageUrl ? (
                      <img
                        src={profileImageUrl}
                        alt="프로필 미리보기"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-7 h-7" style={{ color: 'var(--text-muted)' }} />
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg"
                      style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}
                    >
                      {uploadingImage
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Upload className="w-3.5 h-3.5" />
                      }
                      {uploadingImage ? '업로드 중...' : '사진 업로드'}
                    </button>
                    {profileImageUrl && (
                      <button
                        type="button"
                        onClick={() => setProfileImageUrl('')}
                        className="text-sm text-left"
                        style={{ color: 'var(--color-danger)' }}
                      >
                        사진 제거
                      </button>
                    )}
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      JPG, PNG, WebP · 최대 10MB
                    </p>
                  </div>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageUpload}
                    className="hidden"
                    aria-label="프로필 사진 업로드"
                  />
                </div>
              </div>

              {/* 이름 */}
              <div>
                <label htmlFor="coach-name" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                  이름 <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  ref={nameRef}
                  id="coach-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="코치 이름"
                  maxLength={50}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={inputStyle}
                />
              </div>

              {/* 연락처 */}
              <div>
                <label htmlFor="coach-phone" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                  연락처 <span className="font-normal text-sm" style={{ color: 'var(--text-muted)' }}>(레슨 안내 페이지 노출)</span>
                </label>
                <input
                  id="coach-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="010-0000-0000"
                  maxLength={20}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={inputStyle}
                />
              </div>

              {/* 레슨 장소 */}
              <div>
                <label htmlFor="coach-location" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                  레슨 장소
                </label>
                <input
                  id="coach-location"
                  type="text"
                  value={lessonLocation}
                  onChange={(e) => setLessonLocation(e.target.value)}
                  placeholder="예: 망원한강공원 테니스장 3번 코트"
                  maxLength={200}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={inputStyle}
                />
              </div>

              {/* 소개 */}
              <div>
                <label htmlFor="coach-bio" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                  소개
                </label>
                <textarea
                  id="coach-bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="코치 소개"
                  rows={3}
                  maxLength={500}
                  className="w-full px-3 py-2 rounded-lg text-sm resize-none"
                  style={inputStyle}
                />
              </div>

              {/* 경력 */}
              <div>
                <label htmlFor="coach-experience" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                  경력
                </label>
                <input
                  id="coach-experience"
                  type="text"
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  placeholder="예: 10년, KTA 공인 코치"
                  maxLength={200}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={inputStyle}
                />
              </div>

              {/* 자격증 (텍스트) */}
              <div>
                <label htmlFor="coach-cert" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                  자격증명 <span className="font-normal text-sm" style={{ color: 'var(--text-muted)' }}>(엔터로 추가)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    id="coach-cert"
                    type="text"
                    value={certInput}
                    onChange={(e) => setCertInput(e.target.value)}
                    onKeyDown={handleCertKeyDown}
                    placeholder="자격증명 입력"
                    maxLength={50}
                    className="flex-1 px-3 py-2 rounded-lg text-sm"
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={handleAddCert}
                    className="px-3 py-2 rounded-lg text-sm font-medium"
                    style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-primary)' }}
                  >
                    추가
                  </button>
                </div>
                {certifications.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {certifications.map((cert) => (
                      <span
                        key={cert}
                        className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded-md"
                        style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-primary)' }}
                      >
                        {cert}
                        <button
                          type="button"
                          onClick={() => setCertifications((prev) => prev.filter((c) => c !== cert))}
                          className="hover:opacity-70"
                          aria-label={`${cert} 제거`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 자격증 파일 첨부 */}
              <div>
                <p className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  자격증 첨부파일
                  <span className="font-normal text-sm ml-1" style={{ color: 'var(--text-muted)' }}>
                    (PDF, 이미지 등 · 복수 선택 가능)
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => certFileInputRef.current?.click()}
                  disabled={uploadingCert}
                  className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg"
                  style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}
                >
                  {uploadingCert
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <FileText className="w-3.5 h-3.5" />
                  }
                  {uploadingCert ? '업로드 중...' : '파일 선택'}
                </button>
                <input
                  ref={certFileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                  multiple
                  onChange={handleCertFileUpload}
                  className="hidden"
                  aria-label="자격증 파일 업로드"
                />
                {certificationFiles.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {certificationFiles.map((url, idx) => (
                      <div
                        key={url}
                        className="flex items-center justify-between text-sm px-3 py-2 rounded-lg"
                        style={{ backgroundColor: 'var(--bg-card-hover)' }}
                      >
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate hover:underline flex items-center gap-1"
                          style={{ color: 'var(--accent-color)', maxWidth: '80%' }}
                        >
                          <FileText className="w-3 h-3 shrink-0" />
                          {getFileName(url)}
                        </a>
                        <button
                          type="button"
                          onClick={() => setCertificationFiles((prev) => prev.filter((_, i) => i !== idx))}
                          className="shrink-0 hover:opacity-70 ml-2"
                          aria-label="파일 제거"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </form>
        </Modal.Body>

        <Modal.Footer>
          {isEdit && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ backgroundColor: 'var(--color-danger-subtle)', color: 'var(--color-danger)' }}
            >
              삭제
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          >
            취소
          </button>
          <button
            type="submit"
            form="coach-form"
            disabled={submitting || uploadingImage || uploadingCert}
            className="flex-1 btn-primary btn-sm"
          >
            {submitting ? '처리 중...' : isEdit ? '수정하기' : '등록하기'}
          </button>
        </Modal.Footer>
      </Modal>

      <AlertDialog
        isOpen={alert.isOpen}
        onClose={() => {
          setAlert({ ...alert, isOpen: false })
          nameRef.current?.focus()
        }}
        title="오류"
        message={alert.message}
        type={alert.type}
      />
    </>
  )
}
