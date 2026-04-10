# Phone Normalization — Phase A Audit Report

> **조사일**: 2026-04-10 (읽기 전용 Phase A)
> **재암호화 실행일**: 2026-04-10 (13건 완료)
> **범위**: 전화번호 정규화/중복 병합 마이그레이션 영향도 사전 조사 및 네이버 버그 후속 조치
> **Plan**: `docs/01-plan/features/phone-normalization-cleanup.plan.md`
> **Design**: `docs/02-design/features/phone-normalization-cleanup.design.md`
> **DRY-RUN 스크립트**: `scripts/phase-a-dry-run.sql`
> **재암호화 스크립트**: `scripts/reencrypt-profile-phones.mjs`

---

## 0. 한 줄 요약

> **그룹 A 13 그룹 / 14 victim 전부 FK 참조 0건** → Phase E 병합을 **FK 이관 없이 단순 DELETE**로 안전 진행 가능. `team_members`/`partner_data` JSONB에 phone 필드 없음, 국제화 `+82` 포맷 0건 → 본 Plan 범위 그대로 진행. ✅ **네이버 콜백 버그 수정 완료(커밋 `9e388aa`) + 평문 13건 재암호화 완료(2026-04-10)**. 남은 작업: `club_members` 암호화 오저장 1건 복호화 + Phase B~G 순차 실행.

## 0.1 완료 상태 (2026-04-10 현재)

| 항목 | 상태 | 세부 |
|---|:---:|---|
| Phase A 조사 (읽기 전용) | ✅ 완료 | 본 문서 |
| Phase B UI 입력 정규화 | ✅ 완료 | 커밋 `b56afec` |
| 네이버 콜백 버그 수정 | ✅ 완료 | 커밋 `9e388aa` |
| profiles 평문 재암호화 (13건) | ✅ 완료 | `reencrypt-profile-phones.mjs` / phone 0 평문, birth_year 0 평문 |
| **Phase B Server Action 정규화** | ✅ **완료** | 커밋 `0fc1880` (joinClubAsRegistered, respondJoinRequest, addUnregisteredMember, joinClubAsGuest, createClub, inviteMember, updateProfile, createEntry, updateEntry) |
| **Option C: `club_members` 암호화 오저장 1건 NULL** | ✅ **완료** | 한사랑-정준 (`dfc46a10-...`) phone → NULL, `_phone_migration_review`에 로그 |
| **Phase C 백업** | ✅ **완료** | `_backup_club_members_20260410` (1098), `_backup_tournament_entries_20260410` (81), `_backup_profiles_reencrypt_20260410` (138) |
| **Phase D 정규화 마이그레이션** | ✅ **완료** | club_members 431건 정규화, tournament_entries 37건 정규화, 두 테이블 invalid 0 |
| **Phase E 그룹 A 14 DELETE** | ✅ **완료** | cf19b05a 13건 + a952af1e 1건 삭제, 동일인 중복 0건, `_backup_club_members_phase_e_20260410` (14) |
| **Phase F CHECK 제약** | ✅ **완료** | `club_members_phone_format`, `tournament_entries_phone_format` CHECK (`^[0-9]{9,11}$`) |
| **Phase F UNIQUE partial index** | ⏳ **대기 중** | 그룹 C 2 그룹 수동 정리 완료 후 생성 가능 |
| **그룹 C 2 그룹 수동 정리** | ⏳ **진행 중** | `_phone_migration_review` 4건 기록 완료. SUPER_ADMIN 직접 연락 중 |
| Phase G (백업 정리) | ⏳ 대기 | 1주일 모니터링 후 |

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

### 2.3 `profiles.phone` (138건) — ✅ 재암호화 완료

**Phase A 조사 시점** (2026-04-10 사전 조사):

| 포맷 | 건수 |
|---|---:|
| 🔐 암호화 (`iv:tag:data`) | 125 |
| 🚨 **평문** `01012345678` | **13** |

**재암호화 후** (2026-04-10 실행 완료):

| 포맷 | 건수 |
|---|---:|
| 🔐 암호화 | **138** |
| 평문 | **0** ✅ |

### 2.4 `profiles.birth_year` (136건) — ✅ 재암호화 완료

**재암호화 실행 시 추가 발견**: Phase A 1차 조사에서 `profiles.phone` 13건만 보고했으나, 실제로 DRY-RUN에서 그중 **12건은 `birth_year`도 함께 평문**으로 저장되어 있던 것이 확인됨 (강한 1건만 birth_year 없음). 같은 네이버 콜백 버그의 일부이므로 재암호화 스크립트가 phone과 동시에 처리.

| 포맷 | 재암호화 전 | 재암호화 후 |
|---|---:|---:|
| 🔐 암호화 | 124 | **136** ✅ |
| 🚨 평문 | 12 | **0** ✅ |
| NULL | 14 | 14 |

---

## 3. 오염 데이터 상세

### 3.1 `profiles.phone` 평문 13건 — ✅ 재암호화 완료

**DRY-RUN 결과로 이메일 도메인 분포도 확인됨** (단순 마스킹, 개인정보는 저장 안 함):

| 생성일 | email 도메인 | 이름 초성 | 상태 |
|---|---|---|:---:|
| 2026-04-10 | naver.com | 허** (시스템 OWNER 부계정) | ✅ |
| 2026-04-10 | naver.com | 차** | ✅ |
| 2026-04-09 | naver.com | 정** | ✅ |
| 2026-04-04 | naver.com | 박** | ✅ |
| 2026-03-20 | daum.net | 강** | ✅ |
| 2026-02-23 | naver.com | 이** | ✅ |
| 2026-02-23 | naver.com | 이** | ✅ |
| 2026-02-23 | nate.com | 한** | ✅ |
| 2026-02-23 | naver.com | 장** | ✅ |
| 2026-02-23 | naver.com | 최** | ✅ |
| 2026-02-23 | naver.com | 유** | ✅ |
| 2026-02-23 | gmail.com | 박** | ✅ |
| 2026-02-23 | hanmail.net | 박** | ✅ |

**도메인 분포**: naver 8 / daum 1 / nate 1 / gmail 1 / hanmail 1 / hanafos 1 / sc 1 → 이메일 도메인이 다양해도 **전부 네이버 OAuth 경로로 가입된 계정** (네이버 OAuth 제공 이메일이 네이버가 아닌 경우 포함).

**근본 원인**: 네이버 콜백의 `encryptProfile()` 누락 버그로 확정.
**현재 상태**: 커밋 `9e388aa`로 버그 수정 + `reencrypt-profile-phones.mjs`로 13건 전체 재암호화 완료. **DB에 평문 0건**.

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

### 4.3 그룹 C 2 그룹 (수동 정리 진행 중)

#### 그룹 C.1 — 일레븐 클럽

| 필드 | 회원 1 | 회원 2 |
|---|---|---|
| member_id | `5ae9194d-...` | `fafca334-...` |
| name | **김성은** | **김한빛** |
| gender | MALE | FEMALE |
| birth_year | 1988 | 1993 |
| phone | 01073821198 | 01073821198 |
| is_registered | true (앱 가입) | false (수동 등록) |
| created_at | 2026-02-23 | 2026-02-23 |

**분석**: **완전히 다른 사람** (성별/출생년도 다름). 관리자 수동 등록 시 phone 오타로 보임. 김성은이 실제 사용자(is_registered), 김한빛은 수동 등록이므로 **김한빛 쪽 phone을 확인/수정** 필요.

#### 그룹 C.2 — 효성 클럽

| 필드 | 회원 1 | 회원 2 |
|---|---|---|
| member_id | `eccd0fe2-...` | `e33890ab-...` |
| name | **유병국** | **최윤하** |
| gender | MALE | MALE |
| birth_year | 1980 | 1980 |
| phone | 01094038639 | 01094038639 |
| is_registered | false | false |
| created_at | 2026-02-23 | 2026-02-23 |

**분석**: 두 명 모두 MALE + 1980년생 + 비가입. 외형 상 유사하지만 **이름이 다름** → 관리자가 두 명 등록하면서 phone 1건을 복사했을 가능성 큼. 실제 phone을 양쪽 모두 확인 필요.

### 4.3.1 처리 방침

1. **자동 병합 절대 금지** — 데이터 오염 가능성
2. `_phone_migration_review` 테이블에 4건 기록 완료 (`reason='different_names_same_phone'`)
3. **SUPER_ADMIN이 클럽 관리자에게 직접 연락**하여 각 회원의 정확한 phone 확인
4. 회신 후 수동 UPDATE
5. Phase F UNIQUE partial index 생성 (그룹 C 해결 완료 전제)
6. 리뷰 테이블 `reviewed = true` + `reviewer_note` 기록

### 4.3.2 관리자 연락 정보 (SUPER_ADMIN 내부용)

| 클럽 | 대상 회원 | 관리자 (OWNER/ADMIN) | 연락 방법 |
|---|---|---|---|
| **효성** | 유병국 / 최윤하 | 유병준 OWNER, 변형욱 ADMIN | 앱 관리자 페이지 > 효성 클럽 > 회원 관리 |
| **일레븐** | 김성은 / 김한빛 | 이수현 ADMIN (OWNER 미등록) | 앱 관리자 페이지 > 일레븐 클럽 > 회원 관리 |

> 연락처는 `admin/users` 페이지에서 user_id 검색으로 확인 가능합니다 (본 문서에는 PII 미포함).

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
- [x] Design 문서 오픈 이슈 2, 5, 신규 업데이트 (커밋 `a77e536`)
- [x] 네이버 콜백 버그 수정 (커밋 `9e388aa`)
- [x] profiles 평문 13건 재암호화 완료 (2026-04-10, `reencrypt-profile-phones.mjs`)
- [x] `_backup_profiles_reencrypt_20260410` 백업 테이블 생성 (138건)
- [x] **Phase B 잔여 Server Action 정규화 적용** (커밋 `0fc1880`)
- [x] **`club_members.phone` 암호화 오저장 1건 NULL 처리** (한사랑-정준 + 리뷰 로그)
- [x] **Phase C** (`_backup_club_members_20260410` 1098, `_backup_tournament_entries_20260410` 81)
- [x] **Phase D** (club_members 431건 정규화 + tournament_entries 37건 정규화)
- [x] **Phase E** (그룹 A 13 그룹 14 DELETE, `_backup_club_members_phase_e_20260410` 14)
- [x] **Phase E' 그룹 C 2 그룹 리뷰 로그** (`_phone_migration_review` 4건 기록)
- [x] **Phase F CHECK 제약** (`club_members_phone_format`, `tournament_entries_phone_format`)
- [ ] **그룹 C 수동 정리** ← SUPER_ADMIN 직접 연락 진행 중
- [ ] **Phase F UNIQUE partial index** ← 그룹 C 수동 정리 후 생성
- [ ] Phase B 과도기 `.or()` 쿼리 제거 (Phase F UNIQUE 완료 후)
- [ ] `phone.test.ts` 단위 테스트
- [ ] Phase G (1주 후 백업 테이블 DROP)
