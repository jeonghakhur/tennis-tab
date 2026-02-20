'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'

interface ImageLightboxProps {
  images: { src: string; alt?: string }[]
  initialIndex?: number
  isOpen: boolean
  onClose: () => void
}

const MIN_SCALE = 1
const MAX_SCALE = 4
const ZOOM_STEP = 0.5

/**
 * 풀스크린 이미지 라이트박스
 * - 캐러셀 (좌/우 화살표, 스와이프)
 * - 확대/축소 (스크롤 휠, 핀치, 버튼)
 * - 드래그 팬 (확대 상태에서)
 * - 키보드: ←/→ 이동, ESC 닫기
 */
export function ImageLightbox({ images, initialIndex = 0, isOpen, onClose }: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const translateStartRef = useRef({ x: 0, y: 0 })
  // 스와이프 감지용
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 })
  // 핀치줌 감지용
  const lastPinchDistRef = useRef<number | null>(null)

  // index 초기화
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex)
      resetZoom()
    }
  }, [isOpen, initialIndex])

  // body 스크롤 방지
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const resetZoom = useCallback(() => {
    setScale(1)
    setTranslate({ x: 0, y: 0 })
  }, [])

  const goTo = useCallback((index: number) => {
    setCurrentIndex(index)
    resetZoom()
  }, [resetZoom])

  const goPrev = useCallback(() => {
    if (images.length <= 1) return
    goTo(currentIndex === 0 ? images.length - 1 : currentIndex - 1)
  }, [currentIndex, images.length, goTo])

  const goNext = useCallback(() => {
    if (images.length <= 1) return
    goTo(currentIndex === images.length - 1 ? 0 : currentIndex + 1)
  }, [currentIndex, images.length, goTo])

  const zoomIn = useCallback(() => {
    setScale((s) => Math.min(s + ZOOM_STEP, MAX_SCALE))
  }, [])

  const zoomOut = useCallback(() => {
    setScale((s) => {
      const next = Math.max(s - ZOOM_STEP, MIN_SCALE)
      if (next <= 1) setTranslate({ x: 0, y: 0 })
      return next
    })
  }, [])

  // 키보드 네비게이션
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape': onClose(); break
        case 'ArrowLeft': goPrev(); break
        case 'ArrowRight': goNext(); break
        case '+': case '=': zoomIn(); break
        case '-': zoomOut(); break
        case '0': resetZoom(); break
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose, goPrev, goNext, zoomIn, zoomOut, resetZoom])

  // 마우스 휠 줌
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    if (e.deltaY < 0) {
      setScale((s) => Math.min(s + 0.2, MAX_SCALE))
    } else {
      setScale((s) => {
        const next = Math.max(s - 0.2, MIN_SCALE)
        if (next <= 1) setTranslate({ x: 0, y: 0 })
        return next
      })
    }
  }, [])

  // 마우스 드래그 (확대 상태에서 팬)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale <= 1) return
    e.preventDefault()
    setIsDragging(true)
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    translateStartRef.current = { ...translate }
  }, [scale, translate])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return
    const dx = e.clientX - dragStartRef.current.x
    const dy = e.clientY - dragStartRef.current.y
    setTranslate({
      x: translateStartRef.current.x + dx,
      y: translateStartRef.current.y + dy,
    })
  }, [isDragging])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // 터치: 스와이프 + 핀치줌
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // 핀치 시작
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      lastPinchDistRef.current = Math.hypot(dx, dy)
    } else if (e.touches.length === 1) {
      const touch = e.touches[0]
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() }

      if (scale > 1) {
        // 확대 상태: 팬 시작
        setIsDragging(true)
        dragStartRef.current = { x: touch.clientX, y: touch.clientY }
        translateStartRef.current = { ...translate }
      }
    }
  }, [scale, translate])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // 핀치줌
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.hypot(dx, dy)
      if (lastPinchDistRef.current !== null) {
        const delta = dist - lastPinchDistRef.current
        setScale((s) => {
          const next = Math.min(Math.max(s + delta * 0.01, MIN_SCALE), MAX_SCALE)
          if (next <= 1) setTranslate({ x: 0, y: 0 })
          return next
        })
      }
      lastPinchDistRef.current = dist
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      // 팬
      const touch = e.touches[0]
      const dx = touch.clientX - dragStartRef.current.x
      const dy = touch.clientY - dragStartRef.current.y
      setTranslate({
        x: translateStartRef.current.x + dx,
        y: translateStartRef.current.y + dy,
      })
    }
  }, [isDragging, scale])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    lastPinchDistRef.current = null

    if (isDragging) {
      setIsDragging(false)
      return
    }

    // 스와이프 감지 (확대 안 된 상태에서만)
    if (scale <= 1 && e.changedTouches.length === 1) {
      const touch = e.changedTouches[0]
      const dx = touch.clientX - touchStartRef.current.x
      const dt = Date.now() - touchStartRef.current.time
      const absDx = Math.abs(dx)

      // 빠른 스와이프: 150px 이상, 300ms 이내
      if (absDx > 150 && dt < 300) {
        if (dx > 0) goPrev()
        else goNext()
      }
    }
  }, [isDragging, scale, goPrev, goNext])

  // 더블 탭/클릭으로 확대/축소 토글
  const lastTapRef = useRef(0)
  const handleDoubleTap = useCallback(() => {
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      // 더블 탭
      if (scale > 1) {
        resetZoom()
      } else {
        setScale(2)
      }
    }
    lastTapRef.current = now
  }, [scale, resetZoom])

  if (!isOpen || images.length === 0) return null

  const current = images[currentIndex]

  return createPortal(
    <div
      ref={containerRef}
      className="fixed inset-0 z-[60] flex flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label="이미지 뷰어"
      tabIndex={-1}
    >
      {/* 상단 바 */}
      <div className="flex items-center justify-between px-4 py-3 text-white/80 z-10">
        <span className="text-sm font-medium">
          {images.length > 1 && `${currentIndex + 1} / ${images.length}`}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={zoomOut}
            disabled={scale <= MIN_SCALE}
            className="p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-30"
            aria-label="축소"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <span className="text-xs w-12 text-center">{Math.round(scale * 100)}%</span>
          <button
            type="button"
            onClick={zoomIn}
            disabled={scale >= MAX_SCALE}
            className="p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-30"
            aria-label="확대"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={resetZoom}
            disabled={scale <= MIN_SCALE}
            className="p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-30"
            aria-label="원래 크기"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition-colors ml-2"
            aria-label="닫기"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* 이미지 영역 */}
      <div
        className="flex-1 flex items-center justify-center overflow-hidden select-none"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleDoubleTap}
        style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.src}
          alt={current.alt || '이미지'}
          className="max-w-full max-h-full object-contain pointer-events-none"
          style={{
            transform: `scale(${scale}) translate(${translate.x / scale}px, ${translate.y / scale}px)`,
            transition: isDragging ? 'none' : 'transform 0.2s ease-out',
          }}
          draggable={false}
        />
      </div>

      {/* 좌우 화살표 (이미지 2개 이상일 때) */}
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goPrev() }}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white/80 hover:bg-black/60 transition-colors"
            aria-label="이전 이미지"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goNext() }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white/80 hover:bg-black/60 transition-colors"
            aria-label="다음 이미지"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* 하단 인디케이터 (5개 이하일 때 dot, 초과 시 숫자만) */}
      {images.length > 1 && images.length <= 10 && (
        <div className="flex justify-center gap-1.5 py-3">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === currentIndex ? 'bg-white' : 'bg-white/30'
              }`}
              aria-label={`이미지 ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>,
    document.body,
  )
}
