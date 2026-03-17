'use client'

import { User } from 'lucide-react'
import type { Coach } from '@/lib/lessons/types'

interface CoachCardProps {
  coach: Coach
  onEdit?: () => void
  isAdmin?: boolean
}

export function CoachCard({ coach, onEdit, isAdmin }: CoachCardProps) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      <div className="flex items-start gap-3">
        {/* 프로필 이미지 */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: 'var(--bg-card-hover)' }}
        >
          {coach.profile_image_url ? (
            <img
              src={coach.profile_image_url}
              alt={`${coach.name} 코치 프로필`}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <User className="w-6 h-6" style={{ color: 'var(--text-muted)' }} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3
              className="font-medium text-sm"
              style={{ color: 'var(--text-primary)' }}
            >
              {coach.name} 코치
            </h3>
            {isAdmin && onEdit && (
              <button
                onClick={onEdit}
                className="text-sm px-2 py-1 rounded-md hover:opacity-80"
                style={{
                  backgroundColor: 'var(--bg-card-hover)',
                  color: 'var(--text-secondary)',
                }}
              >
                수정
              </button>
            )}
          </div>

          {coach.experience && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              경력: {coach.experience}
            </p>
          )}

          {coach.certifications.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {coach.certifications.map((cert) => (
                <span
                  key={cert}
                  className="text-sm px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: 'var(--bg-card-hover)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {cert}
                </span>
              ))}
            </div>
          )}

          {coach.bio && (
            <p
              className="text-sm mt-2 line-clamp-2"
              style={{ color: 'var(--text-secondary)' }}
            >
              {coach.bio}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
