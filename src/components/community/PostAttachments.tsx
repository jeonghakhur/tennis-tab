'use client'

import { useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import { X, Upload, FileText, FileSpreadsheet, Presentation, File } from 'lucide-react'
import { uploadFile, deleteImage } from '@/lib/storage/actions'
import type { PostAttachment } from '@/lib/community/types'

// 허용 파일 형식
const IMAGE_EXTENSIONS = '.jpg,.jpeg,.png,.webp,.gif'
const DOCUMENT_EXTENSIONS = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.hwp'
const ALL_EXTENSIONS = `${IMAGE_EXTENSIONS},${DOCUMENT_EXTENSIONS}`

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_ATTACHMENTS = 10

/** 파일 확장자로 타입 판별 */
function getFileType(file: File): 'image' | 'document' | null {
  if (IMAGE_MIME_TYPES.includes(file.type)) return 'image'
  const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '')
  const docExts = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.hwp']
  if (docExts.includes(ext)) return 'document'
  return null
}

/** 확장자별 아이콘 */
function getDocumentIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  switch (ext) {
    case 'pdf':
    case 'doc':
    case 'docx':
    case 'hwp':
      return <FileText className="w-6 h-6" />
    case 'xls':
    case 'xlsx':
      return <FileSpreadsheet className="w-6 h-6" />
    case 'ppt':
    case 'pptx':
      return <Presentation className="w-6 h-6" />
    default:
      return <File className="w-6 h-6" />
  }
}

/** 파일 크기 포맷 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

interface PostAttachmentsProps {
  value: PostAttachment[]
  onChange: (attachments: PostAttachment[]) => void
}

export function PostAttachments({ value, onChange }: PostAttachmentsProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  /** 중첩 드래그 이벤트 추적용 카운터 */
  const dragCounterRef = useRef(0)

  /** 파일 목록 검증 + 업로드 (input change / drop 공통) */
  const processFiles = useCallback(async (files: File[]) => {
    const remaining = MAX_ATTACHMENTS - value.length
    if (remaining <= 0) {
      setError(`최대 ${MAX_ATTACHMENTS}개까지 첨부할 수 있습니다.`)
      return
    }

    const filesToUpload = files.slice(0, remaining)
    setError(null)
    setUploading(true)

    const newAttachments: PostAttachment[] = []

    for (const file of filesToUpload) {
      const fileType = getFileType(file)
      if (!fileType) {
        setError(`"${file.name}" — 지원하지 않는 파일 형식입니다.`)
        continue
      }

      if (file.size > MAX_FILE_SIZE) {
        setError(`"${file.name}" — 10MB를 초과합니다.`)
        continue
      }

      const formData = new FormData()
      formData.append('file', file)
      formData.append('bucket', 'posts')
      formData.append('folder', fileType === 'image' ? 'images' : 'documents')

      const result = await uploadFile(formData)

      if (result.error) {
        setError(`"${file.name}" 업로드 실패: ${result.error}`)
        continue
      }

      if (result.url) {
        newAttachments.push({
          url: result.url,
          name: file.name,
          size: file.size,
          type: fileType,
        })
      }
    }

    if (newAttachments.length > 0) {
      onChange([...value, ...newAttachments])
    }

    setUploading(false)
  }, [value, onChange])

  const handleFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    await processFiles(Array.from(files))
    // input 초기화 (같은 파일 재선택 가능)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  /* --- 드래그앤드롭 핸들러 --- */
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current += 1
    if (e.dataTransfer.types.includes('Files')) {
      setDragging(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current -= 1
    if (dragCounterRef.current === 0) {
      setDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current = 0
    setDragging(false)

    if (uploading) return

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return
    await processFiles(files)
  }, [uploading, processFiles])

  const handleRemove = async (index: number) => {
    const attachment = value[index]
    // 스토리지에서 삭제
    try {
      await deleteImage(attachment.url, 'posts')
    } catch {
      // 삭제 실패해도 목록에서는 제거 (orphan file은 허용)
    }
    onChange(value.filter((_, i) => i !== index))
  }

  const images = value.filter((a) => a.type === 'image')
  const documents = value.filter((a) => a.type === 'document')
  const isFull = value.length >= MAX_ATTACHMENTS

  return (
    <div
      className="space-y-3"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* 업로드 버튼 + 드롭 영역 */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ALL_EXTENSIONS}
        multiple
        onChange={handleFilesSelect}
        className="hidden"
        disabled={uploading}
        aria-label="파일 첨부"
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading || isFull}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-dashed transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
          dragging && !isFull ? 'ring-2 ring-offset-1' : ''
        }`}
        style={{
          borderColor: dragging && !isFull ? 'var(--accent-color)' : 'var(--border-color)',
          color: dragging && !isFull ? 'var(--accent-color)' : 'var(--text-muted)',
          backgroundColor: dragging && !isFull ? 'var(--bg-card-hover)' : undefined,
          // ring 색상
          ...(dragging && !isFull ? { '--tw-ring-color': 'var(--accent-color)' } as React.CSSProperties : {}),
        }}
      >
        {uploading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
            업로드 중...
          </>
        ) : dragging && !isFull ? (
          <>
            <Upload className="w-4 h-4" />
            여기에 파일을 놓으세요
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" />
            파일 첨부 또는 드래그앤드롭 ({value.length}/{MAX_ATTACHMENTS})
          </>
        )}
      </button>

      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        이미지: JPG, PNG, WebP, GIF / 문서: PDF, Word, Excel, PowerPoint, 한글 (최대 10MB)
      </p>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* 이미지 미리보기 */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((att, idx) => {
            const globalIdx = value.indexOf(att)
            return (
              <div key={att.url} className="relative group rounded-lg overflow-hidden aspect-square">
                <Image
                  src={att.url}
                  alt={att.name}
                  fill
                  className="object-cover"
                  unoptimized
                />
                <button
                  type="button"
                  onClick={() => handleRemove(globalIdx)}
                  className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={`${att.name} 삭제`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <div className="absolute bottom-0 inset-x-0 bg-black/50 px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-white text-[10px] truncate">{att.name}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 문서 파일 목록 */}
      {documents.length > 0 && (
        <div className="space-y-1.5">
          {documents.map((att) => {
            const globalIdx = value.indexOf(att)
            return (
              <div
                key={att.url}
                className="flex items-center gap-3 px-3 py-2 rounded-lg"
                style={{ backgroundColor: 'var(--bg-card-hover)' }}
              >
                <span style={{ color: 'var(--text-muted)' }}>
                  {getDocumentIcon(att.name)}
                </span>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm truncate"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {att.name}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {formatSize(att.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(globalIdx)}
                  className="shrink-0 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                  aria-label={`${att.name} 삭제`}
                >
                  <X className="w-4 h-4 text-red-500" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
