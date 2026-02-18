'use client'

import { useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { AlertDialog } from '@/components/common/AlertDialog'
import { PostAttachments } from '@/components/community/PostAttachments'
import {
  validatePostInput,
  hasValidationErrors,
  type PostValidationErrors,
} from '@/lib/utils/validation'
import type { PostCategory, PostAttachment, CreatePostInput } from '@/lib/community/types'
import { POST_CATEGORY_LABELS } from '@/lib/community/types'

// RichTextEditor는 TipTap 의존 — SSR 방지를 위해 dynamic import
const RichTextEditor = dynamic(() => import('@/components/ui/RichTextEditor'), {
  ssr: false,
  loading: () => (
    <div
      className="h-[300px] rounded-lg animate-pulse"
      style={{ backgroundColor: 'var(--bg-card-hover)' }}
    />
  ),
})

// 최대 글자 수 상수
const TITLE_MAX_LENGTH = 100

// 순차 검증 필드 순서
const FIELD_ORDER: (keyof PostValidationErrors)[] = ['category', 'title', 'content']

interface PostFormData {
  category: PostCategory
  title: string
  content: string
  attachments: PostAttachment[]
}

interface PostFormProps {
  mode: 'create' | 'edit'
  initialData?: {
    category: PostCategory
    title: string
    content: string
    attachments?: PostAttachment[]
  }
  onSubmit: (data: CreatePostInput) => Promise<void>
  isAdmin?: boolean
  isSubmitting?: boolean
}

export function PostForm({ mode, initialData, onSubmit, isAdmin, isSubmitting }: PostFormProps) {
  const [form, setForm] = useState<PostFormData>({
    category: initialData?.category ?? 'FREE',
    title: initialData?.title ?? '',
    content: initialData?.content ?? '',
    attachments: initialData?.attachments ?? [],
  })
  const [fieldErrors, setFieldErrors] = useState<Partial<PostValidationErrors>>({})
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })

  // 에러 필드 자동 포커스용 ref
  const errorFieldRef = useRef<keyof PostValidationErrors | null>(null)
  const fieldRefs = useRef<Record<string, HTMLInputElement | HTMLSelectElement | null>>({})

  const validateForm = useCallback((): boolean => {
    const errors = validatePostInput(form)
    if (!hasValidationErrors(errors)) {
      setFieldErrors({})
      return true
    }
    // 순차 검증: 첫 번째 에러만 AlertDialog 표시
    for (const field of FIELD_ORDER) {
      if (errors[field]) {
        errorFieldRef.current = field
        setFieldErrors({ [field]: errors[field] })
        setAlert({ isOpen: true, message: errors[field]!, type: 'error' })
        return false
      }
    }
    return true
  }, [form])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    await onSubmit({
      category: form.category,
      title: form.title,
      content: form.content,
      attachments: form.attachments,
    })
  }

  // 카테고리 옵션: NOTICE는 ADMIN+ 전용
  const categoryOptions = Object.entries(POST_CATEGORY_LABELS).filter(
    ([key]) => key !== 'NOTICE' || isAdmin
  )

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* 카테고리 */}
        <div>
          <label
            htmlFor="post-category"
            className="block text-sm font-medium mb-1.5"
            style={{ color: 'var(--text-primary)' }}
          >
            카테고리
          </label>
          <select
            id="post-category"
            ref={(el) => { fieldRefs.current.category = el }}
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as PostCategory })}
            className={`w-full px-3 py-2.5 rounded-lg text-sm outline-none ${
              fieldErrors.category
                ? 'border-2 border-red-500'
                : 'border border-(--border-color) focus:border-(--accent-color)'
            }`}
            style={{
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-primary)',
            }}
          >
            {categoryOptions.map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {/* 제목 */}
        <div>
          <label
            htmlFor="post-title"
            className="block text-sm font-medium mb-1.5"
            style={{ color: 'var(--text-primary)' }}
          >
            제목
          </label>
          <input
            id="post-title"
            ref={(el) => { fieldRefs.current.title = el }}
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            maxLength={TITLE_MAX_LENGTH}
            placeholder="제목을 입력해주세요"
            className={`w-full px-3 py-2.5 rounded-lg text-sm outline-none ${
              fieldErrors.title
                ? 'border-2 border-red-500'
                : 'border border-(--border-color) focus:border-(--accent-color)'
            }`}
            style={{
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-primary)',
            }}
          />
          <p
            className="text-xs mt-1 text-right"
            style={{ color: 'var(--text-muted)' }}
            aria-live="polite"
          >
            {form.title.length} / {TITLE_MAX_LENGTH}
          </p>
        </div>

        {/* 내용 (리치텍스트 에디터) */}
        <div>
          <label
            className="block text-sm font-medium mb-1.5"
            style={{ color: 'var(--text-primary)' }}
          >
            내용
          </label>
          {fieldErrors.content && (
            <p className="text-xs text-red-500 mb-1">{fieldErrors.content}</p>
          )}
          <RichTextEditor
            value={form.content}
            onChange={(html) => setForm({ ...form, content: html })}
            placeholder="내용을 입력해주세요..."
          />
        </div>

        {/* 첨부파일 (이미지 + 문서) */}
        <div>
          <label
            className="block text-sm font-medium mb-1.5"
            style={{ color: 'var(--text-primary)' }}
          >
            첨부파일 <span className="font-normal" style={{ color: 'var(--text-muted)' }}>(선택)</span>
          </label>
          <PostAttachments
            value={form.attachments}
            onChange={(attachments) => setForm({ ...form, attachments })}
          />
        </div>

        {/* 제출 버튼 */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: 'var(--accent-color)',
            color: 'var(--bg-primary)',
          }}
        >
          {isSubmitting
            ? '처리 중...'
            : mode === 'create'
              ? '작성하기'
              : '수정하기'}
        </button>
      </form>

      {/* 검증 에러 AlertDialog */}
      <AlertDialog
        isOpen={alert.isOpen}
        onClose={() => {
          setAlert({ ...alert, isOpen: false })
          const key = errorFieldRef.current
          if (key && fieldRefs.current[key]) {
            fieldRefs.current[key]?.focus()
            errorFieldRef.current = null
          }
        }}
        message={alert.message}
        type={alert.type}
      />
    </>
  )
}
