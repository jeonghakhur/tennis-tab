/** FAQ 카테고리 항목 (DB faq_categories 테이블) */
export interface FaqCategoryItem {
  slug: string
  name: string
  sort_order: number
  is_active: boolean
  created_at: string
}

/** FAQ 항목 */
export interface Faq {
  id: string
  category: string
  question: string
  answer: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

/** FAQ 생성/수정 입력 */
export interface FaqInput {
  category: string
  question: string
  answer: string
  sort_order?: number
  is_active?: boolean
}

/** FAQ 카테고리 생성/수정 입력 */
export interface FaqCategoryInput {
  slug: string
  name: string
  sort_order?: number
  is_active?: boolean
}
