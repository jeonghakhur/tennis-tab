# 개인 접수 부서 복식 페어 편성 (solo-entry-pairing)

> 작성일: 2026-10-16 · 상태: 구현 중
> 대상 사례: 제3회 마포구협회장배 시니어대회 (`/tournaments/759bcdcb-81e6-4bbd-8a79-e200349835a3`)

## 1. 배경

- 복식 대회(`match_type = INDIVIDUAL_DOUBLES`)에서 부서가 **개인 접수**(`tournament_divisions.solo_entry = true`)면 참가자는 1명 단위로 신청하고, 대회 당일 주최측이 파트너를 뽑아 복식으로 진행한다.
- 현재 대진표는 `tournament_entries.id`를 그대로 팀 단위로 사용하므로 개인 접수 부서는 **1명 = 1팀**으로 조편성되어 사실상 단식 대진이 된다.
- 개인 접수 엔트리는 `partner_data`, `partner_user_id`가 항상 `null`로 강제 저장된다(`src/lib/entries/actions.ts`).

## 2. 영향 분석 요약

| 영역 | 현재 동작 | 영향 |
|------|-----------|------|
| 대진표 테이블 (`group_teams.entry_id`, `bracket_matches.team*_entry_id`) | 엔트리 id = 팀 | 2명을 1팀으로 묶으려면 **대표 엔트리 1개**만 대진표에 올려야 함 |
| 이름 표시 (GroupsTab, MatchRow, PreliminaryTab, MainBracketTab, BracketView, PDF, 챗봇, 어워드) | `partner_data` 있으면 "A & B" | 대표 엔트리에 `partner_data`만 채우면 수정 없이 복식 표시 |
| 집계 (부서 신청 현황, 메인 카드, 엑셀) | 1행 = 1명(solo) | 파트너 행을 CONFIRMED로 유지하면 "32명" 그대로 |
| 취소/수정 (`cancelEntryByAdmin`, `updateEntry`, 어드민 상태 변경·삭제) | 대진표 슬롯만 검사 | 페어 편성 후 취소·수정 시 페어가 깨지므로 가드 필요 |
| `autoGenerateGroups` | CONFIRMED 전부 풀에 포함 | 파트너 행 제외 + 미편성 잔여 시 차단 |

## 3. 설계 (권고 B 채택)

### 3-1. 데이터 모델
- 신규 컬럼 `tournament_entries.paired_into_entry_id UUID NULL REFERENCES tournament_entries(id) ON DELETE SET NULL`
  - 파트너(B) 행이 대표(A) 행을 가리킨다. A 행은 `partner_data`에 B의 이름·클럽·점수를 복사한다.
  - `partner_user_id`는 사용하지 않는다(대리 등록으로 `user_id`가 본인이 아닐 수 있음).
- 페어 편성/해제는 **DB 함수**(`pair_solo_entries_batch`, `unpair_solo_entries`)로 원자 처리. 조건 위반 시 `RAISE EXCEPTION`으로 전체 롤백.

### 3-2. 허용 조건
- 부서 `solo_entry = true` **그리고** 대회 `match_type = INDIVIDUAL_DOUBLES`
- 두 엔트리 모두 같은 부서, `CONFIRMED`, 미편성 상태
- `bracket_configs`가 없거나 `status = DRAFT` 이고 `preliminary_groups`가 0개 (조편성 전)
- 대회가 COMPLETED/CANCELLED가 아님

### 3-3. 대진표 연동
- `autoGenerateGroups` 풀: `status = CONFIRMED AND paired_into_entry_id IS NULL`
- 개인 접수 복식 부서에서 `partner_data IS NULL` 인 미편성 엔트리가 남아 있으면 조편성 차단

### 3-4. 가드
- `cancelEntryByAdmin`(사용자 취소·챗봇), `updateEntry`(사용자 수정), 어드민 `updateEntryStatus`(취소/거절), `bulkUpdateEntryStatus`, `deleteEntry`: 페어 편성된 엔트리는 거부 → "페어 편성 탭에서 먼저 해제" 안내
- `adminUpdateEntry`: 대표 엔트리의 `partner_data`를 덮어쓰지 않음

### 3-5. UI
- `BracketManager`에 **페어 편성** 탭 추가 (개인 접수 복식 부서에서만 노출, 설정 → 페어 편성 → 조편성 순)
  - 수동: 미편성 명단에서 2명 선택 → 편성
  - 자동: 랜덤 / 점수 균형(상위-하위 매칭) 선택 → 미편성 인원만 일괄 편성
  - 해제: 개별 / 전체
  - 조편성 생성 후에는 읽기 전용 + 안내
- `EntriesManager`: 페어 배지(대표/파트너)
- PDF 참가자 수: 파트너 행은 0명으로 집계(대표 행에서 2명)

## 4. 단계

1. 마이그레이션 `64_solo_entry_pairing.sql` + `types.ts` ← 사용자가 대시보드에서 적용
2. 순수 알고리즘 `src/lib/bracket/pairing.ts` + 단위테스트
3. Server Actions (`getSoloPairingState`, `pairSoloEntries`, `autoPairSoloEntries`, `unpairSoloEntries`) + `autoGenerateGroups` 수정 + 가드
4. `PairingTab` + BracketManager 탭 + EntriesManager 배지 + PDF 집계
5. (선택) `user_id`만 보는 조회 8곳에 파트너 반영 — 이번 범위 제외

## 5. 해당 대회 적용 순서

1. 대진표 관리 > 조편성 삭제 (기존 16개 조, 경기 0건이라 손실 없음)
2. 페어 편성 탭에서 16쌍 편성 (수동 또는 자동)
3. 조편성 자동 생성 → 8개 조 → 본선 1라운드 생성

## 6. 리스크·주의

- 마이그레이션 적용 전 배포 금지(새 컬럼 참조)
- 페어 검증은 `user_id`가 아닌 엔트리 id 기준(한 사용자가 여러 명 대리 등록 가능)
- 파트너 행은 CONFIRMED 유지 → 부서 신청 현황 "명" 단위 집계 불변
