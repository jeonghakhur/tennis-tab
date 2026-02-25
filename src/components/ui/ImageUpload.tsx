'use client'

import { useState, useRef, useCallback } from 'react'
import { uploadImage, deleteImage } from '@/lib/storage/actions'
import Image from 'next/image'

interface ImageUploadProps {
  value?: string | null
  onChange: (url: string | null) => void
  bucket?: string
  folder?: string
  className?: string
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024  // 5MB

export default function ImageUpload({
  value,
  onChange,
  bucket = 'tournaments',
  folder = 'posters',
  className = '',
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(value || null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)  // 자식 요소 진입/이탈 시 flicker 방지

  const processFile = useCallback(async (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('JPG, PNG, WebP, GIF 형식만 지원됩니다.')
      return
    }
    if (file.size > MAX_SIZE) {
      setError('파일 크기는 5MB 이하여야 합니다.')
      return
    }

    setError(null)
    setUploading(true)
    setPreview(URL.createObjectURL(file))  // 즉시 로컬 미리보기

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('bucket', bucket)
      formData.append('folder', folder)

      const result = await uploadImage(formData)
      if (result.error) throw new Error(result.error)
      if (result.url) {
        onChange(result.url)
        setPreview(result.url)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드에 실패했습니다.')
      setPreview(value || null)
    } finally {
      setUploading(false)
    }
  }, [bucket, folder, onChange, value])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current++
    if (e.dataTransfer.items.length > 0) setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setIsDragging(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  const handleRemove = async () => {
    if (value) {
      try { await deleteImage(value, bucket) } catch { /* 무시 */ }
    }
    onChange(null)
    setPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const dragProps = {
    onDragEnter: handleDragEnter,
    onDragLeave: handleDragLeave,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />

      {preview ? (
        // 미리보기 영역 — 드래그로 교체 가능
        <div
          className={`relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 transition-all ${
            isDragging ? 'ring-2 ring-blue-500 ring-offset-2' : ''
          }`}
          {...dragProps}
        >
          <Image
            src={preview}
            alt="대회 포스터"
            width={0}
            height={0}
            sizes="100vw"
            className="w-full h-auto"
            unoptimized
          />

          {/* 호버 오버레이 (변경/삭제 버튼) */}
          {!isDragging && !uploading && (
            <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-white/90 hover:bg-white text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  변경
                </button>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="bg-red-500/90 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  삭제
                </button>
              </div>
            </div>
          )}

          {/* 드래그 오버레이 */}
          {isDragging && (
            <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
              <p className="text-sm font-semibold text-blue-600 dark:text-blue-300">
                여기에 놓으면 이미지가 교체됩니다
              </p>
            </div>
          )}

          {/* 업로드 중 오버레이 */}
          {uploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent" />
            </div>
          )}
        </div>
      ) : (
        // 업로드 존
        <div
          role="button"
          tabIndex={0}
          onClick={() => !uploading && fileInputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && !uploading && fileInputRef.current?.click()}
          {...dragProps}
          className={`w-full aspect-[3/2] rounded-lg border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 cursor-pointer select-none ${
            isDragging
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-500'
              : 'border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-500 text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400'
          }`}
        >
          {uploading ? (
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-current border-t-transparent" />
          ) : isDragging ? (
            <>
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-sm font-semibold">여기에 놓으세요</span>
            </>
          ) : (
            <>
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-medium">클릭하거나 이미지를 드래그하세요</span>
              <span className="text-xs">JPG, PNG, WebP, GIF (최대 5MB)</span>
            </>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
