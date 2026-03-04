# Plan: 대회 완료 시 입상 기록 자동 등록

## 목표
결승/3·4위전 경기 결과 저장 시 `tournament_awards` 테이블에 입상 기록을 자동으로 생성한다.

## 배경
현재 `tournament_awards`는 레거시 Sanity 데이터를 수동 임포트한 상태이며,
신규 대회 결과는 자동으로 연동되지 않는다.
`updateMatchResultCore()`에서 FINAL/THIRD_PLACE 완료 시 `checkAndCompleteTournament()`만 호출되고
입상 기록 생성 로직은 없다.

## 구현 위치
`src/lib/bracket/actions.ts` — `updateMatchResultCore()` 내부

```
FINAL 완료
  └─ createAwardRecords(supabaseAdmin, match, 'FINAL')
       ├─ 우승: winner_entry_id → entry 조회 → award INSERT
       └─ 준우승: loser_entry_id → entry 조회 → award INSERT

THIRD_PLACE 완료
  └─ createAwardRecords(supabaseAdmin, match, 'THIRD_PLACE')
       └─ 3위: winner_entry_id → award INSERT

3위전 없는 경우 (4강 패자 2명 → 공동3위)
  └─ FINAL 완료 시 THIRD_PLACE 매치가 없으면
       4강 loser_next_match_id 역추적 → 공동3위 2건 INSERT
```

## entry → award 변환 정보
- `tournament_entries`에서 `player_name`, `club_name`, `partner_data`, `team_members` 조회
- `tournament_divisions`에서 `name`(부문명) 조회
- `tournaments`에서 `title`(대회명), `start_date`(연도) 조회
- `game_type`: `match_type`이 TEAM_* → 단체전, 나머지 → 개인전
- `players`: 개인전 단식 `[player_name]`, 복식 `[player_name, partner_data.name]`, 단체전 `team_members[].name`

## 중복 방지
- `tournament_id + division_id + award_rank` 조합 UNIQUE 제약 추가 (마이그레이션)
- 또는 upsert(`on_conflict`) 처리

## 결과 수정 시 처리
- 이미 등록된 입상 기록이 있는 상태에서 점수를 수정하면 기존 레코드 삭제 후 재생성
- `invalidateDownstreamMatches()` 호출 시 함께 처리

## 관련 파일
- `src/lib/bracket/actions.ts` — `updateMatchResultCore`, `checkAndCompleteTournament`
- `src/components/admin/BracketManager/MatchRow.tsx` — 점수 입력 UI
- `src/lib/awards/actions.ts` — 기존 award 조회 로직 재활용
- `supabase/migrations/16_auto_award_trigger.sql` — UNIQUE 제약 추가

## 구현 결과

- [x] `createAwardRecords()` 함수 구현 (`src/lib/bracket/actions.ts`)
- [x] `updateMatchResultCore()`에서 FINAL/THIRD_PLACE 완료 시 자동 호출
- [x] 우승/준우승/공동3위/3위 INSERT 로직
- [x] 결과 수정 시 DELETE 후 재생성 (결과 수정 대응)
- [x] 3위전 없는 대회: SEMI 패자 2명 → 공동3위 자동 처리
- [x] 개인전/복식/단체전 players 배열 변환
- [x] `supabase/migrations/16_auto_award_trigger.sql` — DELETE+INSERT 방식으로 UNIQUE 제약 불필요 (마이그레이션 불필요)

## 검증 결과 (2026-03-04)
제8회 마포구체육회장기 테니스대회 국화부(INDIVIDUAL_DOUBLES, 3위전 없음)로 직접 검증:
- 우승: 김태윤/장영숙 (테니스마인드) ✅
- 준우승: 조재헌/유병준 (태영회) ✅
- 공동3위: 김권영/오세태 (불금테) ✅
- 공동3위: 이헌/김성수 (건우회) ✅

복식 `partner_data.name` 추출, SEMI 패자 자동 공동3위, DELETE+INSERT 모두 정상 동작.

## 우선순위
~~낮음~~ → **완료** (2026-03-04)
