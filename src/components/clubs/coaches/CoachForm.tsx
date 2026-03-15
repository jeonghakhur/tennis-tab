'use client'

import { useState, useRef, useCallback } from 'react'
import { X } from 'lucide-react'
import { Modal } from '@/components/common/Modal'
import { AlertDialog } from '@/components/common/AlertDialog'
import type { Coach, CreateCoachInput } from '@/lib/lessons/types'

interface CoachFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateCoachInput) => Promise<{ error: string | null }>
  /** 수정 시 기존 데이터 */
  initialData?: Coach
}

export function CoachForm({ isOpen, onClose, onSubmit, initialData }: CoachFormProps) {
  const isEdit = !!initialData

  const [name, setName] = useState(initialData?.name || '')
  const [bio, setBio] = useState(initialData?.bio || '')
  const [experience, setExperience] = useState(initialData?.experience || '')
  const [certifications, setCertifications] = useState<string[]>(initialData?.certifications || [])
  const [certInput, setCertInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })

  const nameRef = useRef<HTMLInputElement>(null)

  const handleAddCert = useCallback(() => {
    const trimmed = certInput.trim()
    if (!trimmed) return
    if (certifications.includes(trimmed)) return
    setCertifications((prev) => [...prev, trimmed])
    setCertInput('')
  }, [certInput, certifications])

  const handleRemoveCert = (cert: string) => {
    setCertifications((prev) => prev.filter((c) => c !== cert))
  }

  const handleCertKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddCert()
    }
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
      bio: bio.trim() || undefined,
      experience: experience.trim() || undefined,
      certifications: certifications.length > 0 ? certifications : undefined,
    })
    setSubmitting(false)

    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }

    // 성공 → 폼 초기화 후 닫기
    resetForm()
    onClose()
  }

  const resetForm = () => {
    if (!isEdit) {
      setName('')
      setBio('')
      setExperience('')
      setCertifications([])
      setCertInput('')
    }
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={isEdit ? '코치 수정' : '코치 등록'}
        size="md"
      >
        <form onSubmit={handleSubmit} noValidate>
          <Modal.Body>
            <div className="space-y-4">
              {/* 이름 */}
              <div>
                <label
                  htmlFor="coach-name"
                  className="block text-sm font-medium mb-1"
                  style={{ color: 'var(--text-primary)' }}
                >
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
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                  }}
                />
              </div>

              {/* 소개 */}
              <div>
                <label
                  htmlFor="coach-bio"
                  className="block text-sm font-medium mb-1"
                  style={{ color: 'var(--text-primary)' }}
                >
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
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                  }}
                />
              </div>

              {/* 경력 */}
              <div>
                <label
                  htmlFor="coach-experience"
                  className="block text-sm font-medium mb-1"
                  style={{ color: 'var(--text-primary)' }}
                >
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
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                  }}
                />
              </div>

              {/* 자격증 */}
              <div>
                <label
                  htmlFor="coach-cert"
                  className="block text-sm font-medium mb-1"
                  style={{ color: 'var(--text-primary)' }}
                >
                  자격증 <span className="font-normal text-xs" style={{ color: 'var(--text-muted)' }}>(엔터로 추가)</span>
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
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddCert}
                    className="px-3 py-2 rounded-lg text-sm font-medium"
                    style={{
                      backgroundColor: 'var(--bg-card-hover)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    추가
                  </button>
                </div>
                {certifications.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {certifications.map((cert) => (
                      <span
                        key={cert}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md"
                        style={{
                          backgroundColor: 'var(--bg-card-hover)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {cert}
                        <button
                          type="button"
                          onClick={() => handleRemoveCert(cert)}
                          className="hover:opacity-70"
                          aria-label={`${cert} 자격증 제거`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Modal.Body>

          <Modal.Footer>
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
              disabled={submitting}
              className="flex-1 btn-primary btn-sm"
            >
              {submitting ? '처리 중...' : isEdit ? '수정하기' : '등록하기'}
            </button>
          </Modal.Footer>
        </form>
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
