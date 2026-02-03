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
export type SkillLevel = string
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER'
export type TournamentStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type TournamentFormat = 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION' | 'LEAGUE' | 'MIXED'
export type EntryStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

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
          skill_level: SkillLevel | null
          ntrp_rating: number | null
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
          skill_level?: SkillLevel | null
          ntrp_rating?: number | null
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
          skill_level?: SkillLevel | null
          ntrp_rating?: number | null
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
          requirements?: Json | null
          poster_url?: string | null
          organizer_id?: string
          updated_at?: string
        }
      }
      tournament_entries: {
        Row: {
          id: string
          tournament_id: string
          user_id: string
          status: EntryStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tournament_id: string
          user_id: string
          status?: EntryStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tournament_id?: string
          user_id?: string
          status?: EntryStatus
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
      user_role: UserRole
      tournament_status: TournamentStatus
      tournament_format: TournamentFormat
      entry_status: EntryStatus
    }
  }
}
