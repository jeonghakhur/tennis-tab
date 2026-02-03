/**
 * Supabase 데이터베이스 타입 정의
 * PRD.md의 데이터 모델을 기반으로 작성
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// 입문 년도 (문자열: '2026', '2025', ..., '2016년 이전')
export type StartYear = string

// 연차 기반 skill_level
export type SkillLevel =
  | '1_YEAR'
  | '2_YEARS'
  | '3_YEARS'
  | '4_YEARS'
  | '5_YEARS'
  | '6_YEARS'
  | '7_YEARS'
  | '8_YEARS'
  | '9_YEARS'
  | '10_PLUS_YEARS'

// 주 사용 손
export type DominantHand = 'LEFT' | 'RIGHT' | 'BOTH'

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER'
export type TournamentStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type TournamentFormat = 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION' | 'LEAGUE' | 'MIXED'
export type MatchType = 'INDIVIDUAL_SINGLES' | 'INDIVIDUAL_DOUBLES' | 'TEAM_SINGLES' | 'TEAM_DOUBLES'
export type EntryStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

// 파트너 정보 (개인전 복식용)
export interface PartnerData {
  name: string
  club: string
  rating: number
}

// 팀원 정보 (단체전용)
export interface TeamMember {
  name: string
  rating: number
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          name: string
          avatar_url: string | null
          phone: string | null
          start_year: StartYear | null
          rating: number | null
          skill_level: SkillLevel | null
          dominant_hand: DominantHand | null
          club: string | null
          club_city: string | null
          club_district: string | null
          role: UserRole | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          name: string
          avatar_url?: string | null
          phone?: string | null
          start_year?: StartYear | null
          rating?: number | null
          skill_level?: SkillLevel | null
          dominant_hand?: DominantHand | null
          club?: string | null
          club_city?: string | null
          club_district?: string | null
          role?: UserRole | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          avatar_url?: string | null
          phone?: string | null
          start_year?: StartYear | null
          rating?: number | null
          skill_level?: SkillLevel | null
          dominant_hand?: DominantHand | null
          club?: string | null
          club_city?: string | null
          club_district?: string | null
          role?: UserRole | null
          updated_at?: string
        }
      }
      tournaments: {
        Row: {
          id: string
          title: string
          description: string | null
          start_date: string
          end_date: string
          location: string
          address: string | null
          max_participants: number
          entry_fee: number
          status: TournamentStatus
          format: TournamentFormat
          match_type: MatchType | null
          host: string | null
          organizer_name: string | null
          ball_type: string | null
          entry_start_date: string | null
          entry_end_date: string | null
          opening_ceremony: string | null
          bank_account: string | null
          eligibility: string | null
          requirements: Json | null
          poster_url: string | null
          organizer_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          start_date: string
          end_date: string
          location: string
          address?: string | null
          max_participants: number
          entry_fee?: number
          status?: TournamentStatus
          format: TournamentFormat
          match_type?: MatchType | null
          host?: string | null
          organizer_name?: string | null
          ball_type?: string | null
          entry_start_date?: string | null
          entry_end_date?: string | null
          opening_ceremony?: string | null
          bank_account?: string | null
          eligibility?: string | null
          requirements?: Json | null
          poster_url?: string | null
          organizer_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          start_date?: string
          end_date?: string
          location?: string
          address?: string | null
          max_participants?: number
          entry_fee?: number
          status?: TournamentStatus
          format?: TournamentFormat
          match_type?: MatchType | null
          host?: string | null
          organizer_name?: string | null
          ball_type?: string | null
          entry_start_date?: string | null
          entry_end_date?: string | null
          opening_ceremony?: string | null
          bank_account?: string | null
          eligibility?: string | null
          requirements?: Json | null
          poster_url?: string | null
          organizer_id?: string
          updated_at?: string
        }
      }
      tournament_divisions: {
        Row: {
          id: string
          tournament_id: string
          name: string
          max_teams: number | null
          team_member_limit: number | null
          match_date: string | null
          match_location: string | null
          prize_winner: string | null
          prize_runner_up: string | null
          prize_third: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tournament_id: string
          name: string
          max_teams?: number | null
          team_member_limit?: number | null
          match_date?: string | null
          match_location?: string | null
          prize_winner?: string | null
          prize_runner_up?: string | null
          prize_third?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tournament_id?: string
          name?: string
          max_teams?: number | null
          team_member_limit?: number | null
          match_date?: string | null
          match_location?: string | null
          prize_winner?: string | null
          prize_runner_up?: string | null
          prize_third?: string | null
          notes?: string | null
          updated_at?: string
        }
      }
      tournament_entries: {
        Row: {
          id: string
          tournament_id: string
          user_id: string
          division_id: string
          status: EntryStatus
          phone: string
          player_name: string
          player_rating: number | null
          club_name: string | null
          team_order: string | null
          partner_data: PartnerData | null
          team_members: TeamMember[] | null
          payment_status: PaymentStatus
          payment_confirmed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tournament_id: string
          user_id: string
          division_id: string
          status?: EntryStatus
          phone: string
          player_name: string
          player_rating?: number | null
          club_name?: string | null
          team_order?: string | null
          partner_data?: PartnerData | null
          team_members?: TeamMember[] | null
          payment_status?: PaymentStatus
          payment_confirmed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tournament_id?: string
          user_id?: string
          division_id?: string
          status?: EntryStatus
          phone?: string
          player_name?: string
          player_rating?: number | null
          club_name?: string | null
          team_order?: string | null
          partner_data?: PartnerData | null
          team_members?: TeamMember[] | null
          payment_status?: PaymentStatus
          payment_confirmed_at?: string | null
          updated_at?: string
        }
      }
      matches: {
        Row: {
          id: string
          tournament_id: string
          round: number
          match_number: number
          player1_id: string | null
          player2_id: string | null
          winner_id: string | null
          score: string | null
          court_number: string | null
          scheduled_at: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tournament_id: string
          round: number
          match_number: number
          player1_id?: string | null
          player2_id?: string | null
          winner_id?: string | null
          score?: string | null
          court_number?: string | null
          scheduled_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tournament_id?: string
          round?: number
          match_number?: number
          player1_id?: string | null
          player2_id?: string | null
          winner_id?: string | null
          score?: string | null
          court_number?: string | null
          scheduled_at?: string | null
          completed_at?: string | null
          updated_at?: string
        }
      }
      chat_logs: {
        Row: {
          id: string
          user_id: string | null
          session_id: string | null
          message: string
          response: string
          intent: string | null
          entities: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          session_id?: string | null
          message: string
          response: string
          intent?: string | null
          entities?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          session_id?: string | null
          message?: string
          response?: string
          intent?: string | null
          entities?: Json | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      skill_level: SkillLevel
      dominant_hand: DominantHand
      user_role: UserRole
      tournament_status: TournamentStatus
      tournament_format: TournamentFormat
      match_type: MatchType
      entry_status: EntryStatus
      payment_status: PaymentStatus
    }
  }
}
