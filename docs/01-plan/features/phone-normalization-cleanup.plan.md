# Plan: 전화번호 정규화 및 클럽 회원 중복 방지

## Executive Summary

| 항목 | 내용 |
|---|---|
| **Feature** | phone-normalization-cleanup |
| **Phase** | Plan |
| **작성일** | 2026-04-10 |
| **예상 범위** | `club_members`, `tournament_entries`, `profiles` 3개 테이블 + 공용 유틸 + Server Actions 매칭 로직 |

### Value Delivered (4관점)

| 관점 | 내용 |
|---|---|
| **Problem** | 전화번호가 `010-XXXX-XXXX` / `010XXXXXXXX` / `010 XXXX XXXX` / 암호화 혼재로 저장되어, "가입하기" 시 기존 비가입 회원 매칭이 포맷 차이만으로 실패 → 동일인 중복 레코드가 이미 13개 그룹(정리 대상 14행)에 걸쳐 발생 중. `profiles.phone` 13건은 암호화 정책 위반 평문(네이버 콜백 버그). `club_members` 1건은 반대로 암호화된 값이 잘못 저장됨. |
| **Solution** | (1) `normalizePhone()` 공용 유틸로 입력 경로 통일 (2) 세 테이블 phone 컬럼을 정규화된 숫자 11자리로 마이그레이션 (3) `(club_id, phone)` UNIQUE 제약으로 DB 레벨 방어선 구축 (4) `joinClubAsRegistered` + `respondJoinRequest` 역매칭 강화 (5) `profiles.phone` 평문 13건 암호화 재적용 |
| **Function UX Effect** | 관리자가 사전 등록한 회원이 앱 가입 후 `/clubs/{id}` 가입하기 클릭 시, 기존 레코드와 자동으로 매칭되어 **좀비 중복 레코드 0건** 보장. **그룹 A (동일인 중복) 13그룹 14행만 일괄 병합 스크립트로 자동 정리**하고, 그룹 B(시스템 owner 이력)는 실제 ACTIVE 중복이 없으므로 대상 외, 그룹 C(다른 이름/같은 phone 2그룹)는 데이터 오염 가능성이 있어 자동 병합에서 제외하고 리뷰 테이블에 기록만 남긴다. 관리자/사용자 어느 쪽이 어떤 포맷으로 입력하든 동일하게 동작. |
| **Core Value** | 데이터 무결성 확보 + 중복 계산으로 인한 랭킹/통계 왜곡 제거 + "가입 승인 후에도 본인이 기존 회원 이력에 연결되지 않는" 사용자 혼란 방지. 방금 등록한 난테모 24명의 실제 가입 플로우를 사고 없이 받을 수 있는 전제 조건. |

---

## 1. 개요

### 1.1 배경

`club_members` 테이블에 453건 중 20건이 하이픈 없는 포맷(`01012345678`), 1건이 공백 구분, 1건이 암호화된 값으로 저장되어 있고, `tournament_entries`는 78건 중 41건이 하이픈 없음·37건이 하이픈 표준으로 거의 반반 섞여 있다. `profiles.phone`은 정책상 전부 암호화여야 하지만 13건이 평문으로 남아 있다.

`src/lib/clubs/actions.ts:645-714`의 `joinClubAsRegistered()`는 사용자가 클럽 가입 버튼을 눌렀을 때 `.eq('phone', user.phone)`로 정확 일치 매칭을 수행하는데, 포맷 하나만 달라도 기존 비가입 레코드(`is_registered=false, user_id=null`)를 찾지 못하고 **신규 INSERT**로 흘러 동일인 중복 레코드를 만든다. 관리자 승인 단계(`respondJoinRequest`)는 중복 검사 자체가 없어 이미 생긴 중복을 정리하지 못한다.

실제로 정규화(숫자만) 기준 `status NOT IN ('REMOVED','LEFT')` 필터로 그룹화 결과 **15개 그룹, 총 31행, 정리 필요한 잉여 16행**의 중복이 이미 DB에 존재한다. REMOVED 상태까지 포함하면 21개 그룹/24행이지만, UNIQUE partial index가 REMOVED/LEFT를 제외하므로 실질 정리 대상은 16행이다.

추가로 실사례 조사 과정에서 **네이버 로그인 콜백(`src/app/api/auth/naver/callback/route.ts`)이 `profiles.phone`에 평문을 저장하는 버그**가 확인되었다. 2026-04-10에 생성된 `silcilee@naver.com` 계정(허정학 네이버 부계정)의 phone이 `01085891858` 평문으로 저장되어 있으며, 이것이 `profiles.phone` 평문 13건의 원인이다. 이 상태에서 해당 계정이 리액트 클럽에 "가입하기"를 누르자, 기존에 관리자 수동 등록된 `010-8589-1858`(하이픈 포맷, `is_registered=false`) 레코드와 포맷 불일치로 매칭 실패 → 신규 INSERT → 기존 레코드는 관리자가 REMOVED 처리. **본 Plan이 해결하려는 버그의 실제 재현 사례**이다.

### 1.2 목표

1. 애플리케이션 전 경로에서 전화번호를 단일 포맷(숫자 11자리)으로 저장하는 정규화 함수 제공
2. 기존 `club_members`, `tournament_entries`, `profiles.phone`을 정규화된 포맷으로 일괄 마이그레이션
3. `(club_id, phone)` DB UNIQUE 제약으로 중복 삽입을 DB 레벨에서 차단
4. `joinClubAsRegistered`, `respondJoinRequest`, `profile.updateProfile` 3지점에서 phone 매칭/저장 로직 통일
5. `profiles.phone` 평문 13건을 재암호화, `club_members.phone` 암호화 오저장 1건을 복호화
6. 기존 중복 24행을 손실 없이 병합

### 1.3 범위

| 포함 | 제외 |
|---|---|
| `src/lib/utils/phone.ts` (신규) — normalizePhone, formatPhone, isValidPhone | 전화번호 SMS 인증 (별도 기능) |
| DB 마이그레이션: `club_members`, `tournament_entries`, `profiles.phone` 정규화 | `clubs.contact_phone`, `coaches.phone` (사용량 적고 단일 관리자 입력) |
| **그룹 A (동일인 중복) 13그룹 14행 병합 스크립트** (`is_registered=true` 우선 유지) | **그룹 B (시스템 owner 이력)**: 실제 ACTIVE 중복 없음 — 대상 외 |
| `(club_id, phone)` UNIQUE partial index (status NOT IN REMOVED/LEFT) | **그룹 C (다른 이름/같은 phone) 2그룹 4행**: 자동 병합 금지, `_phone_migration_review`에 기록만 하고 클럽 관리자 수동 리뷰에 위임 |
| `joinClubAsRegistered`, `respondJoinRequest`, `updateProfile` 매칭/저장 경로 업데이트 | `associations.president_phone`, `secretary_phone` (0건, 사용 안 함) |
| `profiles.phone` 평문 13건 재암호화 + `club_members` 오암호화 1건 복호화 | `tournament_entries` UNIQUE 제약 (팀원 단체전 다중 등록 허용 필요) |
| **네이버 콜백 `profiles.phone` 평문 저장 버그 수정** | 전화번호 국제화 (+82 지원) |
| 각 단계 SELECT 기반 dry-run 스크립트 | 과거 팀원 데이터(`team_members` JSONB) 내부 phone 필드 (별도 조사 필요) |

---

## 2. 데이터 모델

### 2.1 정규화 규칙

| 입력 | 정규화 결과 |
|---|---|
| `010-1234-5678` | `01012345678` |
| `010 1234 5678` | `01012345678` |
| `010.1234.5678` | `01012345678` |
| `01012345678` | `01012345678` |
| `+82-10-1234-5678` | `01012345678` (선행 `+82`·`82` 제거 후 `0` prefix) |
| `02-1234-5678` | `0212345678` (유선, 10자리, 별도 컬럼이므로 통과) |
| `1588-0000` | `15880000` (대표번호) |
| `null`, `''`, 공백만 | `null` |
| 길이/형식 불일치 | 원본 보존 + 로그(마이그레이션에서는 `needs_review` 플래그 테이블에 적재) |

**저장 포맷**: 숫자만 포함 (하이픈 없음). 표시 포맷은 `formatPhone()`로 렌더링 시점에 하이픈 삽입.

### 2.2 DB 변경

```sql
-- 1. club_members UNIQUE partial index (마이그레이션 완료 후 생성)
CREATE UNIQUE INDEX club_members_club_phone_unique
  ON club_members (club_id, phone)
  WHERE phone IS NOT NULL
    AND status NOT IN ('REMOVED', 'LEFT');

-- 2. phone 정규화 CHECK 제약 (숫자만, 9~11자리)
ALTER TABLE club_members
  ADD CONSTRAINT club_members_phone_format
  CHECK (phone IS NULL OR phone ~ '^[0-9]{9,11}$');

ALTER TABLE tournament_entries
  ADD CONSTRAINT tournament_entries_phone_format
  CHECK (phone IS NULL OR phone ~ '^[0-9]{9,11}$');
```

> **주의**: `profiles.phone`은 암호화 저장이므로 CHECK 제약 적용 불가. 애플리케이션 레이어에서 encrypt 전에 normalize.

### 2.3 마이그레이션 보조 테이블 (임시)

```sql
-- 정규화 실패 또는 수동 확인 필요한 행 기록
CREATE TABLE _phone_migration_review (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table TEXT NOT NULL,
  source_id UUID NOT NULL,
  original_phone TEXT,
  normalized_attempt TEXT,
  reason TEXT,
  reviewed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

마이그레이션 종료 후 수동 리뷰 완료되면 DROP.

---

## 3. 영향 범위

### 3.1 새 파일

| 파일 | 역할 |
|---|---|
| `src/lib/utils/phone.ts` | `normalizePhone`, `formatPhone`, `isValidKoreanMobile`, `comparePhone` |
| `src/lib/utils/__tests__/phone.test.ts` | 정규화 단위 테스트 (엣지 케이스 20+) |
| `supabase/migrations/2026xxxx_normalize_phone_data.sql` | 데이터 정규화 SQL 마이그레이션 |
| `supabase/migrations/2026xxxx_club_members_phone_unique.sql` | UNIQUE 제약 + CHECK 제약 추가 |
| `scripts/phone-migration-dry-run.sql` | **DRY-RUN SELECT** 스크립트 (실행 전 필수 검토) |
| `scripts/phone-migration-merge-duplicates.sql` | 기존 중복 24행 병합 스크립트 |

### 3.2 수정 파일 (Server Actions)

| 파일 | 변경 내용 |
|---|---|
| `src/lib/clubs/actions.ts` — `joinClubAsRegistered` (line 597) | `user.phone` normalize 후 매칭. `.eq('phone', normalizePhone(user.phone))` |
| 동 파일 `addUnregisteredMember` (line 576) | INSERT 전 `normalizePhone()` 적용 |
| 동 파일 `respondJoinRequest` (line 986) | 승인 직전 동일 `normalizePhone(phone)` + `is_registered=false` 좀비 레코드 감지 로직 추가. 존재 시 병합(UPDATE) 후 신규 DELETE |
| `src/lib/auth/actions.ts` — `updateProfile` (line 249) | `encryptProfile()` 호출 **전**에 `normalizePhone(data.phone)` 먼저 적용 |
| `src/lib/entries/actions.ts` — `createEntry`, `updateEntry` | `tournament_entries.phone` 저장 전 normalize |
| `src/components/clubs/ClubMemberList.tsx` + `AssociationForm`, `ClubForm` | 클라이언트 입력값 검증 시 `normalizePhone()` 결과로 비교 (이중 방어). 표시할 때는 `formatPhone()` |
| `src/app/api/auth/naver/callback/route.ts` + `.../mobile/route.ts` | **🚨 버그 수정**: `naverProfile.mobile`을 `profiles.phone`에 저장하기 전 `normalizePhone()` + `encryptProfile()` 적용. 현재 평문으로 저장되어 13건 발생 |

### 3.3 매칭/역매칭 로직 강화

**`joinClubAsRegistered` (수정안)**:

```ts
const normalized = normalizePhone(user.phone)
if (normalized) {
  const { data: existingList } = await admin
    .from('club_members')
    .select('id, is_registered, user_id, introduction, status')
    .eq('club_id', clubId)
    .eq('phone', normalized)
    .neq('status', 'REMOVED')
    .neq('status', 'LEFT')

  // 기존 레코드 분류
  const unregistered = existingList?.find(m => !m.is_registered && !m.user_id)
  const ownRegistered = existingList?.find(m => m.user_id === user.id)

  if (ownRegistered) return { error: '이미 가입된 클럽입니다.' }
  if (unregistered) {
    // UPDATE로 링크 (기존 동작 유지)
  }
}
```

- `maybeSingle()` 크래시 방지: 여러 건이면 첫 번째 `is_registered=false` 레코드 우선 매칭
- 자기 자신 중복 가입 시도 조기 차단

**`respondJoinRequest` (수정안)**:

```ts
if (approve) {
  // 해당 phone으로 동일 클럽에 잔존하는 is_registered=false 좀비 레코드 확인
  const { data: zombie } = await admin
    .from('club_members')
    .select('id')
    .eq('club_id', member.club_id)
    .eq('phone', member.phone)
    .eq('is_registered', false)
    .is('user_id', null)
    .neq('id', member.id)
    .maybeSingle()
  
  if (zombie) {
    // 기존 zombie 삭제 (metadata 이관 후)
    await admin.from('club_members').delete().eq('id', zombie.id)
  }
  
  // 기존 ACTIVE 처리 로직
}
```

---

## 4. 마이그레이션 전략 (핵심)

**원칙: 데이터 정리는 되돌리기 어렵다. 모든 단계는 DRY-RUN SELECT → 백업 → 실행 → 검증 순서로 진행한다.**

### Phase A — 읽기 전용 조사 (0 risk)

1. `scripts/phone-migration-dry-run.sql` 작성
   - 각 테이블에서 정규화 후 포맷별 COUNT
   - 중복 그룹 전체 목록 (club_id, phone_norm, 중복 행 전체 id + name + is_registered + status)
   - `profiles.phone` 평문 13건 리스트 (재암호화 대상)
   - `club_members` 암호화 오저장 1건 리스트
   - `team_members` JSONB 내부 phone 필드 존재 여부 조사 (`tournament_entries` 테이블)
2. 리뷰 결과를 별도 md 문서로 저장 (`docs/03-analysis/phone-audit.md`)
3. **담당자 confirm 후** Phase B 착수

### Phase B — 애플리케이션 레벨 정규화 유틸 + 입력 경로 배포 (기존 데이터 무변경)

1. `src/lib/utils/phone.ts` 구현 + 단위 테스트 (커버리지 100%)
2. Server Actions 5곳에 `normalizePhone()` 적용 (insert/update 시점)
3. 빌드/배포 → **이 시점부터 신규 insert/update는 정규화된 포맷으로만 저장됨**
4. 기존 데이터는 아직 섞인 상태. 단, `joinClubAsRegistered` 매칭은 **정규화된 user.phone**과 **미정규화된 DB phone**을 비교하므로 **여전히 실패한다**.
5. 따라서 이 시점에 `joinClubAsRegistered`의 매칭 쿼리는 양쪽 정규화 버전으로 `.or()` 처리하는 **과도기 호환 로직** 포함:
   ```ts
   .or(`phone.eq.${normalized},phone.eq.${user.phone}`)
   ```
6. 배포 후 1~2일 모니터링

### Phase C — 백업 (필수)

```sql
-- Supabase Dashboard에서 전체 DB snapshot 생성 or
pg_dump > backup_2026xxxx.sql
```

최소 3개 테이블 개별 스냅샷:
```sql
CREATE TABLE _backup_club_members_20260410 AS SELECT * FROM club_members;
CREATE TABLE _backup_tournament_entries_20260410 AS SELECT * FROM tournament_entries;
CREATE TABLE _backup_profiles_20260410 AS SELECT * FROM profiles;
```

### Phase D — 기존 데이터 일괄 정규화 (마이그레이션)

1. **`_phone_migration_review` 보조 테이블 생성**
2. **club_members 정규화** (트랜잭션 내):
   ```sql
   -- 1) 암호화 오저장 1건 로그 후 NULL 처리 (수동 복호화 후 재저장)
   INSERT INTO _phone_migration_review (source_table, source_id, original_phone, reason)
   SELECT 'club_members', id, phone, 'encrypted_misstored'
   FROM club_members WHERE phone ~ '^[a-f0-9]{20,}:';
   
   UPDATE club_members SET phone = NULL WHERE phone ~ '^[a-f0-9]{20,}:';
   
   -- 2) 나머지 정규화
   UPDATE club_members
   SET phone = regexp_replace(phone, '[^0-9]', '', 'g')
   WHERE phone IS NOT NULL AND phone !~ '^[0-9]{9,11}$';
   ```
3. **tournament_entries 정규화**: 동일 패턴
4. **profiles.phone 평문 13건 재암호화**: 애플리케이션 스크립트로 처리 (SQL에서 encrypt 불가). 별도 Node script `scripts/reencrypt-profile-phones.ts`
5. 각 UPDATE 직후 영향 행 수와 정규화 실패 건수를 `_phone_migration_review`에 기록
6. **Phase B에서 도입한 과도기 `.or()` 쿼리 롤백** (정규화 완료 후 불필요)

### Phase E — 기존 중복 병합 (최고 위험도, 범위 축소)

**처리 범위 명확화**:

| 그룹 | 건수 | 처리 방침 |
|---|---|---|
| **A — 동일 이름 + 동일 phone + 동일 club** | 13 그룹 / 정리 14행 | ✅ **자동 병합 대상**. 본 Phase E에서 스크립트로 처리 |
| **B — 시스템 owner(허정학) 관련 이력** | 0건 | ❌ **대상 외**. REMOVED/LEFT 이력만 남아 있어 ACTIVE 기준 중복 없음. UNIQUE partial index가 REMOVED/LEFT를 제외하므로 제약 위반 없음. Phase D의 정규화 UPDATE 대상일 뿐 (포맷 변환만). |
| **C — 서로 다른 이름 + 동일 phone (2 그룹 4행)** | 2 그룹 / 잉여 2행 | ⚠️ **자동 병합 금지**. 데이터 오염 가능성(관리자 오타 / 가족 공용 폰 / 번호 재사용) 때문에 사람이 판단해야 함. `_phone_migration_review`에 `reason='different_names_same_phone'`으로 기록하고 클럽 관리자에게 알림 발송. 제약 추가(Phase F) 시 이 2 그룹은 **수동 정리 완료 전까지 UNIQUE 위반을 일으키므로 Phase F 이전에 수동 확인이 반드시 선행**되어야 함. |

**그룹 A 자동 병합 원칙** (survivor 선정 우선순위):

| 우선순위 | 유지할 레코드 |
|---|---|
| 1 | `is_registered=true` + `user_id NOT NULL` + `status='ACTIVE'` |
| 2 | `is_registered=true` + `user_id NOT NULL` + `status='PENDING'` |
| 3 | `is_registered=false` 중 `introduction` 가장 풍부한 행 |
| 4 | 가장 오래된 `created_at` |

그룹 A 병합 전 반드시 SELECT로 참조 관계 확인:

```sql
-- 삭제 예정 member_id가 다른 테이블에서 참조되는지
SELECT 'club_session_attendances' AS tbl, COUNT(*) FROM club_session_attendances WHERE club_member_id IN (...);
SELECT 'club_member_invitations' AS tbl, COUNT(*) FROM club_member_invitations WHERE ...;
-- 기타 FK
```

참조 있으면 FK UPDATE로 surviving 레코드로 재연결 후 DELETE.

**그룹 A 자동 병합 스크립트도 한 번에 전부가 아닌 클럽 단위로 수동 confirm** (cf19b05a 클럽에 11 그룹이 집중되어 있어 이 클럽부터 우선 처리).

**그룹 C 처리 (스킵)**:

```sql
-- 그룹 C 식별해서 리뷰 테이블에 기록
INSERT INTO _phone_migration_review (source_table, source_id, original_phone, normalized_attempt, reason)
SELECT 'club_members', id, phone, regexp_replace(phone, '[^0-9]', '', 'g'),
       'different_names_same_phone: ' || name
FROM club_members
WHERE (club_id, regexp_replace(phone, '[^0-9]', '', 'g')) IN (
  -- 다른 이름을 가진 중복 그룹
  WITH normalized AS (
    SELECT club_id, phone, name,
           regexp_replace(phone, '[^0-9]', '', 'g') AS phone_norm
    FROM club_members
    WHERE phone IS NOT NULL AND phone !~ '^[a-f0-9]{20,}:'
      AND status NOT IN ('REMOVED','LEFT')
  )
  SELECT club_id, phone_norm
  FROM normalized
  GROUP BY club_id, phone_norm
  HAVING COUNT(*) > 1 AND COUNT(DISTINCT TRIM(name)) > 1
);
```

리뷰 결과가 나올 때까지 **해당 그룹 C 2 그룹은 Phase F의 UNIQUE 제약 생성 전에 반드시 수동 정리 또는 `phone` NULL 처리 필요** (그렇지 않으면 UNIQUE index 생성 자체가 실패).

### Phase F — DB 제약 추가

**선행 조건 체크리스트** (모두 통과해야 Phase F 진행):

```sql
-- 1) CHECK 위반 예상 행 0건인지
SELECT COUNT(*) FROM club_members WHERE phone IS NOT NULL AND phone !~ '^[0-9]{9,11}$';
-- → 0 이어야 함

SELECT COUNT(*) FROM tournament_entries WHERE phone IS NOT NULL AND phone !~ '^[0-9]{9,11}$';
-- → 0 이어야 함

-- 2) UNIQUE 위반 예상 행 0건인지 (그룹 A 병합 완료 + 그룹 C 수동 정리 완료)
WITH normalized AS (
  SELECT club_id, phone FROM club_members
  WHERE phone IS NOT NULL AND status NOT IN ('REMOVED','LEFT')
)
SELECT club_id, phone, COUNT(*) FROM normalized
GROUP BY club_id, phone HAVING COUNT(*) > 1;
-- → 0 행이어야 함. 그룹 C 2건이 남아있으면 이 쿼리에 나타나므로 먼저 해결해야 함.
```

모두 통과하면:

```sql
ALTER TABLE club_members ADD CONSTRAINT club_members_phone_format
  CHECK (phone IS NULL OR phone ~ '^[0-9]{9,11}$');

ALTER TABLE tournament_entries ADD CONSTRAINT tournament_entries_phone_format
  CHECK (phone IS NULL OR phone ~ '^[0-9]{9,11}$');

CREATE UNIQUE INDEX club_members_club_phone_unique
  ON club_members (club_id, phone)
  WHERE phone IS NOT NULL AND status NOT IN ('REMOVED','LEFT');
```

제약 추가 실패 시 즉시 어떤 행이 걸리는지 조사 → 원인 해결 → 재시도.

### Phase G — 검증 + 백업 테이블 제거

1. Phase A의 DRY-RUN 스크립트를 다시 실행해 전체 통계 재집계
2. 아래 전부 0이어야 성공:
   - 하이픈 포함 phone 건수
   - 11자리 미만 비 NULL 건수 (유선 제외)
   - `(club_id, phone)` 중복 건수
   - `profiles.phone` 평문 건수
3. 1주 모니터링 후 `_backup_*` 테이블 DROP
4. `_phone_migration_review` 테이블 수동 리뷰 완료 후 DROP

---

## 5. 동작 흐름

### 5.1 사용자 가입 하기 (정규화 이후)

```
1. 프로필 phone 입력: 사용자가 "010-1234-5678" 또는 "01012345678" 자유 입력
2. updateProfile() → normalizePhone() → "01012345678" → encrypt → profiles.phone
3. 사용자 /clubs/{id} 방문 → "가입하기" 클릭
4. joinClubAsRegistered(clubId):
   - getCurrentUser() → decrypt → user.phone = "01012345678"
   - normalizePhone() → "01012345678" (no-op)
   - SELECT club_members WHERE club_id=? AND phone='01012345678' AND is_registered=false
   - 난테모 사전 등록 레코드 HIT → UPDATE (user_id=user.id, is_registered=true, status=PENDING)
5. 관리자 respondJoinRequest(memberId, true):
   - 잔존 좀비 레코드 없음 (이미 Phase E에서 병합됨)
   - status: PENDING → ACTIVE
```

### 5.2 실패 경로 (방어 레벨별)

| 레이어 | 방어 내용 | 위반 시 결과 |
|---|---|---|
| 1. UI (form) | `normalizePhone()` 미리보기 + `isValidKoreanMobile()` 검증 | 제출 차단 |
| 2. Server Action | INSERT/UPDATE 전 `normalizePhone()` 재적용 | 악의적 포맷 저장 방지 |
| 3. DB CHECK | `phone ~ '^[0-9]{9,11}$'` | 드라이버/다른 경로 INSERT도 차단 |
| 4. DB UNIQUE | `(club_id, phone)` partial index | 동일 클럽 중복 삽입 실패 |
| 5. 애플리케이션 중복 감지 | `joinClubAsRegistered` / `respondJoinRequest` 역매칭 | UNIQUE 위반 전에 병합 경로로 우회 |

---

## 6. 테스트 전략

### 6.1 단위 테스트 (`phone.test.ts`)

- `normalizePhone` 입력 20+ 케이스 (하이픈, 공백, 점, +82, null, 숫자+문자 혼합, 빈 문자열, 특수문자)
- `formatPhone` 역변환
- `isValidKoreanMobile` 경계값 (9자리/10자리/11자리/12자리)
- `comparePhone(a, b)` — 다양한 포맷 간 동등성

### 6.2 통합 테스트 (수동 + DB 쿼리)

| 시나리오 | 기대 결과 |
|---|---|
| 난테모 회원 "신정민"이 신규 가입 (`010-4597-9592` 프로필 입력) | 기존 레코드에 링크, 중복 없음 |
| 같은 신정민이 프로필에 `01045979592`로 입력 | 매칭 성공 (정규화 결과 동일) |
| 완전 신규 phone으로 가입 | 신규 INSERT |
| 관리자가 이미 등록된 phone으로 `addUnregisteredMember` 시도 | UNIQUE 제약 위반, 에러 메시지로 사전 안내 |
| 가입 신청 후 관리자 승인 | 좀비 레코드 없음 확인 |
| `tournament_entries` 신규 생성 시 phone 자동 정규화 | DB에 `01012345678` 저장 |

### 6.3 마이그레이션 dry-run 검증

각 Phase 실행 전:

```sql
-- BEFORE COUNT
SELECT COUNT(*) FROM club_members WHERE phone IS NOT NULL;

-- 예상 변경 건수 미리보기
SELECT COUNT(*) FROM club_members 
WHERE phone IS NOT NULL AND phone !~ '^[0-9]{9,11}$';
-- → 22 (20 + 1 공백 + 1 암호화)

-- 실제 UPDATE → 같은 수만큼 영향받아야 함
```

---

## 7. 롤백 계획

| 단계 | 롤백 방법 |
|---|---|
| Phase B (유틸 배포) | Revert commit. 기존 `.eq('phone', user.phone)` 복원 |
| Phase D (데이터 정규화) | `_backup_*` 테이블에서 UPDATE 되돌리기. 영향 범위 확인 후 트랜잭션 rollback이 불가능한 시점 이후에는 백업 복원이 유일 |
| Phase E (중복 병합) | 각 DELETE 전에 surviving 행에 metadata 병합 → surviving의 phone/name/introduction으로 역매핑 불가. **이 단계는 백업 복원 외 롤백 없음.** 그래서 클럽 단위 수동 confirm 방식이 안전. |
| Phase F (제약 추가) | `ALTER TABLE ... DROP CONSTRAINT`, `DROP INDEX` |

---

## 8. 리스크 및 완화

| 리스크 | 영향 | 완화 |
|---|---|---|
| Phase E 병합 시 잘못된 레코드 삭제 | 높음 (데이터 유실) | 백업 + 클럽 단위 수동 confirm + 참조 FK 사전 점검 |
| Phase D 정규화 중 포맷 이상 행 예외 처리 누락 | 중간 | `_phone_migration_review` 테이블에 로그 + 정규화 실패 시 NULL로 fallback |
| `profiles.phone` 암호화 재적용 실패 | 중간 (사용자 로그인/검색 영향) | 애플리케이션 레벨 스크립트, 한 행씩 트랜잭션, 실패 시 즉시 중단 |
| 과도기 `.or()` 쿼리가 예상치 못한 매칭 일으킴 | 중간 | Phase B 전후 로그 모니터링, 1~2일 이내 Phase D 이행 |
| 운영 중 사용자가 phone 변경 → 중복 생성 | 낮음 | `updateProfile`에 `(user_id, club_members)` 일괄 업데이트 훅 추가 (향후) |
| UNIQUE 제약 추가 시점에 잔존 중복 존재 | 중간 | 제약 추가 직전 위반 행 SELECT로 재확인 후 생성 |

---

## 9. 오픈 이슈 / 의사결정 필요

1. **저장 포맷**: 숫자 11자리(`01012345678`) vs 표준 하이픈(`010-1234-5678`) — 본 Plan은 **숫자 11자리** 전제. 다른 선택 시 Phase D SQL 조정 필요.
2. **team_members JSONB 내부 phone 필드**: `tournament_entries.team_members`에 phone 필드가 있다면 추가 마이그레이션 범위. Phase A 조사 시 확정.
3. **`clubs.contact_phone`, `coaches.phone` 포함 여부**: 본 Plan에서는 제외. 필요 시 후속 feature로 분리.
4. **`_phone_migration_review` 보관 기간**: 1개월 후 DROP vs 영구 보관.
5. **국제화**: `+82` 국가코드가 들어온 값이 하나라도 있는지 Phase A에서 확인. 없으면 본 Plan 그대로, 있으면 정규화 규칙 확장.
6. **그룹 C 2 그룹 수동 정리 주체**: 해당 클럽 오너에게 알림으로 확인 요청할지, SUPER_ADMIN이 직접 SELECT 결과를 보고 처리할지. 본 Plan은 **SUPER_ADMIN 직접 처리** 전제 (알림 구현은 후속 과제).

---

## 10. 다음 단계

1. **본 Plan 검토 및 승인**
2. `/pdca design phone-normalization-cleanup` 실행 → Design 문서에서 상세 SQL + Node script 구체화
3. Phase A 스크립트 작성 및 실행 (0 risk, 즉시 가능)
4. 조사 결과를 바탕으로 Design 문서 및 오픈 이슈 확정
5. Phase B 구현 착수
