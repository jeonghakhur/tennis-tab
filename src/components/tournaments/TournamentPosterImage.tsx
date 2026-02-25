'use client'

import { useState } from 'react'
import Image from 'next/image'

interface TournamentPosterImageProps {
  src: string
  alt: string
}

/** 포스터 이미지 로드 실패 시 null 반환 (컨테이너 숨김) */
export function TournamentPosterImage({ src, alt }: TournamentPosterImageProps) {
  const [error, setError] = useState(false)

  if (error) return null

  return (
    <Image
      src={src}
      alt={alt}
      width={0}
      height={0}
      sizes="100vw"
      className="w-full h-auto"
      priority
      unoptimized
      onError={() => setError(true)}
    />
  )
}
