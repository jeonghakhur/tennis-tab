import { Suspense } from 'react'
import { Navigation } from '@/components/Navigation'
import { AwardsFilters } from '@/components/awards/AwardsFilters'
import { AwardsList } from '@/components/awards/AwardsList'
import { getAwards, getAwardsFilterOptions } from '@/lib/awards/actions'

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function first(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0]
  return v
}

async function AwardsContent({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const year = first(searchParams.year)
  const competition = first(searchParams.competition)
  const rank = first(searchParams.rank)

  const [awards, filterOptions] = await Promise.all([
    getAwards({
      year: year ? Number(year) : undefined,
      competition,
      rank,
    }),
    getAwardsFilterOptions(),
  ])

  const currentParams: Record<string, string | undefined> = { year, competition, rank }

  return (
    <>
      <AwardsFilters
        years={filterOptions.years}
        competitions={filterOptions.competitions}
        currentParams={currentParams}
      />
      <AwardsList awards={awards} />
    </>
  )
}

export default async function AwardsPage({ searchParams }: PageProps) {
  const params = await searchParams

  return (
    <>
      <Navigation />
      <main style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="max-w-content mx-auto px-6 py-12">
          <div className="mb-8">
            <h1
              className="text-3xl font-display tracking-wider mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              명예의 전당
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              마포구 테니스 대회 역대 입상자 기록
            </p>
          </div>

          <Suspense
            fallback={
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-xl p-4 h-32 animate-pulse"
                    style={{ backgroundColor: 'var(--bg-card)' }}
                  />
                ))}
              </div>
            }
          >
            <AwardsContent searchParams={params} />
          </Suspense>
        </div>
      </main>
    </>
  )
}
