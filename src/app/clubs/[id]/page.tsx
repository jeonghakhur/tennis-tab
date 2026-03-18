import type { Metadata } from 'next'
import { getClubForMeta } from '@/lib/meta/fetchers'
import { buildSportsOrgJsonLd } from '@/lib/meta/jsonld'
import ClubDetailClient from './_components/ClubDetailClient'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const club = await getClubForMeta(id)
  if (!club) return {}

  const description = club.description?.slice(0, 160) ?? `${club.name} — 마포구테니스협회 클럽`

  return {
    title: club.name,
    description,
    openGraph: {
      title: club.name,
      description,
      ...(club.logo_url && {
        images: [{ url: club.logo_url, width: 1200, height: 630, alt: club.name }],
      }),
    },
  }
}

export default async function ClubDetailPage({ params }: Props) {
  const { id } = await params
  // getClubForMeta는 cache()로 래핑되어 generateMetadata와 DB 쿼리 중복 없음
  const club = await getClubForMeta(id)

  return (
    <>
      {/* SportsOrganization 구조화 데이터 */}
      {club && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(buildSportsOrgJsonLd(club)),
          }}
        />
      )}
      <ClubDetailClient clubId={id} />
    </>
  )
}
