# Design: 전화번호 정규화 및 클럽 회원 중복 방지

> Plan: `docs/01-plan/features/phone-normalization-cleanup.plan.md`
> 선행 작업: Phase B(UI 입력 정규화)는 커밋 `b56afec`에서 이미 완료됨

---

## 0. 설계 요약

| 관점 | 내용 |
|---|---|
| **Feature** | phone-normalization-cleanup |
| **Phase** | Design |
| **상태** | Phase B 완료(UI 정규화 전수 적용), Phase A/C/D/E/F/G 설계 |
| **저장 포맷 결정** | **숫자 11자리** (예: `01012345678`). 화면 표시는 `formatPhoneNumber()`로 하이픈 재삽입 |
| **핵심 리스크** | Phase E(중복 병합) 되돌리기 불가 → 백업 필수 + 클럽 단위 수동 confirm |

### 현재 DB 상태 (Plan 재집계 기준)

| 테이블 | 정규화 필요 | 재암호화 필요 | 오저장 수정 필요 |
|---|---:|---:|---:|
| `club_members` (453 건 non-null) | 23 건 (하이픈 없음 20 + 공백 1 + 유선 1 + 기타 1) | — | **1 건** (암호화 오저장) |
| `tournament_entries` (78 건) | 41 건 (하이픈 없음) | — | — |
| `profiles` (138 건 non-null) | — (암호화 보호) | **13 건** (네이버 콜백 평문) | — |

**이미 발생한 중복** (REMOVED/LEFT 제외 ACTIVE 기준):
- **그룹 A 13 그룹 14행**: 자동 병합 대상
- **그룹 B 0 건**: 대상 외
- **그룹 C 2 그룹 2행**: 수동 리뷰만

---

## 1. 공용 유틸 (기존 활용 + 확장 없음)

### 파일: `src/lib/utils/phone.ts`

**현재 상태**: Phase B(UI 정규화)에서 이미 활용 중. 추가 변경 없음.

| 함수 | 시그니처 | 용도 |
|---|---|---|
| `formatPhoneNumber(value: string): string` | 비숫자 제거 후 하이픈 재삽입 | 화면 표시 |
| `unformatPhoneNumber(value: string): string` | 비숫자 전부 제거 → 숫자만 | 저장 경로 |
| `validatePhoneNumber(value: string): true \| string` | 10~11자리 + `01` 시작 검증 | 유효성 검사 |
| `maskPhoneNumber(value: string): string` | `010-****-5678` 마스킹 | 표시 보호 |

**Design 결정**: 국제화(`+82`) 미지원. 현재 DB에 `+82` 데이터 없음(Phase A에서 재확인).

---

## 2. 서버 액션 변경

### 2.1 `src/lib/clubs/actions.ts`

#### 2.1.1 `joinClubAsRegistered` (L597~) — 정규화 방어적 재적용 + 과도기 `.or()` 호환

**현재**:
```ts
if (user.phone) {
  const { data: existingUnregistered } = await admin
    .from('club_members')
    .select('id, introduction')
    .eq('club_id', clubId)
    .eq('is_registered', false)
    .is('user_id', null)
    .eq('phone', user.phone)
    .neq('status', 'REMOVED')
    .neq('status', 'LEFT')
    .maybeSingle()
```

**변경안**:
```ts
import { unformatPhoneNumber } from '@/lib/utils/phone'

const normalizedPhone = unformatPhoneNumber(user.phone ?? '')

if (normalizedPhone) {
  // Phase D 진행 중 과도기: DB에 하이픈 포맷과 숫자 포맷이 공존할 수 있음
  // 양쪽 포맷으로 OR 검색해 매칭 성공률 확보. Phase D 완료 후 .eq('phone', normalized)만 남김
  const hyphenFormatted = normalizedPhone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')

  const { data: existingList } = await admin
    .from('club_members')
    .select('id, is_registered, user_id, introduction, status, phone')
    .eq('club_id', clubId)
    .or(`phone.eq.${normalizedPhone},phone.eq.${hyphenFormatted}`)
    .neq('status', 'REMOVED')
    .neq('status', 'LEFT')

  // 1) 자기 자신이 이미 등록되어 있으면 조기 차단 (정식 에러)
  const ownRegistered = existingList?.find((m) => m.user_id === user.id)
  if (ownRegistered) return { error: '이미 가입된 클럽입니다.' }

  // 2) 비가입 레코드 찾기 → 첫 번째 후보로 병합
  //    (과거 maybeSingle() 크래시 방지: 여러 건이어도 첫 건만 사용)
  const unregistered = existingList?.find(
    (m) => !m.is_registered && m.user_id === null
  )

  if (unregistered) {
    const { error: updateError } = await admin
      .from('club_members')
      .update({
        user_id: user.id,
        is_registered: true,
        name: user.name,
        phone: normalizedPhone,  // ← 매칭 시에도 정규화된 값으로 덮어쓰기
        start_year: user.start_year,
        rating: user.rating,
        gender: user.gender || null,
        status,
        is_primary: shouldBePrimary,
        introduction: sanitizedIntro ?? unregistered.introduction,
      })
      .eq('id', unregistered.id)

    if (updateError) return { error: '클럽 가입에 실패했습니다.' }
    // ... 기존 알림/profiles 동기화 로직
  }
}

// 매칭 없음 → 신규 INSERT (정규화된 phone 사용)
const { error } = await admin.from('club_members').insert({
  ...
  phone: normalizedPhone || null,
  ...
})
```

**핵심 변경**:
1. `unformatPhoneNumber(user.phone)` 방어적 재적용 (Phase D 이전에도 동작)
2. `.or('phone.eq.숫자,phone.eq.하이픈')` 과도기 호환 — Phase D 완료 후 `.eq('phone', normalizedPhone)`으로 단순화
3. `.maybeSingle()` → `.select(...)` + 클라이언트 `.find()` 로 변경 (크래시 방지)
4. 매칭 성공 시 기존 레코드의 phone도 정규화된 값으로 UPDATE (마이그레이션 가속)
5. 자기 자신 중복 가입 시도 조기 차단

#### 2.1.2 `respondJoinRequest` (L986~) — 승인 시 좀비 레코드 병합

**변경 추가**:
```ts
if (approve) {
  // 좀비 감지: 동일 (club, phone)로 is_registered=false인 다른 레코드 제거
  if (member.phone) {
    const { data: zombies } = await admin
      .from('club_members')
      .select('id')
      .eq('club_id', member.club_id)
      .eq('phone', member.phone)
      .eq('is_registered', false)
      .is('user_id', null)
      .neq('id', member.id)
      .neq('status', 'REMOVED')
      .neq('status', 'LEFT')

    if (zombies && zombies.length > 0) {
      const zombieIds = zombies.map((z) => z.id)

      // 안전을 위해 FK 참조 확인 후 이관 — Phase E 병합 로직과 공유
      await mergeFkReferences(member.id, zombieIds)

      await admin.from('club_members').delete().in('id', zombieIds)
    }
  }

  // ... 기존 ACTIVE 처리
}
```

`mergeFkReferences` 헬퍼는 **Phase E 병합 스크립트와 공유**하는 별도 함수로 분리 (중복 로직 방지).

#### 2.1.3 `addUnregisteredMember` (L576~)

**변경**: INSERT 전 `phone: unformatPhoneNumber(sanitized.phone ?? '') || null` 적용. 기존 `sanitized.phone?.trim() || null`을 대체.

### 2.2 `src/lib/auth/actions.ts`

#### `updateProfile` (L249~)

**변경**: `encryptProfile()` 호출 **전**에 `normalizePhone` 선적용:

```ts
import { unformatPhoneNumber } from '@/lib/utils/phone'

export async function updateProfile(data: { ... }) {
  // ... 기존 검증
  
  const normalized = {
    ...data,
    phone: data.phone ? unformatPhoneNumber(data.phone) : undefined,
  }
  
  const encrypted = encryptProfile({
    phone: normalized.phone,
    birth_year: normalized.birth_year,
    gender: normalized.gender,
  })
  // ... 기존 UPDATE 로직
}
```

### 2.3 `src/lib/entries/actions.ts`

#### `createEntry`, `updateEntry` — `tournament_entries.phone` 정규화

```ts
import { unformatPhoneNumber } from '@/lib/utils/phone'

// 두 액션 공통: DB insert/update 직전
phone: unformatPhoneNumber(entryData.phone ?? '') || null,
```

### 2.4 네이버 콜백 버그 수정 (🚨 최우선)

#### `src/app/api/auth/naver/callback/route.ts` + `src/app/api/auth/naver/mobile/route.ts`

**현재**: `naverProfile.mobile`을 `profiles.phone`에 **평문 저장** (인코드 누락 버그)

```ts
// 현재 (버그)
if (phone) updateData.phone = phone
```

**변경**:
```ts
import { unformatPhoneNumber } from '@/lib/utils/phone'
import { encryptProfile } from '@/lib/crypto/profileCrypto'

// 변경
if (phone) {
  const normalized = unformatPhoneNumber(phone)
  if (normalized) {
    const encrypted = encryptProfile({ phone: normalized })
    updateData.phone = encrypted.phone
  }
}
```

두 파일에 동일 패턴 적용. 이 수정은 **Phase B의 일부로 포함**해 다른 마이그레이션 없이 즉시 배포 가능.

---

## 3. DB 마이그레이션 파일 구조

모든 마이그레이션은 `supabase/migrations/`에 timestamp prefix로 생성. **순서대로 실행 필수**.

### 3.1 마이그레이션 파일 목록

```
supabase/migrations/
├── 20260410_01_phone_migration_review_table.sql       ← Phase A/D용 로그 테이블
├── 20260410_02_phone_backup_snapshots.sql             ← Phase C 백업
├── 20260410_03_phone_normalize_club_members.sql       ← Phase D
├── 20260410_04_phone_normalize_tournament_entries.sql ← Phase D
├── 20260410_05_phone_merge_group_a_duplicates.sql     ← Phase E (수동 실행)
├── 20260410_06_phone_group_c_review_log.sql           ← Phase E (그룹 C 기록)
├── 20260410_07_phone_db_constraints.sql               ← Phase F
└── 20260410_08_phone_cleanup_backup_tables.sql        ← Phase G (1주 후)
```

**별도 Node 스크립트** (SQL로 불가능한 암호화 처리):
```
scripts/
├── phase-a-dry-run.sql                                ← Phase A 조사 전용 (DROP용 아님)
└── reencrypt-profile-phones.ts                        ← Phase D: profiles 평문 13건
```

### 3.2 파일 내용 상세

---

## 4. Phase A — DRY-RUN 조사 스크립트

### 파일: `scripts/phase-a-dry-run.sql`

**목적**: 읽기 전용. 마이그레이션 실행 전 전체 영향도 파악.

```sql
-- ============================================================================
-- Phase A: 전화번호 정규화 영향도 DRY-RUN 조사
-- 실행: psql / Supabase SQL Editor에서 한 블록씩 실행
-- 쓰기 없음 (SELECT만)
-- ============================================================================

-- A.1) 전체 phone 컬럼 보유 테이블별 카운트
SELECT 'profiles' AS tbl, COUNT(*) AS total, COUNT(phone) AS with_phone FROM profiles
UNION ALL SELECT 'club_members', COUNT(*), COUNT(phone) FROM club_members
UNION ALL SELECT 'tournament_entries', COUNT(*), COUNT(phone) FROM tournament_entries
UNION ALL SELECT 'coaches', COUNT(*), COUNT(phone) FROM coaches
UNION ALL SELECT 'clubs', COUNT(*), COUNT(contact_phone) FROM clubs;

-- A.2) club_members 포맷 분포
SELECT
  CASE
    WHEN phone IS NULL THEN 'NULL'
    WHEN phone ~ '^[0-9]{11}$' THEN '숫자 11자리 (정규화 완료)'
    WHEN phone ~ '^010-[0-9]{4}-[0-9]{4}$' THEN '010-XXXX-XXXX'
    WHEN phone ~ '^[a-f0-9]{20,}:' THEN '암호화 오저장'
    WHEN phone ~ '^[0-9]{10}$' THEN '숫자 10자리 (유선)'
    ELSE '기타'
  END AS format_pattern,
  COUNT(*) AS cnt
FROM club_members
GROUP BY 1
ORDER BY cnt DESC;

-- A.3) tournament_entries 포맷 분포 (동일 패턴)
SELECT
  CASE
    WHEN phone IS NULL THEN 'NULL'
    WHEN phone ~ '^[0-9]{11}$' THEN '숫자 11자리'
    WHEN phone ~ '^010-[0-9]{4}-[0-9]{4}$' THEN '010-XXXX-XXXX'
    ELSE '기타'
  END AS format_pattern,
  COUNT(*) AS cnt
FROM tournament_entries
GROUP BY 1
ORDER BY cnt DESC;

-- A.4) profiles 평문 13건 식별
SELECT id, name, email, phone, created_at
FROM profiles
WHERE phone IS NOT NULL
  AND phone !~ '^[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$'
ORDER BY created_at DESC;

-- A.5) club_members 암호화 오저장 1건 식별
SELECT id, club_id, name, phone, length(phone) AS len
FROM club_members
WHERE phone ~ '^[a-f0-9]{20,}:';

-- A.6) 그룹 A/C 중복 식별 (REMOVED/LEFT 제외)
WITH normalized AS (
  SELECT id, club_id, name, phone, is_registered, user_id, status, created_at,
         regexp_replace(phone, '[^0-9]', '', 'g') AS phone_norm,
         TRIM(name) AS name_norm
  FROM club_members
  WHERE phone IS NOT NULL
    AND phone !~ '^[a-f0-9]{20,}:'
    AND status NOT IN ('REMOVED','LEFT')
),
groups AS (
  SELECT
    club_id, phone_norm,
    COUNT(*) AS total,
    COUNT(DISTINCT name_norm) AS distinct_names,
    array_agg(DISTINCT name_norm ORDER BY name_norm) AS names,
    array_agg(id ORDER BY created_at) AS ids,
    array_agg(is_registered::text ORDER BY created_at) AS is_reg_arr
  FROM normalized
  GROUP BY club_id, phone_norm
  HAVING COUNT(*) > 1
)
SELECT
  CASE WHEN distinct_names = 1 THEN 'A (동일인)' ELSE 'C (다른 이름)' END AS group_type,
  club_id, phone_norm, total, names, ids, is_reg_arr
FROM groups
ORDER BY group_type, total DESC;

-- A.7) tournament_entries.team_members JSONB 내부 phone 필드 존재 여부
SELECT COUNT(*) AS team_entries_with_phone_field
FROM tournament_entries
WHERE team_members IS NOT NULL
  AND jsonb_typeof(team_members) = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(team_members) AS m
    WHERE m ? 'phone'
  );

-- A.8) 국제화(+82) 포맷 존재 여부
SELECT
  (SELECT COUNT(*) FROM club_members WHERE phone LIKE '+82%') AS cm_plus82,
  (SELECT COUNT(*) FROM tournament_entries WHERE phone LIKE '+82%') AS te_plus82;

-- A.9) Phase E에서 FK 이관이 필요한 경우 참조 범위 사전 점검
--      그룹 A 중복 victim이 참조하는 테이블 일괄 확인
-- TODO: A.6 결과에서 victim id 리스트 확보 후 아래 쿼리를 개별 실행
-- SELECT 'club_session_attendances', COUNT(*) FROM club_session_attendances WHERE club_member_id IN (...);
-- SELECT 'club_member_invitations', COUNT(*) FROM club_member_invitations WHERE ... IN (...);
```

**실행 결과 저장 위치**: `docs/03-analysis/phone-audit.md` (조사 보고서로 보존)

---

## 5. Phase C — 백업 마이그레이션

### 파일: `supabase/migrations/20260410_02_phone_backup_snapshots.sql`

```sql
-- Phase C: 마이그레이션 전 백업 스냅샷
-- 롤백 필요 시 이 테이블에서 복원

CREATE TABLE IF NOT EXISTS _backup_club_members_20260410 AS
  SELECT * FROM club_members;

CREATE TABLE IF NOT EXISTS _backup_tournament_entries_20260410 AS
  SELECT * FROM tournament_entries;

CREATE TABLE IF NOT EXISTS _backup_profiles_20260410 AS
  SELECT * FROM profiles;

-- 생성 확인
SELECT
  '_backup_club_members_20260410' AS tbl, COUNT(*) AS rows FROM _backup_club_members_20260410
UNION ALL
SELECT '_backup_tournament_entries_20260410', COUNT(*) FROM _backup_tournament_entries_20260410
UNION ALL
SELECT '_backup_profiles_20260410', COUNT(*) FROM _backup_profiles_20260410;
```

**추가 백업** (Supabase Dashboard에서 수동):
- DB 레벨 Point-in-time Recovery 스냅샷 생성
- `pg_dump` 로컬 백업

---

## 6. Phase D — 정규화 마이그레이션

### 6.1 `supabase/migrations/20260410_01_phone_migration_review_table.sql`

```sql
-- Phase A/D용 리뷰 로그 테이블 (마이그레이션 완료 후 DROP)
CREATE TABLE IF NOT EXISTS _phone_migration_review (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table TEXT NOT NULL,
  source_id UUID NOT NULL,
  original_phone TEXT,
  normalized_attempt TEXT,
  reason TEXT NOT NULL,
  reviewed BOOLEAN DEFAULT false,
  reviewer_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phone_review_reviewed
  ON _phone_migration_review (reviewed, source_table);
```

### 6.2 `supabase/migrations/20260410_03_phone_normalize_club_members.sql`

```sql
BEGIN;

-- D.1) 암호화 오저장 1건 리뷰 테이블로 이관 후 NULL 처리
INSERT INTO _phone_migration_review (source_table, source_id, original_phone, reason)
SELECT 'club_members', id, phone, 'encrypted_misstored'
FROM club_members
WHERE phone ~ '^[a-f0-9]{20,}:';

UPDATE club_members
SET phone = NULL
WHERE phone ~ '^[a-f0-9]{20,}:';

-- D.2) 나머지 정규화 (하이픈/공백/점 제거)
WITH targets AS (
  SELECT id, phone
  FROM club_members
  WHERE phone IS NOT NULL
    AND phone !~ '^[0-9]{9,11}$'
)
UPDATE club_members cm
SET phone = regexp_replace(targets.phone, '[^0-9]', '', 'g')
FROM targets
WHERE cm.id = targets.id;

-- D.3) 정규화 후 11자리(또는 유선 9~10자리) 아닌 값 리뷰 테이블로 적재 후 NULL 처리
INSERT INTO _phone_migration_review (source_table, source_id, original_phone, normalized_attempt, reason)
SELECT 'club_members', id, phone, phone, 'invalid_length_after_normalize'
FROM club_members
WHERE phone IS NOT NULL
  AND phone !~ '^[0-9]{9,11}$';

UPDATE club_members
SET phone = NULL
WHERE phone IS NOT NULL
  AND phone !~ '^[0-9]{9,11}$';

-- D.4) 통계 확인
SELECT
  'club_members_after_normalize' AS step,
  COUNT(*) FILTER (WHERE phone IS NULL) AS null_count,
  COUNT(*) FILTER (WHERE phone ~ '^[0-9]{11}$') AS digits_11,
  COUNT(*) FILTER (WHERE phone ~ '^[0-9]{9,10}$') AS digits_9_10,
  COUNT(*) FILTER (WHERE phone IS NOT NULL AND phone !~ '^[0-9]{9,11}$') AS invalid
FROM club_members;

-- 수동 검토: 결과가 기대와 다르면 ROLLBACK;
-- 정상이면 COMMIT;
COMMIT;
```

### 6.3 `supabase/migrations/20260410_04_phone_normalize_tournament_entries.sql`

```sql
BEGIN;

-- E.1) 정규화 대상 업데이트
WITH targets AS (
  SELECT id, phone
  FROM tournament_entries
  WHERE phone IS NOT NULL
    AND phone !~ '^[0-9]{9,11}$'
)
UPDATE tournament_entries te
SET phone = regexp_replace(targets.phone, '[^0-9]', '', 'g')
FROM targets
WHERE te.id = targets.id;

-- E.2) 유효성 재확인
INSERT INTO _phone_migration_review (source_table, source_id, original_phone, normalized_attempt, reason)
SELECT 'tournament_entries', id, phone, phone, 'invalid_length_after_normalize'
FROM tournament_entries
WHERE phone IS NOT NULL
  AND phone !~ '^[0-9]{9,11}$';

UPDATE tournament_entries
SET phone = NULL
WHERE phone IS NOT NULL
  AND phone !~ '^[0-9]{9,11}$';

-- E.3) 통계
SELECT
  'tournament_entries_after_normalize' AS step,
  COUNT(*) FILTER (WHERE phone IS NULL) AS null_count,
  COUNT(*) FILTER (WHERE phone ~ '^[0-9]{11}$') AS digits_11,
  COUNT(*) FILTER (WHERE phone IS NOT NULL AND phone !~ '^[0-9]{9,11}$') AS invalid
FROM tournament_entries;

COMMIT;
```

### 6.4 `scripts/reencrypt-profile-phones.ts` (Node 스크립트)

SQL로 `encrypt()` 호출 불가능하므로 애플리케이션 레벨 스크립트로 처리.

```ts
// scripts/reencrypt-profile-phones.ts
// 실행: npx tsx scripts/reencrypt-profile-phones.ts
//
// profiles.phone이 평문으로 저장된 행을 찾아 암호화된 값으로 UPDATE
// Phase B에서 네이버 콜백 버그 수정 후 기존 오염 데이터를 복구하는 1회성 스크립트

import { createAdminClient } from '@/lib/supabase/admin'
import { encrypt, isEncrypted } from '@/lib/crypto/encryption'
import { unformatPhoneNumber } from '@/lib/utils/phone'

async function main() {
  const admin = createAdminClient()

  // 평문 phone 행 조회 (iv:tag:data 포맷이 아닌 것)
  const { data: rows, error } = await admin
    .from('profiles')
    .select('id, phone, name, email')
    .not('phone', 'is', null)

  if (error) throw error
  if (!rows) return

  const plaintext = rows.filter((r) => r.phone && !isEncrypted(r.phone))
  console.log(`[reencrypt] 평문 대상: ${plaintext.length}건`)

  let success = 0
  let failed = 0

  for (const row of plaintext) {
    try {
      const normalized = unformatPhoneNumber(row.phone!)
      if (!normalized) {
        console.log(`[skip] ${row.id} (${row.name}): 정규화 결과 empty`)
        continue
      }

      const encrypted = encrypt(normalized)

      const { error: updateError } = await admin
        .from('profiles')
        .update({ phone: encrypted })
        .eq('id', row.id)

      if (updateError) {
        console.error(`[fail] ${row.id} (${row.name}):`, updateError.message)
        failed++
      } else {
        console.log(`[ok] ${row.id} (${row.name}): ${normalized} → encrypted`)
        success++
      }
    } catch (e) {
      console.error(`[error] ${row.id}:`, e)
      failed++
    }
  }

  console.log(`\n[완료] 성공 ${success}건 / 실패 ${failed}건`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

**실행 체크리스트**:
1. `.env.local`의 `SUPABASE_SERVICE_ROLE_KEY` 확인
2. `npx tsx scripts/reencrypt-profile-phones.ts --dry-run` 모드 먼저 실행하도록 옵션 추가 (실제 UPDATE 대신 로그만)
3. dry-run 결과 리뷰 후 실제 실행
4. 실행 후 A.4 쿼리 재실행으로 평문 0건 확인

---

## 7. Phase E — 그룹 A 중복 병합

### 7.1 공통 FK 이관 헬퍼 함수 (DB 프로시저)

> **Phase A 결과**: 14 victim 전부 11개 FK 참조 **0건** — 실제 호출 불필요. 단, 향후 유사 상황 대비 **안전장치로 함수는 생성**.

`supabase/migrations/20260410_05_phone_merge_group_a_duplicates.sql`:

```sql
-- Phase E 전용 헬퍼: victim의 FK 참조를 survivor로 이관
-- Phase A.9 결과 현재 데이터에서는 참조 없음. 안전장치로만 유지.
CREATE OR REPLACE FUNCTION _phone_migration_merge_fk(
  survivor_id UUID,
  victim_id UUID
) RETURNS void AS $$
BEGIN
  -- club_match_results 5개 컬럼
  UPDATE club_match_results SET player1_member_id = survivor_id WHERE player1_member_id = victim_id;
  UPDATE club_match_results SET player1b_member_id = survivor_id WHERE player1b_member_id = victim_id;
  UPDATE club_match_results SET player2_member_id = survivor_id WHERE player2_member_id = victim_id;
  UPDATE club_match_results SET player2b_member_id = survivor_id WHERE player2b_member_id = victim_id;
  UPDATE club_match_results SET winner_member_id = survivor_id WHERE winner_member_id = victim_id;

  -- 통계/출석
  UPDATE club_member_stats SET club_member_id = survivor_id WHERE club_member_id = victim_id;
  UPDATE club_session_attendances SET club_member_id = survivor_id WHERE club_member_id = victim_id;

  -- 레슨 관련
  UPDATE lesson_bookings SET member_id = survivor_id WHERE member_id = victim_id;
  UPDATE lesson_extension_requests SET member_id = survivor_id WHERE member_id = victim_id;
  UPDATE lesson_slots SET locked_member_id = survivor_id WHERE locked_member_id = victim_id;

  -- 알림
  UPDATE session_notifications SET member_id = survivor_id WHERE member_id = victim_id;
END;
$$ LANGUAGE plpgsql;
```

### 7.2 그룹 A 병합 스크립트

> **Phase A 결과로 간소화됨**: 14 victim 전부 FK 참조 0건 확인 → metadata 병합 및 FK 이관 없이 단순 DELETE만으로 병합 완료. 아래 절차의 Step 2(metadata 병합)와 Step 3(FK 이관)은 **이번 마이그레이션에서는 생략 가능**.

```sql
-- ============================================================================
-- Phase E: 그룹 A (동일 이름 + 동일 phone + 동일 club) 13 그룹 14행 병합
-- !!! 클럽 단위 수동 확인 후 블록별 실행 !!!
-- ============================================================================

-- E.1) survivor 선정 미리보기 — COMMIT 전 반드시 검토
WITH normalized AS (
  SELECT id, club_id, name, phone, is_registered, user_id, status,
         introduction, created_at,
         regexp_replace(phone, '[^0-9]', '', 'g') AS phone_norm,
         TRIM(name) AS name_norm
  FROM club_members
  WHERE phone IS NOT NULL
    AND phone !~ '^[a-f0-9]{20,}:'
    AND status NOT IN ('REMOVED','LEFT')
),
group_a AS (
  -- 동일 이름만 (그룹 C 제외)
  SELECT club_id, phone_norm, name_norm
  FROM normalized
  GROUP BY club_id, phone_norm, name_norm
  HAVING COUNT(*) > 1
),
ranked AS (
  SELECT n.*,
    ROW_NUMBER() OVER (
      PARTITION BY n.club_id, n.phone_norm, n.name_norm
      ORDER BY
        CASE
          WHEN n.is_registered AND n.user_id IS NOT NULL AND n.status='ACTIVE' THEN 0
          WHEN n.is_registered AND n.user_id IS NOT NULL AND n.status='PENDING' THEN 1
          WHEN n.is_registered THEN 2
          ELSE 3
        END,
      COALESCE(LENGTH(n.introduction), 0) DESC,
      n.created_at ASC
    ) AS rn
  FROM normalized n
  JOIN group_a g ON g.club_id = n.club_id
    AND g.phone_norm = n.phone_norm
    AND g.name_norm = n.name_norm
)
SELECT
  club_id, phone_norm, name_norm, id, is_registered, status, created_at,
  CASE WHEN rn = 1 THEN '✅ SURVIVOR' ELSE '❌ DELETE' END AS action
FROM ranked
ORDER BY club_id, phone_norm, rn;
-- 이 결과를 _phone_migration_review에도 기록 권장

-- ============================================================================
-- E.2) 실제 병합 — Phase A 결과 기반 단순화 경로
--
-- Phase A §4.4: 14 victim 모두 FK 참조 0건 확인됨 → 단순 DELETE만으로 완료
-- cf19b05a 클럽에 12 그룹 집중 + a952af1e 강기태 1 그룹 = 총 13 그룹 14 행
-- ============================================================================

-- E.2.a) 검증: 실행 직전 14 victim id가 여전히 존재하는지, FK 참조 0 재확인
WITH victims AS (
  SELECT unnest(ARRAY[
    'e1c116a5-6b16-4985-b3f5-2237ee14d889',  -- 강기태 a952af1e
    '8d1f590d-fd7f-47f9-8245-3aebe7318d68',  -- 김나래 cf19b05a
    'f0f3963d-dc34-49d9-b5e6-87a9ad977aa5',  -- 김민주 cf19b05a
    'a13e6d92-be7c-483e-993d-56d2acbc6e80',  -- 김수진 cf19b05a
    '68b3cf97-8e54-4bd0-8733-9361cd92acac',  -- 안민환 cf19b05a
    'd9259445-4403-4452-b078-4a4c5b6a421b',  -- 양현선 cf19b05a (rank 2)
    'f998692a-560a-4f9e-8622-753584eb7986',  -- 양현선 cf19b05a (rank 3)
    '00cec7f3-0ae3-4bcd-8d09-060a2f3f86f5',  -- 양혜정 cf19b05a
    'd91e83a6-22be-44d6-8ad3-d310c6e74054',  -- 이재경 cf19b05a
    'b90c7bad-8a4d-45f3-8ef6-889124c5fa6e',  -- 이준한 cf19b05a
    '0aa42a50-27ed-42a0-a375-8df44cee4335',  -- 최민지 cf19b05a
    '59c248d2-0e56-46b9-a0e5-06aabbf3a320',  -- 한정은 cf19b05a
    '1330c25d-2153-48db-ad94-5df92adb1d4a',  -- 허은숙 cf19b05a
    '3bbb1201-8198-45a9-a6f8-0f7826406c80'   -- 홍경자 cf19b05a
  ]::uuid[]) AS id
)
SELECT
  (SELECT COUNT(*) FROM club_members WHERE id IN (SELECT id FROM victims)) AS still_exists,
  (SELECT COUNT(*) FROM club_match_results WHERE player1_member_id IN (SELECT id FROM victims)) AS cmr_p1,
  (SELECT COUNT(*) FROM club_match_results WHERE player2_member_id IN (SELECT id FROM victims)) AS cmr_p2,
  (SELECT COUNT(*) FROM club_session_attendances WHERE club_member_id IN (SELECT id FROM victims)) AS attendances;
-- 기대값: still_exists=14, 나머지 전부 0

-- E.2.b) 트랜잭션 내에서 DELETE 실행
BEGIN;

  DELETE FROM club_members
  WHERE id IN (
    'e1c116a5-6b16-4985-b3f5-2237ee14d889',
    '8d1f590d-fd7f-47f9-8245-3aebe7318d68',
    'f0f3963d-dc34-49d9-b5e6-87a9ad977aa5',
    'a13e6d92-be7c-483e-993d-56d2acbc6e80',
    '68b3cf97-8e54-4bd0-8733-9361cd92acac',
    'd9259445-4403-4452-b078-4a4c5b6a421b',
    'f998692a-560a-4f9e-8622-753584eb7986',
    '00cec7f3-0ae3-4bcd-8d09-060a2f3f86f5',
    'd91e83a6-22be-44d6-8ad3-d310c6e74054',
    'b90c7bad-8a4d-45f3-8ef6-889124c5fa6e',
    '0aa42a50-27ed-42a0-a375-8df44cee4335',
    '59c248d2-0e56-46b9-a0e5-06aabbf3a320',
    '1330c25d-2153-48db-ad94-5df92adb1d4a',
    '3bbb1201-8198-45a9-a6f8-0f7826406c80'
  );

  -- 검증: 14건 삭제되었는지 (PostgreSQL에서는 DELETE 결과의 ROW_COUNT 확인)
  -- 영향 받은 행이 14가 아니면 ROLLBACK

COMMIT;


-- ============================================================================
-- 참고: 아래는 일반 병합 패턴 (향후 중복에 metadata 보존/FK 이관이 필요한 케이스용)
--       현재 마이그레이션에서는 사용하지 않음
-- ============================================================================

-- 예시: cf19b05a 클럽의 "양현선" 그룹 병합
BEGIN;

  -- 1) survivor id 조회 (메뉴얼 확인 후 고정값 사용)
  -- SURVIVOR_ID / VICTIM_IDS를 E.1 결과에서 수동 복사
  
  -- 2) victim metadata를 survivor에 병합
  -- UPDATE club_members SET
  --   introduction = COALESCE(introduction, (SELECT introduction FROM club_members WHERE id = 'VICTIM_ID')),
  --   rating = COALESCE(rating, (SELECT rating FROM club_members WHERE id = 'VICTIM_ID')),
  --   ...
  -- WHERE id = 'SURVIVOR_ID';

  -- 3) FK 이관
  -- SELECT _phone_migration_merge_fk('SURVIVOR_ID', 'VICTIM_ID_1');
  -- SELECT _phone_migration_merge_fk('SURVIVOR_ID', 'VICTIM_ID_2');

  -- 4) victim 삭제
  -- DELETE FROM club_members WHERE id IN ('VICTIM_ID_1', 'VICTIM_ID_2');

  -- 5) 검증: survivor만 남았는지 확인
  -- SELECT * FROM club_members WHERE club_id = 'cf19b05a-...' AND name = '양현선';
  
-- ROLLBACK;  ← 결과가 예상과 다르면
COMMIT;
```

### 7.3 그룹 C 리뷰 로그 + 관리자 알림

`supabase/migrations/20260410_06_phone_group_c_review_log.sql`:

```sql
-- Phase E 후속: 그룹 C (다른 이름/같은 phone) 2 그룹 4행을 리뷰 테이블에 기록
-- 자동 병합 금지, SUPER_ADMIN 수동 처리 필요

INSERT INTO _phone_migration_review (source_table, source_id, original_phone, normalized_attempt, reason)
SELECT 'club_members', cm.id, cm.phone, regexp_replace(cm.phone, '[^0-9]', '', 'g'),
       'different_names_same_phone: club=' || cm.club_id || ' name=' || cm.name
FROM club_members cm
WHERE (cm.club_id, regexp_replace(cm.phone, '[^0-9]', '', 'g')) IN (
  WITH normalized AS (
    SELECT club_id, phone, TRIM(name) AS name_norm,
           regexp_replace(phone, '[^0-9]', '', 'g') AS phone_norm
    FROM club_members
    WHERE phone IS NOT NULL
      AND phone !~ '^[a-f0-9]{20,}:'
      AND status NOT IN ('REMOVED','LEFT')
  )
  SELECT club_id, phone_norm
  FROM normalized
  GROUP BY club_id, phone_norm
  HAVING COUNT(*) > 1 AND COUNT(DISTINCT name_norm) > 1
);

-- 리뷰 대상 확인
SELECT * FROM _phone_migration_review
WHERE reason LIKE 'different_names_same_phone%' AND NOT reviewed;
```

**수동 처리 절차**:
1. SUPER_ADMIN이 `_phone_migration_review`에서 대상 확인
2. 해당 클럽 관리자에게 알림 발송(또는 직접 연락)하여 어느 이름이 정확한지 확인
3. 오답 레코드의 `phone = NULL` UPDATE 또는 DELETE
4. `_phone_migration_review.reviewed = true` + `reviewer_note` 기록

---

## 8. Phase F — DB 제약 추가

### 파일: `supabase/migrations/20260410_07_phone_db_constraints.sql`

```sql
-- ============================================================================
-- Phase F: DB 레벨 방어선 추가
-- 선행 조건: Phase D, E, E'(그룹 C 수동 정리) 완료
-- ============================================================================

-- F.1) 선행 조건 검증 (실행 전 수동 확인)
-- 아래 4개 쿼리 모두 0이 나와야 안전하게 제약 추가 가능

-- F.1.a) club_members 포맷 위반 없음
-- SELECT COUNT(*) FROM club_members 
-- WHERE phone IS NOT NULL AND phone !~ '^[0-9]{9,11}$';
-- → 반드시 0

-- F.1.b) tournament_entries 포맷 위반 없음
-- SELECT COUNT(*) FROM tournament_entries 
-- WHERE phone IS NOT NULL AND phone !~ '^[0-9]{9,11}$';
-- → 반드시 0

-- F.1.c) (club_id, phone) 중복 없음
-- WITH normalized AS (
--   SELECT club_id, phone FROM club_members
--   WHERE phone IS NOT NULL AND status NOT IN ('REMOVED','LEFT')
-- )
-- SELECT club_id, phone, COUNT(*) FROM normalized
-- GROUP BY club_id, phone HAVING COUNT(*) > 1;
-- → 반드시 0행

-- F.1.d) profiles 평문 0건
-- SELECT COUNT(*) FROM profiles 
-- WHERE phone IS NOT NULL AND phone !~ '^[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$';
-- → 반드시 0

-- ============================================================================
-- F.2) 제약 추가
-- ============================================================================

-- club_members CHECK
ALTER TABLE club_members
  ADD CONSTRAINT club_members_phone_format
  CHECK (phone IS NULL OR phone ~ '^[0-9]{9,11}$');

-- tournament_entries CHECK
ALTER TABLE tournament_entries
  ADD CONSTRAINT tournament_entries_phone_format
  CHECK (phone IS NULL OR phone ~ '^[0-9]{9,11}$');

-- (club_id, phone) UNIQUE partial index
CREATE UNIQUE INDEX club_members_club_phone_unique
  ON club_members (club_id, phone)
  WHERE phone IS NOT NULL
    AND status NOT IN ('REMOVED', 'LEFT');
```

---

## 9. Phase G — 검증 및 백업 정리

### 파일: `supabase/migrations/20260410_08_phone_cleanup_backup_tables.sql`

**실행 시기**: Phase F 완료 후 **최소 1주일 모니터링** 후

```sql
-- Phase G: 백업 테이블 + 보조 테이블 + 헬퍼 함수 정리

-- G.1) _phone_migration_review 수동 리뷰 완료 확인
SELECT COUNT(*) FROM _phone_migration_review WHERE NOT reviewed;
-- → 0이 아니면 DROP 보류

-- G.2) 백업 테이블 삭제
DROP TABLE IF EXISTS _backup_club_members_20260410;
DROP TABLE IF EXISTS _backup_tournament_entries_20260410;
DROP TABLE IF EXISTS _backup_profiles_20260410;

-- G.3) 리뷰 테이블 삭제
DROP TABLE IF EXISTS _phone_migration_review;

-- G.4) 헬퍼 함수 삭제
DROP FUNCTION IF EXISTS _phone_migration_merge_fk(UUID, UUID);
```

### 검증 체크리스트

Phase F 완료 직후 수행:

```sql
-- 1) 전체 포맷 통일 확인
SELECT 'club_members' AS tbl,
  COUNT(*) FILTER (WHERE phone IS NULL) AS null_cnt,
  COUNT(*) FILTER (WHERE phone ~ '^[0-9]{11}$') AS digits_11,
  COUNT(*) FILTER (WHERE phone IS NOT NULL AND phone !~ '^[0-9]{11}$') AS other
FROM club_members
UNION ALL
SELECT 'tournament_entries', 
  COUNT(*) FILTER (WHERE phone IS NULL),
  COUNT(*) FILTER (WHERE phone ~ '^[0-9]{11}$'),
  COUNT(*) FILTER (WHERE phone IS NOT NULL AND phone !~ '^[0-9]{11}$')
FROM tournament_entries;

-- 2) profiles 전부 암호화
SELECT COUNT(*) FROM profiles
WHERE phone IS NOT NULL AND phone !~ '^[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$';
-- → 0

-- 3) club_members 중복 0건 (status 제외 고려)
WITH n AS (SELECT club_id, phone FROM club_members
           WHERE phone IS NOT NULL AND status NOT IN ('REMOVED','LEFT'))
SELECT club_id, phone, COUNT(*) FROM n
GROUP BY club_id, phone HAVING COUNT(*) > 1;
-- → 0행
```

---

## 10. Server Action 과도기 호환 제거 (Phase D 이후)

Phase D가 완료되면 `joinClubAsRegistered`의 `.or()` 호환 코드를 단순화해야 합니다.

### 변경 diff (Phase D 완료 직후 추가 PR)

```diff
- const hyphenFormatted = normalizedPhone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')
-
  const { data: existingList } = await admin
    .from('club_members')
    .select('id, is_registered, user_id, introduction, status, phone')
    .eq('club_id', clubId)
-   .or(`phone.eq.${normalizedPhone},phone.eq.${hyphenFormatted}`)
+   .eq('phone', normalizedPhone)
    .neq('status', 'REMOVED')
    .neq('status', 'LEFT')
```

---

## 11. 테스트 전략

### 11.1 단위 테스트 — `src/lib/utils/__tests__/phone.test.ts` 추가

```ts
import { describe, it, expect } from 'vitest'
import { formatPhoneNumber, unformatPhoneNumber, validatePhoneNumber } from '../phone'

describe('unformatPhoneNumber', () => {
  it.each([
    ['010-1234-5678', '01012345678'],
    ['010 1234 5678', '01012345678'],
    ['010.1234.5678', '01012345678'],
    ['01012345678', '01012345678'],
    ['+82 10 1234 5678', '821012345678'],  // 현재 동작: 82 앞에 + 만 제거
    ['', ''],
    [null as unknown as string, ''],
    [undefined as unknown as string, ''],
    ['abc-def', ''],
    ['010-1234-567a', '0101234567'],  // 마지막 문자 제거 → 유효성 검사에서 걸림
  ])('정규화 %s → %s', (input, expected) => {
    expect(unformatPhoneNumber(input)).toBe(expected)
  })
})

describe('formatPhoneNumber', () => {
  it.each([
    ['01012345678', '010-1234-5678'],
    ['010-1234-5678', '010-1234-5678'],  // 이미 포맷된 값 idempotent
    ['0101234', '010-1234'],  // 7자리까지만
    ['010', '010'],
    ['', ''],
  ])('포맷 %s → %s', (input, expected) => {
    expect(formatPhoneNumber(input)).toBe(expected)
  })
})

describe('validatePhoneNumber', () => {
  it('유효한 11자리 휴대폰', () => {
    expect(validatePhoneNumber('010-1234-5678')).toBe(true)
    expect(validatePhoneNumber('01012345678')).toBe(true)
  })

  it('10자리 이하 거부', () => {
    expect(validatePhoneNumber('0101234567')).toContain('10-11자리')
  })

  it('빈 값은 통과 (optional 필드)', () => {
    expect(validatePhoneNumber('')).toBe(true)
  })

  it('01로 시작하지 않으면 거부', () => {
    expect(validatePhoneNumber('02-1234-5678')).toContain('휴대폰')
  })
})
```

### 11.2 통합 테스트 (Playwright 시나리오)

Phase D 이후 수동 실행:

| # | 시나리오 | 기대 결과 |
|---|---|---|
| 1 | 네이버 로그인 신규 유저 프로필 phone 확인 | profiles.phone 암호화 저장 |
| 2 | 난테모에 사전 등록된 phone으로 신규 가입 시도 | 기존 레코드 UPDATE, 신규 INSERT 없음 |
| 3 | 동일 phone 다른 포맷으로 재시도 | 정규화 후 동일 결과 |
| 4 | 관리자가 같은 phone으로 `addUnregisteredMember` 재등록 | UNIQUE 제약 에러 반환 |
| 5 | 가입 신청 후 관리자 승인 | 좀비 레코드 없음, 1개만 ACTIVE |

### 11.3 회귀 테스트 (기존 동작 유지)

- 프로필 수정 → phone 암호화 저장 (기존)
- 대회 참가 신청 → tournament_entries.phone 저장 (기존)
- 레슨 예약 → lesson_bookings.guest_phone 저장 (기존)

---

## 12. 실행 타임라인

| 일차 | 작업 | 위험도 | 커밋 분리 |
|---|---|---|---|
| **D-1** | Phase A 조사 스크립트 실행, 결과 `docs/03-analysis/phone-audit.md`에 저장 | ❎ 0 | - |
| **D-1** | 네이버 콜백 버그 수정 + `updateProfile` 정규화 + Server Action 정규화 | ⚠️ 낮음 | 커밋 1 |
| **D-1** | `phone.test.ts` 단위 테스트 추가 | ❎ 0 | 커밋 1 포함 |
| **D-1** | Phase B 잔여 수정 배포, 1~2일 모니터링 | ⚠️ 낮음 | - |
| **D-3** | Phase C 백업 (SQL + Supabase Dashboard 스냅샷) | ❎ 0 | 커밋 2 (마이그레이션) |
| **D-3** | Phase D 정규화 마이그레이션 실행 | ⚠️ 중간 | 커밋 2 |
| **D-3** | `reencrypt-profile-phones.ts` dry-run → 실행 | ⚠️ 중간 | 커밋 3 (스크립트) |
| **D-4** | Phase E 그룹 A 병합 (클럽 단위 수동) | 🔴 높음 | 커밋 4 (수동 실행) |
| **D-4** | Phase E' 그룹 C 리뷰 로그 + SUPER_ADMIN 수동 정리 | 🔴 높음 | 커밋 4 포함 |
| **D-5** | Phase F 제약 추가 (선행 조건 검증 후) | ⚠️ 낮음 | 커밋 5 |
| **D-5** | Phase B 과도기 `.or()` 코드 제거 | ⚠️ 낮음 | 커밋 6 |
| **D-12** | Phase G 백업 테이블 DROP | ❎ 0 | 커밋 7 |

---

## 13. 롤백 플레이북

| Phase | 문제 발생 시 롤백 |
|---|---|
| B (Server Action 정규화) | `git revert <sha>` + 배포 |
| C (백업 생성) | `DROP TABLE _backup_*;` (롤백 아님, 정리) |
| D (club_members 정규화) | `TRUNCATE club_members; INSERT INTO club_members SELECT * FROM _backup_club_members_20260410;` |
| D (tournament_entries 정규화) | 동일 백업 복원 |
| D (profiles 재암호화) | 동일 백업 복원 |
| E (그룹 A 병합) | 해당 클럽만 백업에서 복원: `DELETE FROM club_members WHERE club_id = 'X'; INSERT INTO club_members SELECT * FROM _backup_club_members_20260410 WHERE club_id = 'X';` |
| F (제약 추가) | `ALTER TABLE ... DROP CONSTRAINT ...; DROP INDEX ...;` |

---

## 14. 오픈 이슈 해결 상태 (Phase A 실행 후 확정)

> **참조**: `docs/03-analysis/phone-audit.md`

| # | 이슈 | Plan 시점 | Phase A 결과 | 최종 결정 |
|---|---|---|---|---|
| 1 | 저장 포맷 | 숫자 11자리 전제 | — | ✅ **숫자 11자리 확정** |
| **2** | `team_members`/`partner_data` JSONB 내부 phone | 조사 필요 | 두 필드 모두 **0건** | ✅ **추가 마이그레이션 불필요** |
| 3 | `clubs.contact_phone`, `coaches.phone` 포함 | 제외 | — | ✅ 제외 유지 (본 Plan 범위 외) |
| 4 | `_phone_migration_review` 보관 기간 | 미정 | — | ✅ 1주 후 DROP (G.3) |
| **5** | 국제화 `+82` | 조사 필요 | **전 테이블 0건** | ✅ **지원 범위 외 확정** — `normalizePhone` 변경 없음 |
| 6 | 그룹 C 수동 정리 주체 | 미정 | — | ✅ SUPER_ADMIN 직접 처리 |
| **신규** | **Phase E FK 이관 필요 여부** | 미지 | 14 victim의 **11개 FK 전부 0건 참조** | ✅ **FK 이관 불필요** — 헬퍼 함수는 안전장치로만 유지, 실제 호출 생략 가능. 단순 DELETE로 병합 완료 |
| **신규** | 그룹 A 집중 클럽 | Plan에서 `cf19b05a` 11 그룹 언급 | **12 그룹 집중 확정** (강기태만 예외 `a952af1e`) | ✅ **cf19b05a 단일 클럽 일괄 처리 가능** |
| **신규** | `profiles` 평문 13건 근본 원인 | 미지 | **13건 전부 네이버 콜백 생성 계정** (2026-02-23 대거 + 이후 산발) | ✅ 네이버 콜백 `encryptProfile()` 누락 버그 수정 = Phase B 포함 |

---

## 15. 다음 단계 (Do Phase 준비)

1. **Phase A 스크립트 즉시 실행 가능** (0 risk)
   - `scripts/phase-a-dry-run.sql` 생성
   - Supabase SQL Editor에서 순차 실행
   - 결과를 `docs/03-analysis/phone-audit.md`에 보존
2. **네이버 콜백 버그 수정 즉시 커밋** (별도 PR로도 가능)
3. **단위 테스트 작성** → CI 통과 확인
4. Phase C → D → E → F → G 순차 실행

---

> 이 Design 문서는 Plan의 7 Phase 전략을 구체 SQL/스크립트/파일 경로로 상세화합니다. Do Phase 착수 전 이 문서를 기반으로 SUPER_ADMIN이 최종 승인해야 합니다.
