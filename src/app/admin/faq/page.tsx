'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Pencil, Trash2, Eye, EyeOff, Settings } from 'lucide-react'
import {
  getFaqsAdmin,
  createFaq,
  updateFaq,
  deleteFaq,
  toggleFaqActive,
  getFaqCategoriesAdmin,
  createFaqCategory,
  updateFaqCategory,
  deleteFaqCategory,
} from '@/lib/faq/actions'
import { Badge } from '@/components/common/Badge'
import { Modal } from '@/components/common/Modal'
import { Toast, AlertDialog, ConfirmDialog } from '@/components/common/AlertDialog'
import { LoadingOverlay } from '@/components/common/LoadingOverlay'
import type { Faq, FaqInput, FaqCategoryItem } from '@/lib/faq/types'

export default function AdminFaqPage() {
  const [faqs, setFaqs] = useState<Faq[]>([])
  const [categories, setCategories] = useState<FaqCategoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [filter, setFilter] = useState('ALL')

  // FAQ 모달
  const [modalOpen, setModalOpen] = useState(false)
  const [editingFaq, setEditingFaq] = useState<Faq | null>(null)
  const [form, setForm] = useState<FaqInput>({
    category: '',
    question: '',
    answer: '',
    is_active: true,
  })

  // 카테고리 관리 모달
  const [catModalOpen, setCatModalOpen] = useState(false)
  const [editingCat, setEditingCat] = useState<FaqCategoryItem | null>(null)
  const [catForm, setCatForm] = useState({ slug: '', name: '' })

  // 다이얼로그 상태
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; id: string }>({
    isOpen: false,
    id: '',
  })
  const [confirmCatDelete, setConfirmCatDelete] = useState<{ isOpen: boolean; slug: string }>({
    isOpen: false,
    slug: '',
  })

  // slug → name 맵
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.slug, c.name])),
    [categories],
  )

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    const [faqResult, catResult] = await Promise.all([
      getFaqsAdmin(),
      getFaqCategoriesAdmin(),
    ])
    if (faqResult.error) setAlert({ isOpen: true, message: faqResult.error, type: 'error' })
    else setFaqs(faqResult.data)
    if (catResult.error) setAlert({ isOpen: true, message: catResult.error, type: 'error' })
    else setCategories(catResult.data)
    setLoading(false)
  }

  // 카테고리 필터링
  const filteredFaqs = useMemo(() => {
    if (filter === 'ALL') return faqs
    return faqs.filter((faq) => faq.category === filter)
  }, [faqs, filter])

  // ──────────────────────────────────────────
  // FAQ CRUD
  // ──────────────────────────────────────────

  const openCreateModal = () => {
    setEditingFaq(null)
    setForm({
      category: categories[0]?.slug ?? '',
      question: '',
      answer: '',
      is_active: true,
    })
    setModalOpen(true)
  }

  const openEditModal = (faq: Faq) => {
    setEditingFaq(faq)
    setForm({
      category: faq.category,
      question: faq.question,
      answer: faq.answer,
      is_active: faq.is_active,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    setActionLoading(true)

    if (editingFaq) {
      const result = await updateFaq(editingFaq.id, form)
      if (result.error) {
        setAlert({ isOpen: true, message: result.error, type: 'error' })
        setActionLoading(false)
        return
      }
      setToast({ isOpen: true, message: 'FAQ가 수정되었습니다.', type: 'success' })
    } else {
      const result = await createFaq(form)
      if (result.error) {
        setAlert({ isOpen: true, message: result.error, type: 'error' })
        setActionLoading(false)
        return
      }
      setToast({ isOpen: true, message: 'FAQ가 추가되었습니다.', type: 'success' })
    }

    setModalOpen(false)
    setActionLoading(false)
    loadAll()
  }

  const handleDelete = async () => {
    const { id } = confirmDelete
    setConfirmDelete({ isOpen: false, id: '' })
    setActionLoading(true)

    const result = await deleteFaq(id)
    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
    } else {
      setToast({ isOpen: true, message: 'FAQ가 삭제되었습니다.', type: 'success' })
      loadAll()
    }
    setActionLoading(false)
  }

  const handleToggleActive = async (faq: Faq) => {
    setActionLoading(true)
    const result = await toggleFaqActive(faq.id, !faq.is_active)
    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
    } else {
      setToast({
        isOpen: true,
        message: faq.is_active ? '비활성화되었습니다.' : '활성화되었습니다.',
        type: 'success',
      })
      loadAll()
    }
    setActionLoading(false)
  }

  // ──────────────────────────────────────────
  // 카테고리 CRUD
  // ──────────────────────────────────────────

  const openCatCreateModal = () => {
    setEditingCat(null)
    setCatForm({ slug: '', name: '' })
    setCatModalOpen(true)
  }

  const openCatEditModal = (cat: FaqCategoryItem) => {
    setEditingCat(cat)
    setCatForm({ slug: cat.slug, name: cat.name })
    setCatModalOpen(true)
  }

  const handleCatSave = async () => {
    setActionLoading(true)

    if (editingCat) {
      // 수정 (이름만)
      const result = await updateFaqCategory(editingCat.slug, { name: catForm.name })
      if (result.error) {
        setAlert({ isOpen: true, message: result.error, type: 'error' })
        setActionLoading(false)
        return
      }
      setToast({ isOpen: true, message: '카테고리가 수정되었습니다.', type: 'success' })
    } else {
      // 생성
      const result = await createFaqCategory({ slug: catForm.slug, name: catForm.name })
      if (result.error) {
        setAlert({ isOpen: true, message: result.error, type: 'error' })
        setActionLoading(false)
        return
      }
      setToast({ isOpen: true, message: '카테고리가 추가되었습니다.', type: 'success' })
    }

    setCatModalOpen(false)
    setActionLoading(false)
    loadAll()
  }

  const handleCatDelete = async () => {
    const { slug } = confirmCatDelete
    setConfirmCatDelete({ isOpen: false, slug: '' })
    setActionLoading(true)

    const result = await deleteFaqCategory(slug)
    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
    } else {
      setToast({ isOpen: true, message: '카테고리가 삭제되었습니다.', type: 'success' })
      // 필터가 삭제된 카테고리면 전체로 변경
      if (filter === slug) setFilter('ALL')
      loadAll()
    }
    setActionLoading(false)
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
        <div className="h-12 w-full rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-24 w-full rounded-xl"
            style={{ backgroundColor: 'var(--bg-card-hover)' }}
          />
        ))}
      </div>
    )
  }

  return (
    <>
      {actionLoading && <LoadingOverlay message="처리 중..." />}

      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1
          className="text-2xl font-display whitespace-nowrap"
          style={{ color: 'var(--text-primary)' }}
        >
          FAQ 관리
          <span
            className="text-sm font-normal ml-2"
            style={{ color: 'var(--text-secondary)' }}
          >
            ({faqs.length}개)
          </span>
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={openCatCreateModal}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap hover:opacity-90 transition-opacity"
            style={{
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
            }}
          >
            <Settings className="w-4 h-4 shrink-0" />
            카테고리 관리
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white whitespace-nowrap hover:opacity-90 transition-opacity"
            style={{ backgroundColor: 'var(--accent-color)' }}
          >
            <Plus className="w-4 h-4 shrink-0" />
            FAQ 추가
          </button>
        </div>
      </div>

      {/* 카테고리 필터 */}
      <div className="relative mb-5">
        <div
          className="flex gap-1 border-b overflow-x-auto"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <button
            onClick={() => setFilter('ALL')}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors
              ${filter === 'ALL' ? 'border-b-2' : ''}`}
            style={{
              borderColor: filter === 'ALL' ? 'var(--accent-color)' : 'transparent',
              color: filter === 'ALL' ? 'var(--accent-color)' : 'var(--text-secondary)',
            }}
          >
            전체
          </button>
          {categories.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => setFilter(cat.slug)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors
                ${filter === cat.slug ? 'border-b-2' : ''}`}
              style={{
                borderColor: filter === cat.slug ? 'var(--accent-color)' : 'transparent',
                color: filter === cat.slug ? 'var(--accent-color)' : 'var(--text-secondary)',
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>
        {/* 탭 우측 스크롤 힌트 (모바일) */}
        <div
          className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none sm:hidden"
          style={{ background: 'linear-gradient(to left, var(--bg-primary), transparent)' }}
        />
      </div>

      {/* FAQ 목록 */}
      {filteredFaqs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            등록된 FAQ가 없습니다.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFaqs.map((faq) => (
            <div
              key={faq.id}
              className={`glass-card rounded-xl p-4 ${!faq.is_active ? 'opacity-50' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Badge variant="info">{categoryMap.get(faq.category) ?? faq.category}</Badge>
                    {!faq.is_active && <Badge variant="secondary">비활성</Badge>}
                  </div>
                  <p
                    className="text-sm font-medium mb-1"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    Q. {faq.question}
                  </p>
                  <p
                    className="text-xs line-clamp-2"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    A. {faq.answer}
                  </p>
                </div>

                <div className="flex items-center shrink-0">
                  <button
                    onClick={() => handleToggleActive(faq)}
                    className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-(--bg-card-hover) transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    aria-label={faq.is_active ? '비활성화' : '활성화'}
                    title={faq.is_active ? '비활성화' : '활성화'}
                  >
                    {faq.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => openEditModal(faq)}
                    className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-(--bg-card-hover) transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    aria-label="수정"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete({ isOpen: true, id: faq.id })}
                    className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-(--bg-card-hover) transition-colors"
                    style={{ color: 'var(--court-danger)' }}
                    aria-label="삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ──────────────────────────────────────── */}
      {/* FAQ 추가/수정 모달 */}
      {/* ──────────────────────────────────────── */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingFaq ? 'FAQ 수정' : 'FAQ 추가'}
        size="lg"
      >
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="faq-category"
                className="block text-sm font-medium mb-1"
                style={{ color: 'var(--text-primary)' }}
              >
                카테고리
              </label>
              <select
                id="faq-category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              >
                {categories.map((cat) => (
                  <option key={cat.slug} value={cat.slug}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="faq-question"
                className="block text-sm font-medium mb-1"
                style={{ color: 'var(--text-primary)' }}
              >
                질문
                <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>
                  ({form.question.length}/200)
                </span>
              </label>
              <input
                id="faq-question"
                type="text"
                maxLength={200}
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
                placeholder="자주 묻는 질문을 입력하세요"
                className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            <div>
              <label
                htmlFor="faq-answer"
                className="block text-sm font-medium mb-1"
                style={{ color: 'var(--text-primary)' }}
              >
                답변
                <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>
                  ({form.answer.length}/2000)
                </span>
              </label>
              <textarea
                id="faq-answer"
                maxLength={2000}
                rows={5}
                value={form.answer}
                onChange={(e) => setForm({ ...form, answer: e.target.value })}
                placeholder="답변을 입력하세요"
                className="w-full px-3 py-2 rounded-lg border outline-none text-sm resize-y"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active ?? true}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="w-4 h-4 rounded accent-emerald-500"
              />
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                활성화 (사용자에게 표시)
              </span>
            </label>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <button
            onClick={() => setModalOpen(false)}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
            }}
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--accent-color)' }}
          >
            {editingFaq ? '수정' : '추가'}
          </button>
        </Modal.Footer>
      </Modal>

      {/* ──────────────────────────────────────── */}
      {/* 카테고리 관리 모달 */}
      {/* ──────────────────────────────────────── */}
      <Modal
        isOpen={catModalOpen}
        onClose={() => { setCatModalOpen(false); setEditingCat(null) }}
        title={editingCat ? '카테고리 수정' : '카테고리 관리'}
        size="lg"
      >
        <Modal.Body>
          <div className="space-y-5">
            {/* 기존 카테고리 목록 (추가 모드에서만 표시) */}
            {!editingCat && categories.length > 0 && (
              <div>
                <p
                  className="text-sm font-medium mb-3"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  등록된 카테고리 ({categories.length}개)
                </p>
                <div className="space-y-2">
                  {categories.map((cat, idx) => (
                    <div
                      key={cat.slug}
                      className="flex items-center justify-between px-4 py-3 rounded-lg border"
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="text-xs font-mono w-6 text-center shrink-0"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <span
                            className="text-sm font-medium block"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {cat.name}
                          </span>
                          <span
                            className="text-xs font-mono"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {cat.slug}
                          </span>
                        </div>
                        {!cat.is_active && (
                          <Badge variant="secondary">비활성</Badge>
                        )}
                      </div>
                      <div className="flex items-center shrink-0">
                        <button
                          onClick={() => openCatEditModal(cat)}
                          className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-(--bg-card-hover) transition-colors"
                          style={{ color: 'var(--text-secondary)' }}
                          aria-label="수정"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setConfirmCatDelete({ isOpen: true, slug: cat.slug })}
                          className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-(--bg-card-hover) transition-colors"
                          style={{ color: 'var(--court-danger)' }}
                          aria-label="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 구분선 + 새 카테고리 추가 영역 */}
            {!editingCat && categories.length > 0 && (
              <div
                className="border-t pt-5"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <p
                  className="text-sm font-medium mb-4"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  새 카테고리 추가
                </p>
              </div>
            )}

            {/* slug (생성 시에만) */}
            {!editingCat && (
              <div>
                <label
                  htmlFor="cat-slug"
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Slug (영문 코드)
                </label>
                <input
                  id="cat-slug"
                  type="text"
                  maxLength={50}
                  value={catForm.slug}
                  onChange={(e) => setCatForm({ ...catForm, slug: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_') })}
                  placeholder="예: PAYMENT"
                  className="w-full px-3 py-2.5 rounded-lg border outline-none text-sm font-mono"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                />
                <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                  영문 대문자, 숫자, 밑줄(_)만 사용 가능
                </p>
              </div>
            )}

            {/* 이름 */}
            <div>
              <label
                htmlFor="cat-name"
                className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--text-primary)' }}
              >
                카테고리 이름
              </label>
              <input
                id="cat-name"
                type="text"
                maxLength={50}
                value={catForm.name}
                onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                placeholder="예: 결제/환불"
                className="w-full px-3 py-2.5 rounded-lg border outline-none text-sm"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <button
            onClick={() => { setCatModalOpen(false); setEditingCat(null) }}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
            }}
          >
            {editingCat ? '취소' : '닫기'}
          </button>
          <button
            onClick={handleCatSave}
            disabled={!catForm.name.trim() || (!editingCat && !catForm.slug.trim())}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-40"
            style={{ backgroundColor: 'var(--accent-color)' }}
          >
            {editingCat ? '수정' : '추가'}
          </button>
        </Modal.Footer>
      </Modal>

      {/* 다이얼로그 */}
      <Toast
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
        message={toast.message}
        type={toast.type}
      />
      <AlertDialog
        isOpen={alert.isOpen}
        onClose={() => setAlert({ ...alert, isOpen: false })}
        message={alert.message}
        type={alert.type}
      />
      <ConfirmDialog
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, id: '' })}
        onConfirm={handleDelete}
        title="FAQ 삭제"
        message="이 FAQ를 삭제하시겠습니까? 삭제된 항목은 복구할 수 없습니다."
        type="warning"
      />
      <ConfirmDialog
        isOpen={confirmCatDelete.isOpen}
        onClose={() => setConfirmCatDelete({ isOpen: false, slug: '' })}
        onConfirm={handleCatDelete}
        title="카테고리 삭제"
        message="이 카테고리를 삭제하시겠습니까? 해당 카테고리에 FAQ가 있으면 삭제할 수 없습니다."
        type="warning"
      />
    </>
  )
}
