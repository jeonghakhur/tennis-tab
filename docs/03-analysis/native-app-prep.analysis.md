# Native App Prep 문서 Gap Analysis Report

> **Analysis Type**: Design Document vs Codebase 정합성 분석
>
> **Project**: tennis-tab
> **Version**: 1.1.0
> **Analyst**: Claude (gap-detector + pdca-iterator)
> **Date**: 2026-03-05
> **Design Docs**: `docs/native-app-prep/` (4개 파일)

---

## 1. Analysis Overview

### 1.1 Analysis Purpose

네이티브 앱 개발 준비 문서 4종이 현재 웹 코드베이스를 정확히 반영하는지 검증한다.
문서가 오래되거나 누락된 정보가 있으면 네이티브 앱 개발 시 혼란이 발생하므로,
코드 기준 실제 상태(truth)와의 차이를 정밀하게 파악한다.

### 1.2 Analysis Scope

| 문서 | 경로 | 비교 대상 |
|------|------|-----------|
| native-screens.md | `docs/native-app-prep/native-screens.md` | `src/app/**/page.tsx` |
| shared-code.md | `docs/native-app-prep/shared-code.md` | `src/lib/utils/`, `src/lib/*/actions.ts` |
| supabase-schema.md | `docs/native-app-prep/supabase-schema.md` | `supabase/migrations/*.sql`, `src/lib/supabase/types.ts` |
| project-structure.md | `docs/native-app-prep/project-structure.md` | `package.json`, 실제 파일 구조 |

---

## 2. Overall Scores (v1.1 — Iteration 1 완료)

| Category | v1.0 Score | v1.1 Score | Status |
|----------|:----------:|:----------:|:------:|
| native-screens.md | 82% | 92% | PASS |
| shared-code.md | 78% | 91% | PASS |
| supabase-schema.md | 75% | 92% | PASS |
| project-structure.md | 90% | 92% | PASS |
| **Overall** | **81%** | **92%** | **PASS** |

---

## 3. Iteration Summary (v1.0 → v1.1)

### 3.1 supabase-schema.md 수정 내역

| 분류 | 항목 | 수정 내용 |
|------|------|-----------|
| Critical | bracket_matches 컬럼명 전면 교정 | `config_id` → `bracket_config_id`, `entry1_id/entry2_id` → `team1_entry_id/team2_entry_id`, `score1/score2` → `team1_score/team2_score`, `round` → `round_number`, `is_bye` 삭제 (status='BYE'로 처리) |
| Critical | bracket_matches 누락 컬럼 추가 | `group_id`, `bracket_position`, `next_match_slot`, `loser_next_match_slot`, `court_number`, `court_location`, `scheduled_time`, `completed_at`, `notes` |
| Critical | club_members 구조 전면 재작성 | profiles JOIN 구조 → 자체 필드 보유 구조로 수정. `is_registered`, `name`, `birth_date`, `gender`, `phone`, `start_year`, `rating`, `status_reason` 추가. `ranking`, `introduction`, `is_primary` 삭제 |
| High | club_member_stats 컬럼명 교정 | `member_id` → `club_member_id`, `total_matches` → `total_games`, `last_updated` → `updated_at`, `draws` 삭제, `season`, `sessions_attended`, `last_played_at` 추가 |
| High | club_session_attendances 교정 | `member_id` → `club_member_id`, `available_from/until/notes` 추가 |
| High | club_match_results 교정 | `score1/score2` → `player1_score/player2_score`, guest FK명 교정, 분쟁 관련 컬럼 추가, `match_type 'doubles'` 값 추가 |
| Medium | club_session_guests 보완 | `available_from/until` 추가 (migration 24) |
| Medium | bracket_configs 보완 | `active_phase` 추가 (migration 26), `active_round` 타입 INT NULL로 수정 |
| Medium | clubs 보완 | `default_ranking_period/from/to` 3개 컬럼 추가 (migration 22) |
| Medium | club_member_role enum 교정 | `VICE_PRESIDENT`, `ADVISOR`, `MATCH_DIRECTOR` 3개 값 추가 (migration 18) |
| Medium | gender_type enum 추가 | `MALE \| FEMALE` (migration 06) |
| Medium | tournament_entries 보완 | `payment_key`, `toss_order_id` 추가 (migration 12) |
| Medium | tournaments 보완 | `team_match_count` 추가 (migration 02) |
| Medium | profiles 보완 | `birth_year` 추가 |
| Medium | 누락 테이블 3개 추가 | `matches` (레거시), `chat_logs`, `association_managers` |
| Medium | 협회 시스템 섹션 분리 | `associations`, `association_managers` 테이블을 클럽 시스템에서 분리하여 별도 섹션으로 정리 |
| Medium | RLS 교정 | bracket_matches 수정 권한 `ADMIN+` → `MANAGER+` (migration 13) |
| Medium | Realtime 테이블 추가 | `bracket_configs` (migration 26) |

### 3.2 native-screens.md 수정 내역

| 분류 | 항목 | 수정 내용 |
|------|------|-----------|
| High | 누락 화면 9개 추가 | `auth/error`, `payment/success`, `payment/fail`, `clubs/[id]/members/[memberId]`, `my/clubs/[id]`, `support/`, `support/inquiry`, `support/inquiry/history`, `support/inquiry/[id]` |
| High | 네비게이션 구조 갱신 | 누락 화면 모두 (stack)/(auth) 그룹에 추가 |
| High | 대진표 쿼리 교정 | `config_id` → `bracket_config_id`, `entry1_id/entry2_id` → `team1_entry_id/team2_entry_id` |
| High | 클럽 쿼리 교정 | `member_count` 컬럼 없음 명시, `profiles JOIN` 불필요 명시 |
| High | 세션 쿼리 교정 | attendances JOIN `member_id` → `club_member_id`, profiles 경유 제거 |
| High | 마이페이지 함수 시그니처 교정 | `userId` 파라미터 없음 명시, `getMyAwards()` 함수 없음 명시 |
| Medium | 제외 화면 분류 재정비 | "웹 어드민 전용", "WebView 임베드", "권한 필요 — 추후 검토" 3분류로 세분화 |
| Medium | tournaments/new, edit 재분류 | "웹 어드민"에서 "권한 필요 — 추후 검토"로 이동 (실제로 일반 경로에 존재) |
| Low | 대회 상세 쿼리 교정 | `tournament_entries`에 profiles JOIN 불필요 명시 |

### 3.3 shared-code.md 수정 내역

| 분류 | 항목 | 수정 내용 |
|------|------|-----------|
| High | Server Actions 6개 추가 | `entries`, `payment`, `associations`, `support`, `faq`, `storage` |
| High | 타입 9개 추가 | `TournamentFormat`, `EntryStatus`, `PaymentStatus`, `MatchPhase`, `MatchStatus`, `ClubJoinType`, `ClubMemberRole`, `ClubMemberStatus`, `StartYear` |
| Medium | Realtime 훅 4개 추가 | `useMatchesRealtime`, `useTournamentStatusRealtime`, `useClubMembersRealtime`, `useBracketConfigRealtime` — 재사용 가능 코드로 분류 |
| Medium | NLP 챗봇 시스템 언급 | `src/lib/chat/` 21개 파일 — 변환 필요(API로 분리) 및 초기 버전 제외 권장 |

### 3.4 project-structure.md 수정 내역

| 분류 | 항목 | 수정 내용 |
|------|------|-----------|
| Medium | Realtime filter 교정 | `config_id=eq.${configId}` → `bracket_config_id=eq.${configId}` |

---

## 4. Remaining Items (v1.1 미해결 — 낮은 우선순위)

아래 항목은 정보 부재 또는 낮은 우선순위로 이번 iteration에서 처리하지 않았다.

| 항목 | 파일 | 이유 |
|------|------|------|
| `zustand` 버전 웹에서 미사용 경고 | `project-structure.md` | 네이티브 앱 미래 계획이라 웹 버전과 비교 불가 — 정상 |
| `ENCRYPTION_KEY` 환경변수 | `project-structure.md` | 실제 암호화 기능 존재하나 낮은 영향도 |
| 홈(`/`) 페이지 네이티브 처리 | `native-screens.md` | 탭 첫 화면이 대회 목록이므로 별도 홈 화면 불필요 |

---

## 5. Overall Score (v1.1)

```
+---------------------------------------------+
|  Overall Score: 92/100  (PASS)              |
+---------------------------------------------+
|  native-screens.md:     92 points  (PASS)   |
|  shared-code.md:        91 points  (PASS)   |
|  supabase-schema.md:    92 points  (PASS)   |
|  project-structure.md:  92 points  (PASS)   |
+---------------------------------------------+
```

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-03-05 | Initial gap analysis | Claude (gap-detector) |
| 1.1 | 2026-03-05 | Iteration 1: 모든 Critical/High 항목 수정, Match Rate 81% → 92% | Claude (pdca-iterator) |
