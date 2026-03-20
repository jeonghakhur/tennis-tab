import type { Metadata } from 'next'
import { getCommunityPostForMeta } from '@/lib/meta/fetchers'
import { buildArticleJsonLd } from '@/lib/meta/jsonld'
import CommunityPostClient from './_components/CommunityPostClient'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const post = await getCommunityPostForMeta(id)
  if (!post) return {}

  // HTML 태그 제거 후 120자 미리보기
  const plainText = (post.content ?? '').replace(/<[^>]+>/g, '').slice(0, 120)
  const ogImage = post.images?.[0]

  return {
    title: post.title,
    description: plainText || post.title,
    openGraph: {
      title: post.title,
      description: plainText || post.title,
      ...(ogImage && {
        images: [{ url: ogImage, width: 1200, height: 630, alt: post.title }],
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: plainText || post.title,
      ...(ogImage && { images: [ogImage] }),
    },
  }
}

export default async function CommunityPostPage({ params }: Props) {
  const { id } = await params
  const post = await getCommunityPostForMeta(id)

  return (
    <>
      {/* Article 구조화 데이터 */}
      {post && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(buildArticleJsonLd(post)),
          }}
        />
      )}
      <CommunityPostClient postId={id} />
    </>
  )
}
