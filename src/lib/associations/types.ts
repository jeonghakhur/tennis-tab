// 협회 관련 타입 정의

export interface Association {
  id: string
  name: string
  region: string | null
  district: string | null
  description: string | null
  president_name: string | null
  president_phone: string | null
  president_email: string | null
  secretary_name: string | null
  secretary_phone: string | null
  secretary_email: string | null
  created_by: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AssociationManager {
  id: string
  association_id: string
  user_id: string
  assigned_by: string
  assigned_at: string
  // JOIN 결과
  profiles?: {
    name: string
    email: string
    phone: string | null
  }
}

// Server Action 입력 타입
export interface CreateAssociationInput {
  name: string
  region?: string
  district?: string
  description?: string
  president_name?: string
  president_phone?: string
  president_email?: string
  secretary_name?: string
  secretary_phone?: string
  secretary_email?: string
}

export interface UpdateAssociationInput {
  name?: string
  region?: string
  district?: string
  description?: string
  president_name?: string
  president_phone?: string
  president_email?: string
  secretary_name?: string
  secretary_phone?: string
  secretary_email?: string
}
