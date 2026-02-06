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

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER'
export type TournamentStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type TournamentFormat = 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION' | 'LEAGUE' | 'MIXED'
export type MatchType = 'INDIVIDUAL_SINGLES' | 'INDIVIDUAL_DOUBLES' | 'TEAM_SINGLES' | 'TEAM_DOUBLES'
export type EntryStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CONFIRMED' | 'WAITLISTED' | 'CANCELLED'
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

// 대진표 시스템 타입
export type BracketStatus = 'DRAFT' | 'PRELIMINARY' | 'MAIN' | 'COMPLETED'
export type MatchPhase = 'PRELIMINARY' | 'ROUND_128' | 'ROUND_64' | 'ROUND_32' | 'ROUND_16' | 'QUARTER' | 'SEMI' | 'FINAL' | 'THIRD_PLACE'
export type MatchStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'BYE'

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
          team_match_count: number | null
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
          team_match_count?: number | null
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
          team_match_count?: number | null
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
      // 대진표 시스템 테이블
      bracket_configs: {
        Row: {
          id: string
          division_id: string
          has_preliminaries: boolean
          third_place_match: boolean
          bracket_size: number | null
          status: BracketStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          division_id: string
          has_preliminaries?: boolean
          third_place_match?: boolean
          bracket_size?: number | null
          status?: BracketStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          division_id?: string
          has_preliminaries?: boolean
          third_place_match?: boolean
          bracket_size?: number | null
          status?: BracketStatus
          updated_at?: string
        }
      }
      preliminary_groups: {
        Row: {
          id: string
          bracket_config_id: string
          name: string
          display_order: number
          created_at: string
        }
        Insert: {
          id?: string
          bracket_config_id: string
          name: string
          display_order: number
          created_at?: string
        }
        Update: {
          id?: string
          bracket_config_id?: string
          name?: string
          display_order?: number
        }
      }
      group_teams: {
        Row: {
          id: string
          group_id: string
          entry_id: string
          seed_number: number | null
          final_rank: number | null
          wins: number
          losses: number
          points_for: number
          points_against: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          group_id: string
          entry_id: string
          seed_number?: number | null
          final_rank?: number | null
          wins?: number
          losses?: number
          points_for?: number
          points_against?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          entry_id?: string
          seed_number?: number | null
          final_rank?: number | null
          wins?: number
          losses?: number
          points_for?: number
          points_against?: number
          updated_at?: string
        }
      }
      bracket_matches: {
        Row: {
          id: string
          bracket_config_id: string
          phase: MatchPhase
          group_id: string | null
          bracket_position: number | null
          round_number: number | null
          match_number: number
          team1_entry_id: string | null
          team2_entry_id: string | null
          team1_score: number | null
          team2_score: number | null
          winner_entry_id: string | null
          next_match_id: string | null
          next_match_slot: number | null
          loser_next_match_id: string | null
          loser_next_match_slot: number | null
          status: MatchStatus
          scheduled_time: string | null
          completed_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          bracket_config_id: string
          phase: MatchPhase
          group_id?: string | null
          bracket_position?: number | null
          round_number?: number | null
          match_number: number
          team1_entry_id?: string | null
          team2_entry_id?: string | null
          team1_score?: number | null
          team2_score?: number | null
          winner_entry_id?: string | null
          next_match_id?: string | null
          next_match_slot?: number | null
          loser_next_match_id?: string | null
          loser_next_match_slot?: number | null
          status?: MatchStatus
          scheduled_time?: string | null
          completed_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          bracket_config_id?: string
          phase?: MatchPhase
          group_id?: string | null
          bracket_position?: number | null
          round_number?: number | null
          match_number?: number
          team1_entry_id?: string | null
          team2_entry_id?: string | null
          team1_score?: number | null
          team2_score?: number | null
          winner_entry_id?: string | null
          next_match_id?: string | null
          next_match_slot?: number | null
          loser_next_match_id?: string | null
          loser_next_match_slot?: number | null
          status?: MatchStatus
          scheduled_time?: string | null
          completed_at?: string | null
          notes?: string | null
          updated_at?: string
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
      user_role: UserRole
      tournament_status: TournamentStatus
      tournament_format: TournamentFormat
      match_type: MatchType
      entry_status: EntryStatus
      payment_status: PaymentStatus
      bracket_status: BracketStatus
      match_phase: MatchPhase
      match_status: MatchStatus
    }
  }
}
