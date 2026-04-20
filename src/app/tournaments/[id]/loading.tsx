/** 대회 상세 로딩 스켈레톤 */
export default function TournamentDetailLoading() {
  return (
    <div className="max-w-content mx-auto px-4 py-8 space-y-6">
      {/* 포스터 */}
      <div className="glass-card rounded-2xl animate-pulse overflow-hidden">
        <div className="h-64 w-full" style={{ backgroundColor: "var(--bg-card-hover)" }} />
      </div>

      {/* 제목 + 정보 */}
      <div className="space-y-3 animate-pulse">
        <div className="h-8 w-64 rounded" style={{ backgroundColor: "var(--bg-card-hover)" }} />
        <div className="flex gap-3">
          <div className="h-5 w-24 rounded" style={{ backgroundColor: "var(--bg-card-hover)" }} />
          <div className="h-5 w-32 rounded" style={{ backgroundColor: "var(--bg-card-hover)" }} />
        </div>
      </div>

      {/* 상세 카드 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-card rounded-xl p-5 animate-pulse">
              <div className="h-5 w-28 rounded mb-3" style={{ backgroundColor: "var(--bg-card-hover)" }} />
              <div className="h-4 w-full rounded mb-2" style={{ backgroundColor: "var(--bg-card-hover)" }} />
              <div className="h-4 w-3/4 rounded" style={{ backgroundColor: "var(--bg-card-hover)" }} />
            </div>
          ))}
        </div>
        <div className="glass-card rounded-xl p-5 animate-pulse h-fit">
          <div className="h-5 w-24 rounded mb-4" style={{ backgroundColor: "var(--bg-card-hover)" }} />
          <div className="h-12 w-full rounded-xl" style={{ backgroundColor: "var(--bg-card-hover)" }} />
        </div>
      </div>
    </div>
  );
}
