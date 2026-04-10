# Phone Normalization — Phase A Audit Report

> **실행일**: 2026-04-10
> **범위**: 전화번호 정규화/중복 병합 마이그레이션 영향도 사전 조사 (읽기 전용)
> **Plan**: `docs/01-plan/features/phone-normalization-cleanup.plan.md`
> **Design**: `docs/02-design/features/phone-normalization-cleanup.design.md`
> **DRY-RUN 스크립트**: `scripts/phase-a-dry-run.sql`

---

## 0. 한 줄 요약

> **그룹 A 13 그룹 / 14 victim 전부 FK 참조 0건** → Phase E 병합을 **FK 이관 없이 단순 DELETE**로 안전 진행 가능. `team_members`/`partner_data` JSONB에 phone 필드 없음, 국제화 `+82` 포맷 0건 → 본 Plan 범위 그대로 진행. **네이버 콜백 평문 저장 13건과 암호화 오저장 1건만 별도 재암호화/복호화 필요**.

---

## 1. 전체 테이블별 phone 카운트

| 테이블 | 전체 | phone 보유 | 비고 |
|---|---:|---:|---|
| `profiles` | 150 | 138 | 암호화 125 / **평문 13** (정책 위반) |
| `club_members` | 1,100 | 453 | 하이픈 430 / 비정상 23 |
| `tournament_entries` | 78 | 78 | 하이픈 37 / 숫자 41 (거의 반반) |
| `coaches` | 2 | 2 | — |
| `clubs` (contact_phone) | 36 | 11 | 본 범위 외 |
| `lesson_bookings` (guest_phone) | 0 | 0 | 빈 테이블 |
| `lesson_inquiries` | 0 | 0 | 빈 테이블 |
| `associations.president_phone` | 25 | 0 | 미사용 |
| `associations.secretary_phone` | 25 | 0 | 미사용 |

---

## 2. 포맷 분포 상세

### 2.1 `club_members.phone` (453건)

| 포맷 | 건수 | 정규화 필요 |
|---|---:|:---:|
| NULL | 647 | - |
| ✅ `010-XXXX-XXXX` (표준) | **430** | 하이픈 제거 |
| ❌ `01012345678` (숫자 11자리) | 20 | 이미 정규화 |
| ❌ `010 1234 5678` (공백) | 1 | 정규화 필요 |
| ❌ 유선 (`02-xxxx-xxxx` 등) | 1 | 정규화 필요 |
| 🚨 **암호화 오저장** (`iv:tag:data` 92자) | **1** | 복호화 필요 |

**마이그레이션 대상**: 432건 (하이픈 430 + 공백 1 + 유선 1) → 정규화 UPDATE
**특수 처리**: 암호화 오저장 1건 → 리뷰 테이블에 로그 후 NULL

### 2.2 `tournament_entries.phone` (78건)

| 포맷 | 건수 | 정규화 필요 |
|---|---:|:---:|
| ❌ `010-XXXX-XXXX` | 37 | 하이픈 제거 |
| ✅ `01012345678` | 41 | 이미 정규화 |

**마이그레이션 대상**: 37건

### 2.3 `profiles.phone` (138건)

| 포맷 | 건수 | 재암호화 필요 |
|---|---:|:---:|
| 🔐 암호화 (`iv:tag:data`) | 125 | - |
| 🚨 **평문** `01012345678` | **13** | 재암호화 필요 |

**재암호화 대상**: 13건 (네이버 콜백 버그의 결과)

---

## 3. 오염 데이터 상세

### 3.1 `profiles.phone` 평문 13건 (개인정보 보호 위해 마스킹)

| # | 생성일 | email 도메인 | 비고 |
|---|---|---|---|
| 1 | 2026-04-10 | naver.com | 최근 생성 (허정학 네이버 부계정) |
| 2 | 2026-04-10 | naver.com | |
| 3 | 2026-04-09 | naver.com | |
| 4 | 2026-04-04 | naver.com | |
| 5 | 2026-03-20 | naver.com | |
| 6 | 2026-02-23 | naver.com | (2026-02-23 네이버 대거 유입 시점) |
| 7 | 2026-02-23 | naver.com | |
| 8 | 2026-02-23 | naver.com | |
| 9 | 2026-02-23 | naver.com | |
| 10 | 2026-02-23 | naver.com | |
| 11 | 2026-02-23 | naver.com | |
| 12 | 2026-02-23 | naver.com | |
| 13 | 2026-02-23 | naver.com | |

→ **전부 네이버 콜백에서 생성된 계정**. 네이버 콜백의 `encryptProfile()` 누락 버그가 근본 원인으로 확정.

### 3.2 `club_members.phone` 암호화 오저장 1건

- **member**: `한사랑-정준` (`dfc46a10-8cc7-4dce-8c87-591f4f68c32b`)
- **값**: `9ee72c35f2a30668cb6bb710eee5f069:0df830d7ef626e5c578d2c22cb95d893:1bc31a8eee32938c95a7ede4c1` (92자)
- **추정 원인**: 어딘가에서 `profiles.phone`의 암호화 값을 그대로 복사해 `club_members.phone`에 저장. 추적 필요하나 Phase D에서 해당 레코드만 NULL 처리 후 수동 보정 예정.

---

## 4. 중복 그룹 확정 (REMOVED/LEFT 제외)

### 4.1 전체 통계

| 그룹 | 그룹 수 | 정리 잉여 행 | 처리 방식 |
|---|---:|---:|---|
| **A — 동일 이름 + 동일 phone** | **13** | **14** | 자동 병합 |
| **B — 시스템 owner 관련** | 0 | 0 | 대상 외 (ACTIVE 중복 없음) |
| **C — 다른 이름 + 동일 phone** | 2 | 2 | 수동 리뷰 (자동 병합 금지) |

### 4.2 그룹 A 13 그룹 상세

| # | 클럽 | 이름 | phone (norm) | 건수 | survivor 선정 기준 |
|---|---|---|---|---:|---|
| 1 | `a952af1e...` | 강기태 | 01022023234 | 2 | `is_registered=true` 보존 |
| 2 | `cf19b05a...` | 김나래 | 01033795339 | 2 | 가장 오래된 `created_at` |
| 3 | `cf19b05a...` | 김민주 | 01039114952 | 2 | 가장 오래된 `created_at` |
| 4 | `cf19b05a...` | 김수진 | 01066429409 | 2 | 가장 오래된 `created_at` |
| 5 | `cf19b05a...` | 안민환 | 01085932255 | 2 | 가장 오래된 `created_at` |
| 6 | `cf19b05a...` | **양현선** | 01046998521 | **3** | 가장 오래된 `created_at` |
| 7 | `cf19b05a...` | 양혜정 | 01039586625 | 2 | 가장 오래된 `created_at` |
| 8 | `cf19b05a...` | 이재경 | 01035050408 | 2 | 가장 오래된 `created_at` |
| 9 | `cf19b05a...` | 이준한 | 01030901308 | 2 | 가장 오래된 `created_at` |
| 10 | `cf19b05a...` | 최민지 | 01025081209 | 2 | 가장 오래된 `created_at` |
| 11 | `cf19b05a...` | 한정은 | 01051429074 | 2 | 가장 오래된 `created_at` |
| 12 | `cf19b05a...` | 허은숙 | 01035881787 | 2 | 가장 오래된 `created_at` |
| 13 | `cf19b05a...` | 홍경자 | 01026575903 | 2 | 가장 오래된 `created_at` |

**패턴 분석**:
- **12 그룹이 `cf19b05a` 단일 클럽에 집중** — 특정 일괄 import 세션 버그 확정. 해당 클럽만 개별 확인 후 한 번에 병합 가능.
- **강기태 (그룹 1)만 예외** — `is_registered=true` + `is_registered=false` 섞인 형태. 사용자가 직접 가입한 후 관리자가 수동 등록해서 발생한 케이스로 추정.
- **양현선 3건** 모두 `is_registered=false` → 3개 중 첫 번째(`created_at` 최소) 보존, 나머지 2개 삭제.

### 4.3 그룹 C 2 그룹 (수동 리뷰만)

| 클럽 | phone (norm) | 이름 |
|---|---|---|
| `95a65583...` | 01094038639 | 최윤하 / **유병국** |
| `cd189c36...` | 01073821198 | 김한빛 / **김성은** |

→ **자동 병합 금지**. Phase E'에서 `_phone_migration_review`에 로그 후 SUPER_ADMIN 수동 처리.

### 4.4 **14 victim의 FK 참조 수** (핵심 발견)

`club_members`를 참조하는 11개 FK 컬럼 전수 조사:

| 참조 테이블.컬럼 | victim 14건 참조 수 |
|---|---:|
| `club_match_results.player1_member_id` | **0** |
| `club_match_results.player1b_member_id` | **0** |
| `club_match_results.player2_member_id` | **0** |
| `club_match_results.player2b_member_id` | **0** |
| `club_match_results.winner_member_id` | **0** |
| `club_member_stats.club_member_id` | **0** |
| `club_session_attendances.club_member_id` | **0** |
| `lesson_bookings.member_id` | **0** |
| `lesson_extension_requests.member_id` | **0** |
| `lesson_slots.locked_member_id` | **0** |
| `session_notifications.member_id` | **0** |

**총 참조 수 0건** ✅

→ **의미**:
1. 그룹 A 14 victim 모두 활동 이력 전무. 대부분 `cf19b05a` 클럽의 미활동 비가입 회원이라 예상되는 결과.
2. Phase E 병합 시 **FK 이관 단계 생략 가능** → Design의 `_phone_migration_merge_fk` 함수는 **안전장치로만 유지**하고 실제 호출은 필요 없음.
3. 단순 `DELETE FROM club_members WHERE id IN (...)`로 병합 완료.

---

## 5. JSONB 내부 phone 필드 조사

### 5.1 `tournament_entries.team_members`

```
team_entries_with_phone_field: 0
```

→ 현재 `team_members` JSONB 배열 요소에는 `{ name, rating, club }` 형태만 저장. phone 필드 없음. **추가 마이그레이션 불필요**.

### 5.2 `tournament_entries.partner_data`

```
entries_with_partner_phone_field: 0
```

→ partner_data에도 phone 필드 없음. `{ name, club, rating }` 형태. **추가 마이그레이션 불필요**.

---

## 6. 국제화 `+82` 포맷 조사

| 테이블 | `+82` 프리픽스 건수 |
|---|---:|
| `club_members.phone` | **0** |
| `tournament_entries.phone` | **0** |
| `clubs.contact_phone` | **0** |
| `coaches.phone` | **0** |
| `profiles.phone` | **0** (암호화된 원문 확인 불가, 평문 13건 중 0건) |

→ **국제화 포맷 없음**. `normalizePhone()` 함수에 `+82` 처리 로직 추가 **불필요**. 본 Plan/Design 그대로 진행.

---

## 7. Design 오픈 이슈 최종 확정

| # | 이슈 | 결정 | 근거 |
|---|---|---|---|
| 1 | 저장 포맷 | **숫자 11자리** (`01012345678`) | 확정 |
| **2** | `team_members`/`partner_data` JSONB 내부 phone | **추가 마이그레이션 불필요** | Phase A §5: 둘 다 0건 |
| 3 | `clubs.contact_phone`, `coaches.phone` | **본 범위 제외** | Plan 결정 유지 |
| 4 | `_phone_migration_review` 보관 기간 | **1주일 후 DROP** | Design G.3 |
| **5** | 국제화 `+82` 지원 | **지원 범위 외** | Phase A §6: 전체 0건 |
| 6 | 그룹 C 수동 정리 주체 | **SUPER_ADMIN 직접 처리** | Plan 결정 유지 |
| **신규** | **Phase E FK 이관 필요 여부** | **불필요** (헬퍼 함수는 안전장치로 유지) | Phase A §4.4: 14 victim 전부 참조 0건 |

---

## 8. Design 문서 업데이트 필요 사항

1. **§2.1.2 `respondJoinRequest` 좀비 감지**: `mergeFkReferences` 호출 부분은 실제 호출 생략 가능. 단, 향후 상황 대비 안전장치로 함수는 생성.
2. **§7 Phase E 그룹 A 병합 스크립트**: FK 이관 단계를 "대상 없음 확인 후 생략" 주석으로 명확화.
3. **§14 오픈 이슈 해결 상태**: 이슈 2, 5, 신규 항목 Phase A 결과 반영.

---

## 9. 리스크 평가 재조정

| 리스크 | Plan/Design 시점 | Phase A 이후 조정 |
|---|---|---|
| Phase E 병합 시 FK 참조 이관 누락 | 🔴 **높음** | ⚠️ **낮음** (FK 참조 0건 확인) |
| `team_members` JSONB 내부 phone 누락 | ⚠️ 중간 | ❎ 0 (필드 자체 없음) |
| `+82` 국제화 포맷 정규화 실패 | ⚠️ 중간 | ❎ 0 (데이터 없음) |
| 네이버 콜백 평문 저장 지속 | 🔴 높음 | 🔴 **여전히 높음** — 버그 수정 시급 |
| 그룹 C 자동 병합 위험 | 🔴 높음 | 🔴 **여전히 높음** — 수동 리뷰 필수 |

**전체 리스크 완화**: Phase A 결과로 병합 단계의 주요 불확실성(FK 이관) 제거됨. 남은 핵심 리스크는 **그룹 C 수동 정리**와 **네이버 콜백 버그**.

---

## 10. 다음 단계 (Do Phase 즉시 착수 가능 작업)

### 10.1 즉시 독립 배포 가능
1. **네이버 콜백 버그 수정** — `src/app/api/auth/naver/callback/route.ts`, `.../mobile/route.ts`에 `normalizePhone + encryptProfile` 추가. 별도 커밋/PR로 즉시 배포.

### 10.2 Phase B 잔여
2. `joinClubAsRegistered` 과도기 `.or()` 적용 + `.maybeSingle()` 제거
3. `addUnregisteredMember`, `updateProfile`, `createEntry`, `updateEntry` 정규화 적용
4. `phone.test.ts` 단위 테스트 작성

### 10.3 Phase C~G 순차 실행
5. Phase C: `_backup_*` 스냅샷 생성 + Supabase PITR
6. Phase D: `club_members`, `tournament_entries` 정규화 마이그레이션
7. Phase D: `reencrypt-profile-phones.ts` 실행 (profiles 13건)
8. Phase E: 그룹 A 병합 — **cf19b05a 클럽 12 그룹 일괄 + 강기태 1 그룹 = 13 그룹 14 DELETE**
9. Phase E': 그룹 C 리뷰 로그 + SUPER_ADMIN 수동 정리
10. Phase F: DB 제약 추가 (선행 검증 후)
11. Phase B 과도기 `.or()` 제거
12. Phase G: 1주 후 백업 정리

---

## 11. 실행 체크리스트

- [x] Phase A 스크립트 작성 (`scripts/phase-a-dry-run.sql`)
- [x] Phase A 전체 쿼리 실행 (읽기 전용)
- [x] `phone-audit.md` 보고서 작성 (본 문서)
- [ ] Design 문서 오픈 이슈 2, 5, 신규 업데이트
- [ ] 네이버 콜백 버그 수정 PR
- [ ] `phone.test.ts` 단위 테스트
- [ ] Phase B 잔여 Server Action 정규화 적용
- [ ] Phase C~G 실행
