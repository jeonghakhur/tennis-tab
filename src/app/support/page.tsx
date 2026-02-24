import { getFaqs, getFaqCategories } from '@/lib/faq/actions'
import { FaqSection } from '@/components/faq/FaqSection'
import { InquiryCards } from '@/components/support/InquiryCards'

export default async function SupportPage() {
  const [{ data: faqs }, { data: categories }] = await Promise.all([
    getFaqs(),
    getFaqCategories(),
  ])

  return (
    <main
      className=""
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      <div className="max-w-[1920px] mx-auto px-6 py-12">
        {/* 헤더 */}
        <div className="mb-10 text-center">
          <h1
            className="text-3xl font-display mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            고객센터
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            무엇을 도와드릴까요?
          </p>
        </div>

        {/* FAQ 섹션 */}
        <FaqSection faqs={faqs} categories={categories} />

        {/* 유도 문구 + 문의 카드 */}
        <div
          className="mt-12 pt-8 border-t text-center"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <p
            className="text-sm mb-6"
            style={{ color: 'var(--text-muted)' }}
          >
            원하는 답변을 찾지 못하셨나요?
          </p>
          <InquiryCards />
        </div>
      </div>
    </main>
  )
}
