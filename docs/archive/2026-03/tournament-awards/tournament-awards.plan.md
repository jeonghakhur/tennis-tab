# Plan: 대회 입상자 이력 (Tournament Awards)

## 개요

마포테니스 레거시 시스템(Sanity CMS)에서 추출한 **429건의 역대 입상 기록**을 tennis-tab에 통합한다.
레거시 이전에 그치지 않고, 향후 서비스 내 대회가 종료될 때 **자동으로 입상 기록이 쌓이는 구조**까지 설계한다.

---

## 레거시 데이터 현황

| 항목 | 수치 |
|------|------|
| 총 입상 기록 | 429건 |
| 기간 | 2015 ~ 2025 (10년) |
| 대회 수 | 23개 |
| 고유 선수 이름 | 287명 |
| 현 서비스 유저와 이름 매칭 | 43명 (15%) |

**awardCategory**: 우승(161), 준우승(149), 공동3위(106), 3위(13)
**division 주요 부**: 챌린저부, 마스터부, 여자부, 퓨처스, 국화부, 개나리부, 은배부, 금배부
**gameType**: 단체전(269), 개인전(160)

### 레거시 데이터 구조 제약
- `players`: 이름 문자열 배열 — user_id 참조 없음
- `club`: 클럽 이름 문자열 — club_id 참조 없음
- 이름 매칭 15% → 자동 연동 위험, **수동 클레임** 방식 필수

---

## 기존 스키마 분석 (재검토)

### 주의: `tournament_divisions.prize_*` 컬럼과의 혼동
기존 `tournament_divisions`에 `prize_winner`, `prize_runner_up`, `prize_third` 컬럼이 이미 존재하지만,
이는 **상금/상품 텍스트**용 (`"50만원"`, `"트로피"` 등). 실제 **수상자 기록**과는 별개 → 신규 테이블 필요.

### 관련 기존 테이블

| 테이블 | 관련성 |
|--------|--------|
| `tournaments` | 대회 FK (미래 수상기록 연결) |
| `tournament_divisions` | 부문 FK (미래) |
| `tournament_entries` | 참가 entry FK (미래 — 우승자 entry) |
| `bracket_configs` / `bracket_matches` | `status=COMPLETED`인 FINAL 매치에서 우승자 자동 추출 가능 |
| `profiles` | 유저 연동 (클레임 후) |
| `clubs` | 클럽 연동 (이름 → id 매핑) |

### ClubMemberRole ENUM drift 발견 (선행 정리 권장)
- DB ENUM: `OWNER/ADMIN/MEMBER` (3개)
- `src/lib/clubs/types.ts`: `OWNER/ADMIN/VICE_PRESIDENT/ADVISOR/MATCH_DIRECTOR/MEMBER` (6개)
- awards 구현 전 마이그레이션으로 ENUM 동기화 필요

---

## 문제 정의

1. **역사적 맥락 부재**: 10년치 입상 이력 미보유 → 서비스 신뢰도·권위 낮음
2. **선수 동기부여 부족**: 대회 참가 시 과거 성적 확인 불가
3. **AI 채팅 한계**: "이 선수 입상 기록", "이 대회 우승자" 질의 응답 불가
4. **클럽 실적 불투명**: 클럽 페이지에 역대 성적 없음
5. **미래 대회 결과 연속성 없음**: 현 서비스 대회가 완료되어도 입상 기록이 쌓이지 않음

---

## 목표

1. `tournament_awards` 테이블 신설 (레거시 + 미래 대회 양용)
2. 레거시 429건 import (Python 스크립트)
3. **명예의 전당** 페이지 `/awards`
4. **프로필** "내 입상 기록" 탭 추가 (기존 탭 패턴 확장)
5. **클럽 상세** 입상 실적 탭 추가 (기존 탭 패턴 확장)
6. **AI 채팅** `VIEW_RESULTS` 핸들러에 수상 기록 통합
7. (Phase 2) 대회 완료 시 자동 입상 기록 생성

---

## 기능 범위

### Must Have (Phase 1 — MVP)
- [x] `tournament_awards` 테이블 + RLS + 마이그레이션
- [x] 레거시 data import 스크립트 (429건)
- [x] `/awards` 명예의 전당 페이지 (필터: 연도, 대회명, 부, 순위)
- [x] 프로필 `awards` 탭 — 이름 자동 조회 + 클레임 확인 UI
- [x] `src/lib/supabase/types.ts` 타입 추가

### Should Have (Phase 1 후반)
- [x] 클럽 상세 `awards` 탭 — 클럽명 기반 실적 표시
- [x] AI 채팅 — `VIEW_AWARDS` 별도 intent로 구현 (`VIEW_RESULTS` 확장 대신)
- [x] ~~관리자 입상 기록 편집 UI (`/admin/awards`)~~ — 프론트 클레임 UI로 대체, 별도 관리 불필요

### Could Have (Phase 2)
- [ ] 대회 FINAL 매치 완료 → `tournament_awards` 자동 생성 (`auto-award-registration.plan.md` 참조)
- [ ] 랭킹 포인트 시스템 (우승 3점, 준우승 2점, 3위 1점)
- [ ] ClubMemberRole ENUM drift 정리 마이그레이션

---

## DB 스키마 설계

### `tournament_awards` 테이블

```sql
CREATE TABLE public.tournament_awards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 레거시: 텍스트 기반 (tournament_id/division_id는 NULL 가능)
  competition     TEXT NOT NULL,          -- "제37회 마포구청장기"
  year            SMALLINT NOT NULL,      -- 2025
  division        TEXT NOT NULL,          -- "챌린저부"
  game_type       TEXT NOT NULL           -- "단체전" | "개인전"
                  CHECK (game_type IN ('단체전', '개인전')),
  award_rank      TEXT NOT NULL           -- '우승' | '준우승' | '공동3위' | '3위'
                  CHECK (award_rank IN ('우승', '준우승', '공동3위', '3위')),
  players         TEXT[] NOT NULL,        -- 선수 이름 배열 (레거시 호환)
  club_name       TEXT,                   -- 클럽 이름 문자열

  -- 미래 대회: FK 연결 (선택적)
  tournament_id   UUID REFERENCES public.tournaments(id) ON DELETE SET NULL,
  division_id     UUID REFERENCES public.tournament_divisions(id) ON DELETE SET NULL,
  entry_id        UUID REFERENCES public.tournament_entries(id) ON DELETE SET NULL,

  -- 유저 클레임 연동 (선택적)
  player_user_ids UUID[],                 -- 클레임 승인된 profiles.id 배열
  club_id         UUID REFERENCES public.clubs(id) ON DELETE SET NULL,

  -- 레거시 원본 ID (중복 import 방지)
  legacy_id       TEXT UNIQUE,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.tournament_awards ENABLE ROW LEVEL SECURITY;

-- 공개 읽기
CREATE POLICY "Anyone can view awards" ON public.tournament_awards
  FOR SELECT USING (true);

-- MANAGER+ 쓰기
CREATE POLICY "Managers can manage awards" ON public.tournament_awards
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('MANAGER', 'ADMIN', 'SUPER_ADMIN')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('MANAGER', 'ADMIN', 'SUPER_ADMIN')
    )
  );

-- 인덱스
CREATE INDEX idx_awards_year ON public.tournament_awards (year DESC);
CREATE INDEX idx_awards_competition ON public.tournament_awards (competition);
CREATE INDEX idx_awards_players ON public.tournament_awards USING GIN (players);
CREATE INDEX idx_awards_player_user_ids ON public.tournament_awards USING GIN (player_user_ids);
CREATE INDEX idx_awards_club_id ON public.tournament_awards (club_id);
CREATE INDEX idx_awards_tournament_id ON public.tournament_awards (tournament_id);
```

---

## UI 통합 위치 (기존 패턴 활용)

### 1. 명예의 전당 `/awards` (신규 페이지)
- Server Component + 필터 쿼리스트링 (`year`, `competition`, `division`, `rank`)
- 카드 그리드: 우승/준우승 배지, 선수명, 클럽, 연도
- `<Badge>` 컴포넌트 활용 (`success=우승`, `orange=준우승`, `secondary=3위`)
- Navigation에 링크 추가

### 2. 프로필 `/my/profile` — 탭 확장
기존 `activeTab: 'tournaments' | 'matches' | 'profile'` → `'awards'` 추가
```tsx
// 이름 기반 자동 조회 → 확인 모달 → 클레임
const myAwards = await supabase
  .from('tournament_awards')
  .select('*')
  .contains('players', [profile.full_name])
  // OR: player_user_ids에 이미 내 id가 있는 것
  .or(`player_user_ids.cs.{${userId}}`)
```
- 통계 카드 행: 우승 N회, 준우승 N회, 3위 N회 추가 (현재 5칸 그리드에 추가)

### 3. 클럽 상세 `/clubs/[id]` — 탭 확장
기존 `activeTab: 'info' | 'manage'` → `'awards'` 추가
- 클럽명 OR club_id로 조회 (club_id 매핑 완료 시)
- 부별 입상 현황 요약 테이블

### 4. AI 채팅 `VIEW_RESULTS` 핸들러 확장
기존 `VIEW_RESULTS`가 경기 결과 담당 → awards 조회 로직 추가
- entity: `player_name`, `competition_name`, `year`
- 응답: "김철수 선수는 2023년 마포구청장기 챌린저부 우승자입니다."

---

## Import 스크립트 설계

```python
# scripts/import_awards.py
# Sanity ndjson → Supabase tournament_awards

import json, os
from supabase import create_client

RANK_MAP = {
    '우승': '우승', '준우승': '준우승',
    '3위': '3위', '공동3위': '공동3위'
}

with open('data.ndjson') as f:
    docs = [json.loads(l) for l in f]

awards = [
    d for d in docs
    if d.get('_type') == 'award'
    and not d.get('_id', '').startswith('drafts.')
]

rows = []
for a in awards:
    rows.append({
        'competition': a['competition'],
        'year': a['year'],
        'division': a.get('division', ''),
        'game_type': a.get('gameType', '개인전'),
        'award_rank': RANK_MAP.get(a.get('awardCategory', ''), '우승'),
        'players': a.get('players', []),
        'club_name': a.get('club'),
        'legacy_id': a['_id'],
    })

# upsert (legacy_id UNIQUE로 중복 방지)
supabase.table('tournament_awards').upsert(rows, on_conflict='legacy_id').execute()
print(f'{len(rows)}건 import 완료')
```

---

## 채팅 핸들러 수정 포인트

```
src/lib/chat/
├── classify.ts          → QUERY_AWARDS 추가 OR VIEW_RESULTS 확장
├── handlers/
│   ├── index.ts         → 핸들러 매핑
│   └── viewResults.ts   → awards 조회 통합 (가장 자연스러운 위치)
└── types.ts             → Intent 유니온 + ChatEntities 확장
```

**`VIEW_RESULTS` 확장 전략** (신규 intent 추가보다 자연스러움):
- entities에 `player_name`, `competition_name`, `scope: 'awards'` 추가
- Gemini 프롬프트에 "입상 기록/수상 이력" 예시 추가

---

## 선행 작업 (권장)

| 작업 | 이유 |
|------|------|
| `ClubMemberRole` ENUM drift 정리 | club_id 매핑 시 클럽 조회에 필요 |
| `profiles.full_name` 컬럼 확인 | 이름 클레임 자동 매칭에 사용 |

---

## 구현 순서

1. **마이그레이션** (`15_tournament_awards.sql`) — 테이블 + RLS + 인덱스
2. **타입 추가** (`src/lib/supabase/types.ts`)
3. **Import 스크립트 실행** — 429건
4. **`/awards` 페이지** — Server Component + 필터
5. **프로필 탭** — 클레임 UI 포함
6. **클럽 탭** — 실적 표시
7. **채팅 핸들러** — `VIEW_RESULTS` 확장

---

## 성공 기준

- [x] 429건 import 완료 (0 loss, legacy_id 중복 없음)
- [x] `/awards` 페이지 연도·부·순위 필터 동작
- [x] 프로필에서 내 입상 기록 이름 자동 조회 + 클레임
- [x] 클럽 상세 페이지 실적 섹션 표시
- [x] AI 채팅 "입상 기록 알려줘" 응답 (`VIEW_AWARDS` intent)
