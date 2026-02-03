import Link from 'next/link';
import { Database } from '@/lib/supabase/types';

type Tournament = Database['public']['Tables']['tournaments']['Row'];

interface TournamentCardProps {
  tournament: Tournament;
}

export default function TournamentCard({ tournament }: TournamentCardProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      DRAFT: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
      OPEN: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      CLOSED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      IN_PROGRESS: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      COMPLETED: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
      CANCELLED: 'bg-gray-100 text-gray-800 line-through dark:bg-gray-800 dark:text-gray-500',
    };
    const labels = {
      DRAFT: '작성 중',
      OPEN: '모집 중',
      CLOSED: '마감',
      IN_PROGRESS: '진행 중',
      COMPLETED: '종료',
      CANCELLED: '취소',
    };
    
    // @ts-ignore
    const style = styles[status] || styles.DRAFT;
    // @ts-ignore
    const label = labels[status] || status;

    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${style}`}>
        {label}
      </span>
    );
  };

  return (
    <Link 
      href={`/tournaments/${tournament.id}`}
      className="block group"
    >
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 hover:border-blue-500/30">
        <div className="aspect-[3/2] bg-gray-100 dark:bg-gray-800 relative">
          {/* Placeholder for image */}
          <div className="absolute inset-0 flex items-center justify-center text-4xl">
            🎾
          </div>
          <div className="absolute top-3 right-3">
             {getStatusBadge(tournament.status)}
          </div>
        </div>
        
        <div className="p-5">
          <div className="text-sm text-blue-600 dark:text-blue-400 font-medium mb-1">
            {formatDate(tournament.start_date)}
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 group-hover:text-blue-500 transition-colors line-clamp-2">
            {tournament.title}
          </h3>
          <div className="flex items-center text-gray-500 dark:text-gray-400 text-sm gap-4">
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
