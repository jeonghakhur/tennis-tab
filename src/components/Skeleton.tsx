'use client'

import { CSSProperties } from 'react'

/**
 * className을 합치는 유틸리티 함수
 */
function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number
  height?: string | number
  variant?: 'circular' | 'rectangular' | 'text'
  lines?: number
}

/**
 * 기본 스켈레톤 컴포넌트
 * shadcn/ui 스타일을 참고하여 구현
 * 로딩 중인 콘텐츠의 플레이스홀더로 사용
 */
export function Skeleton({
  width,
  height,
  className,
  style,
  variant = 'rectangular',
  lines = 1,
  ...props
}: SkeletonProps) {
  const baseStyle: CSSProperties = {
    width: width || (variant === 'text' ? '100%' : undefined),
    height: height || (variant === 'text' ? '1em' : undefined),
    ...style,
  }

  const baseClassName = cn(
    'animate-pulse rounded-md skeleton-shimmer',
    variant === 'circular' && 'rounded-full',
    className
  )

  if (variant === 'text' && lines > 1) {
    return (
      <div className={cn('space-y-2', className)} {...props}>
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={cn(
              'h-4 animate-pulse rounded-md',
              'skeleton-shimmer',
              index === lines - 1 ? 'w-3/4' : 'w-full'
            )}
            style={{
              backgroundColor: 'var(--bg-card)',
            }}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className={baseClassName}
      style={{
        backgroundColor: 'var(--bg-card)',
        ...baseStyle,
      }}
      {...props}
    />
  )
}

/**
 * 아바타 스켈레톤 컴포넌트
 */
export function AvatarSkeleton({ size = 40 }: { size?: number }) {
  return (
    <Skeleton
      variant="circular"
      width={size}
      height={size}
    />
  )
}

/**
 * 카드 스켈레톤 컴포넌트
 */
export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="glass-card p-6">
      <Skeleton variant="text" height="1.5em" width="60%" className="mb-4" />
      <Skeleton variant="text" lines={lines} />
    </div>
  )
}

/**
 * 프로필 헤더 스켈레톤 컴포넌트
 */
export function ProfileHeaderSkeleton() {
  return (
    <div className="glass-card p-8 mb-8">
      <div className="flex items-start gap-6">
        <AvatarSkeleton size={96} />
        <div className="flex-1">
          <Skeleton variant="text" height="2em" width="200px" className="mb-2" />
          <Skeleton variant="text" height="1em" width="150px" className="mb-4" />
          <div className="flex flex-wrap gap-2">
            <Skeleton width="80px" height="24px" className="rounded-full" />
            <Skeleton width="100px" height="24px" className="rounded-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * 통계 카드 스켈레톤 컴포넌트
 */
export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="glass-card p-6 text-center">
          <Skeleton width="48px" height="48px" className="mx-auto mb-2" />
          <Skeleton variant="text" height="0.875em" width="60px" className="mx-auto" />
        </div>
      ))}
    </div>
  )
}

/**
 * 프로필 페이지 전체 스켈레톤
 */
export function ProfilePageSkeleton() {
  return (
    <main className="min-h-screen pt-20" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="max-w-6xl mx-auto px-6 py-12">
        <ProfileHeaderSkeleton />
        <StatsSkeleton />
        <div className="flex gap-2 mb-6 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <Skeleton width="100px" height="48px" />
          <Skeleton width="120px" height="48px" />
          <Skeleton width="100px" height="48px" />
        </div>
        <CardSkeleton lines={5} />
      </div>
    </main>
  )
}
