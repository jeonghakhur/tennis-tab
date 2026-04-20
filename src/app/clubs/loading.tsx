/** 클럽 목록 로딩 스켈레톤 */
export default function ClubsLoading() {
  return (
    <div className="max-w-content mx-auto px-4 py-8 space-y-6">
      <div className="h-8 w-24 rounded animate-pulse" style={{ backgroundColor: "var(--bg-card-hover)" }} />
      {/* 검색바 */}
      <div className="h-10 w-full rounded-xl animate-pulse" style={{ backgroundColor: "var(--bg-card-hover)" }} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="glass-card rounded-xl p-5 animate-pulse">
            <div className="h-5 w-32 rounded mb-3" style={{ backgroundColor: "var(--bg-card-hover)" }} />
            <div className="h-4 w-24 rounded mb-2" style={{ backgroundColor: "var(--bg-card-hover)" }} />
            <div className="h-4 w-20 rounded mb-4" style={{ backgroundColor: "var(--bg-card-hover)" }} />
            <div className="h-8 w-full rounded" style={{ backgroundColor: "var(--bg-card-hover)" }} />
          </div>
        ))}
      </div>
    </div>
  );
}
