/** 홈 페이지 로딩 스켈레톤 */
export default function HomeLoading() {
  return (
    <div className="max-w-content mx-auto px-4 py-8 space-y-8">
      {/* 히어로 배너 */}
      <div className="glass-card rounded-2xl p-8 animate-pulse">
        <div className="h-8 w-48 rounded mb-4" style={{ backgroundColor: "var(--bg-card-hover)" }} />
        <div className="h-5 w-72 rounded" style={{ backgroundColor: "var(--bg-card-hover)" }} />
      </div>

      {/* 대회 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="glass-card rounded-xl p-5 animate-pulse">
            <div className="h-40 w-full rounded-lg mb-4" style={{ backgroundColor: "var(--bg-card-hover)" }} />
            <div className="h-5 w-40 rounded mb-3" style={{ backgroundColor: "var(--bg-card-hover)" }} />
            <div className="h-4 w-28 rounded mb-2" style={{ backgroundColor: "var(--bg-card-hover)" }} />
            <div className="h-4 w-24 rounded" style={{ backgroundColor: "var(--bg-card-hover)" }} />
          </div>
        ))}
      </div>
    </div>
  );
}
