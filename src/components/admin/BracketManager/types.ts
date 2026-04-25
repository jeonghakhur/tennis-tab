import type { BracketStatus, MatchPhase, MatchStatus, MatchType, SetDetail, TeamMember, TournamentStatus } from "@/lib/supabase/types";

export type { SetDetail } from "@/lib/supabase/types";

export interface Division {
  id: string;
  name: string;
  max_teams: number | null;
}

/** 대회가 마감되어 대진표 수정 불가한 상태 */
export const CLOSED_TOURNAMENT_STATUSES: TournamentStatus[] = ['COMPLETED', 'CANCELLED'];

export interface BracketManagerProps {
  tournamentId: string;
  divisions: Division[];
  teamMatchCount: number | null;
  matchType: MatchType | null;
  tournamentStatus: TournamentStatus;
}

export interface BracketConfig {
  id: string;
  division_id: string;
  has_preliminaries: boolean;
  third_place_match: boolean;
  group_size: number;
  bracket_size: number | null;
  status: BracketStatus;
  /** 조편성 공개 여부 */
  publish_groups: boolean;
  /** 예선 공개 여부 */
  publish_preliminary: boolean;
  /** 본선 공개 여부 */
  publish_main: boolean;
  /** 현재 점수 입력 가능한 페이즈 (NULL = 비활성) */
  active_phase: string | null;
  /** 현재 점수 입력 가능한 라운드 (NULL = 해당 페이즈 전체) */
  active_round: number | null;
}

export interface GroupTeam {
  id: string;
  entry_id: string;
  seed_number: number | null;
  final_rank: number | null;
  wins: number;
  losses: number;
  points_for: number;
  points_against: number;
  entry?: {
    id: string;
    player_name: string;
    club_name: string | null;
    team_order: string | null;
    partner_data: { name: string; rating: number; club: string | null } | null;
    team_members: TeamMember[] | null;
    applicant_participates: boolean;
  };
}

export interface PreliminaryGroup {
  id: string;
  name: string;
  display_order: number;
  group_teams?: GroupTeam[];
}

export interface BracketMatch {
  id: string;
  phase: MatchPhase;
  group_id: string | null;
  bracket_position: number | null;
  round_number: number | null;
  match_number: number;
  team1_entry_id: string | null;
  team2_entry_id: string | null;
  team1_score: number | null;
  team2_score: number | null;
  winner_entry_id: string | null;
  status: MatchStatus;
  sets_detail: SetDetail[] | null;
  court_location: string | null;
  court_number: string | null;
  team1?: { id: string; player_name: string; club_name: string | null; team_order: string | null; partner_data: { name: string; rating: number; club: string | null } | null; team_members: TeamMember[] | null; applicant_participates: boolean };
  team2?: { id: string; player_name: string; club_name: string | null; team_order: string | null; partner_data: { name: string; rating: number; club: string | null } | null; team_members: TeamMember[] | null; applicant_participates: boolean };
}

export const phaseLabels: Record<MatchPhase, string> = {
  PRELIMINARY: "예선",
  ROUND_128: "128강",
  ROUND_64: "64강",
  ROUND_32: "32강",
  ROUND_16: "16강",
  QUARTER: "8강",
  SEMI: "4강",
  FINAL: "결승",
  THIRD_PLACE: "3/4위전",
};
