-- ============================================================
-- Club Session 기능: 정기 모임 일정, 참석 응답, 경기 결과, 통계
-- ============================================================

-- ENUM 타입
CREATE TYPE club_session_status AS ENUM ('OPEN', 'CLOSED', 'CANCELLED', 'COMPLETED');
CREATE TYPE attendance_status AS ENUM ('ATTENDING', 'NOT_ATTENDING', 'UNDECIDED');
CREATE TYPE match_result_status AS ENUM ('SCHEDULED', 'COMPLETED', 'DISPUTED', 'CANCELLED');

-- ============================================================
-- club_sessions
-- ============================================================
CREATE TABLE club_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  venue_name      TEXT NOT NULL,
  court_numbers   TEXT[] NOT NULL DEFAULT '{}',
  session_date    DATE NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  max_attendees   INT,
  status          club_session_status NOT NULL DEFAULT 'OPEN',
  rsvp_deadline   TIMESTAMPTZ,
  notes           TEXT,
  created_by      UUID NOT NULL REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_session_time CHECK (end_time > start_time)
);

-- ============================================================
-- club_session_attendances
-- ============================================================
CREATE TABLE club_session_attendances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES club_sessions(id) ON DELETE CASCADE,
  club_member_id  UUID NOT NULL REFERENCES club_members(id) ON DELETE CASCADE,
  status          attendance_status NOT NULL DEFAULT 'UNDECIDED',
  available_from  TIME,
  available_until TIME,
  notes           TEXT,
  responded_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(session_id, club_member_id)
);

-- ============================================================
-- club_match_results
-- ============================================================
CREATE TABLE club_match_results (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id           UUID NOT NULL REFERENCES club_sessions(id) ON DELETE CASCADE,
  player1_member_id    UUID NOT NULL REFERENCES club_members(id),
  player2_member_id    UUID NOT NULL REFERENCES club_members(id),
  court_number         TEXT,
  scheduled_time       TIME,
  player1_score        INT,
  player2_score        INT,
  winner_member_id     UUID REFERENCES club_members(id),
  status               match_result_status NOT NULL DEFAULT 'SCHEDULED',

  -- 분쟁 처리
  player1_reported_score_p1  INT,
  player1_reported_score_p2  INT,
  player2_reported_score_p1  INT,
  player2_reported_score_p2  INT,
  dispute_resolved_by  UUID REFERENCES profiles(id),
  dispute_resolved_at  TIMESTAMPTZ,

  reported_by          UUID REFERENCES profiles(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_different_players CHECK (player1_member_id <> player2_member_id)
);

-- ============================================================
-- club_member_stats
-- ============================================================
CREATE TABLE club_member_stats (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id           UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  club_member_id    UUID NOT NULL REFERENCES club_members(id) ON DELETE CASCADE,
  season            TEXT NOT NULL DEFAULT to_char(now(), 'YYYY'),
  total_games       INT NOT NULL DEFAULT 0,
  wins              INT NOT NULL DEFAULT 0,
  losses            INT NOT NULL DEFAULT 0,
  win_rate          NUMERIC(5,2) GENERATED ALWAYS AS (
                      CASE WHEN total_games = 0 THEN 0
                      ELSE ROUND(wins::numeric / total_games * 100, 2)
                      END
                    ) STORED,
  sessions_attended INT NOT NULL DEFAULT 0,
  last_played_at    TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(club_id, club_member_id, season)
);

-- ============================================================
-- 인덱스
-- ============================================================
CREATE INDEX idx_club_sessions_club_id      ON club_sessions(club_id);
CREATE INDEX idx_club_sessions_date         ON club_sessions(session_date);
CREATE INDEX idx_club_sessions_status       ON club_sessions(status);
CREATE INDEX idx_session_attendances_session ON club_session_attendances(session_id);
CREATE INDEX idx_session_attendances_member  ON club_session_attendances(club_member_id);
CREATE INDEX idx_club_match_results_session  ON club_match_results(session_id);
CREATE INDEX idx_club_match_results_player1  ON club_match_results(player1_member_id);
CREATE INDEX idx_club_match_results_player2  ON club_match_results(player2_member_id);
CREATE INDEX idx_club_member_stats_club      ON club_member_stats(club_id, season);
CREATE INDEX idx_club_member_stats_member    ON club_member_stats(club_member_id, season);

-- ============================================================
-- RLS 정책
-- ============================================================

-- club_sessions
ALTER TABLE club_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions_select" ON club_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM club_members
      WHERE club_id = club_sessions.club_id
        AND user_id = auth.uid()
        AND status = 'ACTIVE'
    )
  );

CREATE POLICY "sessions_insert" ON club_sessions FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM club_members
      WHERE club_id = club_sessions.club_id
        AND user_id = auth.uid()
        AND role IN ('OWNER', 'ADMIN', 'MATCH_DIRECTOR')
        AND status = 'ACTIVE'
    )
  );

CREATE POLICY "sessions_update" ON club_sessions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM club_members
      WHERE club_id = club_sessions.club_id
        AND user_id = auth.uid()
        AND role IN ('OWNER', 'ADMIN', 'MATCH_DIRECTOR')
        AND status = 'ACTIVE'
    )
  );

-- club_session_attendances
ALTER TABLE club_session_attendances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendances_select" ON club_session_attendances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM club_sessions cs
      JOIN club_members cm ON cm.club_id = cs.club_id
      WHERE cs.id = club_session_attendances.session_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'ACTIVE'
    )
  );

CREATE POLICY "attendances_insert" ON club_session_attendances FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM club_members
      WHERE id = club_session_attendances.club_member_id
        AND user_id = auth.uid()
        AND status = 'ACTIVE'
    )
  );

CREATE POLICY "attendances_update" ON club_session_attendances FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM club_members
      WHERE id = club_session_attendances.club_member_id
        AND user_id = auth.uid()
        AND status = 'ACTIVE'
    )
  );

-- club_match_results
ALTER TABLE club_match_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "match_results_select" ON club_match_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM club_sessions cs
      JOIN club_members cm ON cm.club_id = cs.club_id
      WHERE cs.id = club_match_results.session_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'ACTIVE'
    )
  );

CREATE POLICY "match_results_insert" ON club_match_results FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM club_members cm
      JOIN club_sessions cs ON cs.club_id = cm.club_id
      WHERE cs.id = club_match_results.session_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'ACTIVE'
        AND (
          cm.id IN (
            club_match_results.player1_member_id,
            club_match_results.player2_member_id
          )
          OR cm.role IN ('OWNER', 'ADMIN', 'MATCH_DIRECTOR')
        )
    )
  );

CREATE POLICY "match_results_update" ON club_match_results FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM club_members cm
      JOIN club_sessions cs ON cs.club_id = cm.club_id
      WHERE cs.id = club_match_results.session_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'ACTIVE'
        AND (
          cm.id IN (
            club_match_results.player1_member_id,
            club_match_results.player2_member_id
          )
          OR cm.role IN ('OWNER', 'ADMIN', 'MATCH_DIRECTOR')
        )
    )
  );

-- club_member_stats
ALTER TABLE club_member_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stats_select" ON club_member_stats FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM club_members
      WHERE club_id = club_member_stats.club_id
        AND user_id = auth.uid()
        AND status = 'ACTIVE'
    )
  );
-- stats INSERT/UPDATE는 admin client로만 실행 (Server Action)
