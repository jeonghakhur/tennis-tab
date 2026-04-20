/** 어드민 페이지 로딩 스켈레톤 */
export default function AdminLoading() {
  return (
    <div className="max-w-content mx-auto px-4 py-8 space-y-6">
      <div className="h-8 w-32 rounded animate-pulse" style={{ backgroundColor: "var(--bg-card-hover)" }} />
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="glass-card rounded-xl p-5 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-5 w-40 rounded" style={{ backgroundColor: "var(--bg-card-hover)" }} />
                <div className="h-4 w-28 rounded" style={{ backgroundColor: "var(--bg-card-hover)" }} />
              </div>
              <div className="h-8 w-20 rounded-lg" style={{ backgroundColor: "var(--bg-card-hover)" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
