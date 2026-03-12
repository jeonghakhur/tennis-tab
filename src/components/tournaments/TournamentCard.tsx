'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { MapPin, Copy } from 'lucide-react';
import { Database } from '@/lib/supabase/types';
import { Badge, type BadgeVariant } from '@/components/common/Badge';
import { useAuth } from '@/components/AuthProvider';
import { isAdmin } from '@/lib/auth/roles';

type Tournament = Database['public']['Tables']['tournaments']['Row'];

interface TournamentCardProps {
  tournament: Tournament;
}

const MATCH_TYPE_LABELS: Record<string, string> = {
  INDIVIDUAL_SINGLES: "개인전 단식",
  INDIVIDUAL_DOUBLES: "개인전 복식",
  TEAM_SINGLES: "단체전 단식",
  TEAM_DOUBLES: "단체전 복식",
};

export default function TournamentCard({ tournament }: TournamentCardProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const [imgError, setImgError] = useState(false);
  const canManage = isAdmin(profile?.role);

  const formatDateRange = (startStr: string, endStr: string) => {
    const fmt = (d: string) => d.replace(/-/g, '.').slice(0, 10);
    if (startStr === endStr) return fmt(startStr);
    return `${fmt(startStr)}~${fmt(endStr)}`;
  };

  const formatMatchType = () => {
    const { match_type, team_match_count } = tournament;
    if (!match_type) return null;
    const isTeam = match_type === "TEAM_SINGLES" || match_type === "TEAM_DOUBLES";
    if (isTeam && team_match_count) {
      const suffix = match_type.includes("SINGLES") ? "단식" : "복식";
      return `단체전 ${team_match_count}${suffix}`;
    }
    return MATCH_TYPE_LABELS[match_type] ?? match_type;
  };

  const getStatusBadge = (status: string) => {
    const badgeMap: Record<string, { label: string; variant: BadgeVariant }> = {
      DRAFT: { label: '작성 중', variant: 'secondary' },
      UPCOMING: { label: '접수 예정', variant: 'purple' },
      OPEN: { label: '모집 중', variant: 'success' },
      CLOSED: { label: '마감', variant: 'orange' },
      IN_PROGRESS: { label: '진행 중', variant: 'info' },
      COMPLETED: { label: '종료', variant: 'secondary' },
      CANCELLED: { label: '취소', variant: 'danger' },
    };

    const { label, variant } = badgeMap[status] || badgeMap.DRAFT;

    return (
      <Badge variant={variant} className={status === 'CANCELLED' ? 'line-through' : undefined}>
        {label}
      </Badge>
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
          {tournament.poster_url && !imgError ? (
            <Image
              src={tournament.poster_url}
              alt={tournament.title}
              fill
              className="object-cover"
              unoptimized
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-4xl">
              🎾
            </div>
          )}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
            {canManage ? (
              <button
                onClick={handleCopyTemplate}
                className="bg-(--bg-card)/90 hover:bg-(--bg-card) text-(--text-secondary) p-2 rounded-lg shadow-sm backdrop-blur-sm transition-all hover:scale-110"
                title="템플릿으로 사용"
              >
                <Copy className="w-4 h-4" aria-hidden="true" />
              </button>
            ) : (
              <span />
            )}
            {getStatusBadge(tournament.status)}
          </div>
        </div>
        
        <div className="p-5">
          <div className="text-sm text-(--accent-color) font-medium mb-1">
            {formatDateRange(tournament.start_date, tournament.end_date)}
          </div>
          <h3 className="text-lg font-bold text-(--text-primary) mb-2 group-hover:text-(--accent-color) transition-colors line-clamp-2">
            {tournament.title}
          </h3>
          <div className="flex items-center text-(--text-muted) text-sm gap-4">
             <div className="flex items-center gap-1">
               <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
               {tournament.location}
             </div>
             {formatMatchType() && (
               <div className="flex items-center gap-1">
                 {formatMatchType()}
               </div>
             )}
          </div>
        </div>
      </div>
    </Link>
  );
}
