/** 마이페이지 로딩 스켈레톤 */
export default function MyProfileLoading() {
  return (
    <div className="max-w-content mx-auto px-4 py-8 space-y-6">
      {/* 프로필 헤더 */}
      <div className="glass-card rounded-2xl p-6 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full" style={{ backgroundColor: "var(--bg-card-hover)" }} />
          <div className="space-y-2">
            <div className="h-6 w-28 rounded" style={{ backgroundColor: "var(--bg-card-hover)" }} />
            <div className="h-4 w-40 rounded" style={{ backgroundColor: "var(--bg-card-hover)" }} />
          </div>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card rounded-xl p-4 animate-pulse">
            <div className="h-4 w-16 rounded mb-2" style={{ backgroundColor: "var(--bg-card-hover)" }} />
            <div className="h-7 w-12 rounded" style={{ backgroundColor: "var(--bg-card-hover)" }} />
          </div>
        ))}
      </div>

      {/* 탭 + 컨텐츠 */}
      <div className="glass-card rounded-xl p-6 animate-pulse">
        <div className="flex gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 w-20 rounded-lg" style={{ backgroundColor: "var(--bg-card-hover)" }} />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 w-full rounded-xl" style={{ backgroundColor: "var(--bg-card-hover)" }} />
          ))}
        </div>
      </div>
    </div>
  );
}
