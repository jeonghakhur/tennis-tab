'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Database } from '@/lib/supabase/types';

type Tournament = Database['public']['Tables']['tournaments']['Row'];

interface TournamentCardProps {
  tournament: Tournament;
}

export default function TournamentCard({ tournament }: TournamentCardProps) {
  const router = useRouter();
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: 'bg-(--color-secondary-subtle) text-(--text-muted)',
      OPEN: 'bg-(--color-success-subtle) text-(--color-success)',
      CLOSED: 'bg-(--color-danger-subtle) text-(--color-danger)',
      IN_PROGRESS: 'bg-(--color-info-subtle) text-(--color-info)',
      COMPLETED: 'bg-(--color-secondary-subtle) text-(--text-muted)',
      CANCELLED: 'bg-(--color-secondary-subtle) text-(--text-muted) line-through',
    };
    const labels: Record<string, string> = {
      DRAFT: '작성 중',
      OPEN: '모집 중',
      CLOSED: '마감',
      IN_PROGRESS: '진행 중',
      COMPLETED: '종료',
      CANCELLED: '취소',
    };

    const style = styles[status] || styles.DRAFT;
    const label = labels[status] || status;

    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${style}`}>
        {label}
      </span>
    );
  };

  const handleCopyTemplate = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/tournaments/new?template=${tournament.id}`);
  };

  return (
    <Link 
      href={`/tournaments/${tournament.id}`}
      className="block group"
    >
      <div className="bg-(--bg-card) border border-(--border-color) rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 hover:border-(--accent-color)/30">
        <div className="aspect-[3/2] bg-(--bg-secondary) relative">
          {tournament.poster_url ? (
            <Image
              src={tournament.poster_url}
              alt={tournament.title}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-4xl">
              🎾
            </div>
          )}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
            <button
              onClick={handleCopyTemplate}
              className="bg-(--bg-card)/90 hover:bg-(--bg-card) text-(--text-secondary) p-2 rounded-lg shadow-sm backdrop-blur-sm transition-all hover:scale-110"
              title="템플릿으로 사용"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
            {getStatusBadge(tournament.status)}
          </div>
        </div>
        
        <div className="p-5">
          <div className="text-sm text-(--accent-color) font-medium mb-1">
            {formatDate(tournament.start_date)}
          </div>
          <h3 className="text-lg font-bold text-(--text-primary) mb-2 group-hover:text-(--accent-color) transition-colors line-clamp-2">
            {tournament.title}
          </h3>
          <div className="flex items-center text-(--text-muted) text-sm gap-4">
             <div className="flex items-center gap-1">
               <span className="text-xs">📍</span>
               {tournament.location}
             </div>
             <div className="flex items-center gap-1">
               <span className="text-xs">👥</span>
               {tournament.max_participants}명
             </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
