// 클럽 관련 타입 정의

export type ClubJoinType = 'OPEN' | 'APPROVAL' | 'INVITE_ONLY'
export type ClubMemberRole = 'OWNER' | 'ADMIN' | 'MEMBER'
export type ClubMemberStatus = 'PENDING' | 'INVITED' | 'ACTIVE' | 'LEFT' | 'REMOVED'
export type GenderType = 'MALE' | 'FEMALE'

export interface Club {
  id: string
  name: string
  description: string | null
  city: string | null
  district: string | null
  address: string | null
  contact_phone: string | null
  contact_email: string | null
  join_type: ClubJoinType
  association_id: string | null
  max_members: number | null
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
  // JOIN 결과
  associations?: { name: string } | null
  _member_count?: number
}

export interface ClubMember {
  id: string
  club_id: string
  user_id: string | null
  is_registered: boolean
  name: string
  birth_date: string | null
  gender: GenderType | null
  phone: string | null
  start_year: string | null
  rating: number | null
  role: ClubMemberRole
  status: ClubMemberStatus
  status_reason: string | null
  invited_by: string | null
  joined_at: string | null
  created_at: string
  updated_at: string
}

// Server Action 입력 타입
export interface CreateClubInput {
  name: string
  description?: string
  city?: string
  district?: string
  address?: string
  contact_phone?: string
  contact_email?: string
  join_type?: ClubJoinType
  max_members?: number
}

export interface UpdateClubInput {
  name?: string
  description?: string
  city?: string
  district?: string
  address?: string
  contact_phone?: string
  contact_email?: string
  join_type?: ClubJoinType
  max_members?: number | null
}

export interface UnregisteredMemberInput {
  name: string
  birth_date?: string
  gender?: GenderType
  phone?: string
  start_year?: string
  rating?: number
}

export interface ClubFilters {
  search?: string
  city?: string
  district?: string
  association_id?: string
}
