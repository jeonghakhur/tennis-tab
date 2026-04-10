-- ============================================================================
-- Phase F Finalize Runbook — phone-normalization-cleanup
--
-- 전체 PDCA 흐름:
--   Phase A (조사) ✅
--   Phase B (UI/Server 정규화) ✅ — 커밋 b56afec, 0fc1880
--   Phase C (백업 테이블) ✅
--   Phase D (club_members/tournament_entries 정규화 UPDATE) ✅
--   Phase E (그룹 A 14 DELETE) ✅
--   Phase F CHECK 제약 ✅
--   Phase F UNIQUE partial index ⏳ ← 본 runbook
--   Phase G 백업 정리 (1주 후)
--
-- 본 스크립트 실행 조건:
--   - SUPER_ADMIN이 그룹 C 2 그룹 4건 수동 정리 완료 (클럽 관리자 회신 반영)
--   - Phase E(14 DELETE) 완료 후 1~3일 내 실행 권장
--
-- 관련 문서:
--   - Audit:  docs/03-analysis/phone-audit.md §4.3
--   - Design: docs/02-design/features/phone-normalization-cleanup.design.md §8
--
-- 실행 방법:
--   Supabase SQL Editor에서 [STEP] 섹션별로 실행.
--   각 STEP의 검증 쿼리가 기대값을 만족하면 다음 STEP 진행.
--   검증 실패 시 BEGIN/COMMIT 사이 롤백하거나 백업에서 복원.
-- ============================================================================


-- ─── STEP 1: 그룹 C 수동 정리 (CASE BY CASE) ────────────────────────────────
-- 목적: 그룹 C 4건을 SUPER_ADMIN이 클럽 관리자로부터 회신받은 정보로 정리
--
-- 대상 회원:
--   일레븐 (cd189c36...) 01073821198:
--     - 김성은 (MALE, 1988, is_registered=true) id=5ae9194d-dbc6-4de7-9957-a8d7e98acdc2
--     - 김한빛 (FEMALE, 1993, is_registered=false) id=fafca334-4733-4f18-8d4b-bd615be1b3dd
--   효성 (95a65583...) 01094038639:
--     - 유병국 (MALE, 1980, is_registered=false) id=eccd0fe2-7256-48a9-ba56-660d84b3fe74
--     - 최윤하 (MALE, 1980, is_registered=false) id=e33890ab-9177-48c7-b3d2-72243c53a0e7
--
-- 아래 UPDATE 템플릿 중 회신 내용에 맞는 것 선택 (여러 건을 조합 가능)


-- 케이스 A: 정확한 phone으로 수정
-- 예시: 일레븐 김한빛의 실제 phone이 01087654321로 확인됨
--
-- BEGIN;
--   UPDATE club_members
--   SET phone = '01087654321',  -- ← 회신받은 정확한 번호 (숫자 11자리)
--       updated_at = now()
--   WHERE id = 'fafca334-4733-4f18-8d4b-bd615be1b3dd';
--
--   UPDATE _phone_migration_review
--   SET reviewed = true,
--       reviewer_note = '일레븐 김승국 회장 확인 — 김한빛 phone을 01087654321로 정정 (2026-04-XX)'
--   WHERE source_id = 'fafca334-4733-4f18-8d4b-bd615be1b3dd';
-- COMMIT;


-- 케이스 B: phone을 NULL로 (번호를 알 수 없거나 회원이 비활성 상태)
--
-- BEGIN;
--   UPDATE club_members
--   SET phone = NULL, updated_at = now()
--   WHERE id = 'VICTIM_UUID_여기에_붙여넣기';
--
--   UPDATE _phone_migration_review
--   SET reviewed = true,
--       reviewer_note = '관리자가 연락처 미확인 — NULL 처리 (2026-04-XX)'
--   WHERE source_id = 'VICTIM_UUID_여기에_붙여넣기';
-- COMMIT;


-- 케이스 C: 회원 자체를 REMOVED로 (이미 탈퇴했거나 오등록)
--
-- BEGIN;
--   UPDATE club_members
--   SET status = 'REMOVED',
--       status_reason = 'phone 중복 확인 중 오등록 확인됨',
--       updated_at = now()
--   WHERE id = 'VICTIM_UUID_여기에_붙여넣기';
--
--   UPDATE _phone_migration_review
--   SET reviewed = true,
--       reviewer_note = '관리자 확인 후 오등록으로 판단 — REMOVED 처리 (2026-04-XX)'
--   WHERE source_id = 'VICTIM_UUID_여기에_붙여넣기';
-- COMMIT;


-- STEP 1 검증: 아직 리뷰 안 된 그룹 C 항목 확인
SELECT COUNT(*) AS pending_reviews
FROM _phone_migration_review
WHERE reason LIKE 'different_names_same_phone%'
  AND NOT reviewed;
-- 기대값: 0 (전부 reviewed=true)


-- ─── STEP 2: UNIQUE 제약 선행 조건 재검증 ────────────────────────────────
-- 각 쿼리 모두 0이어야 Step 3 진행 가능

-- 2.1) club_members 포맷 위반 0건
SELECT COUNT(*) AS format_violations
FROM club_members
WHERE phone IS NOT NULL AND phone !~ '^[0-9]{9,11}$';
-- 기대값: 0

-- 2.2) tournament_entries 포맷 위반 0건
SELECT COUNT(*) AS te_format_violations
FROM tournament_entries
WHERE phone IS NOT NULL AND phone !~ '^[0-9]{9,11}$';
-- 기대값: 0

-- 2.3) club_members (club_id, phone) 중복 0건 (REMOVED/LEFT 제외)
WITH n AS (
  SELECT club_id, phone FROM club_members
  WHERE phone IS NOT NULL AND status NOT IN ('REMOVED','LEFT')
)
SELECT club_id, phone, COUNT(*) AS cnt
FROM n
GROUP BY club_id, phone
HAVING COUNT(*) > 1;
-- 기대값: 0행 (그룹 C가 해결되지 않으면 2행 반환됨)

-- 2.4) profiles 평문 0건
SELECT COUNT(*) AS profiles_plaintext
FROM profiles
WHERE phone IS NOT NULL
  AND phone !~ '^[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$';
-- 기대값: 0

-- 2.5) 암호화 오저장 club_members 0건
SELECT COUNT(*) AS cm_encrypted_misstored
FROM club_members
WHERE phone ~ '^[a-f0-9]{20,}:';
-- 기대값: 0


-- ─── STEP 3: UNIQUE partial index 생성 (Phase F 마무리) ─────────────────────
-- STEP 2의 모든 쿼리가 0이어야 실행
-- 트랜잭션 내에서 실행 권장 (위반 발견 시 ROLLBACK)

BEGIN;

CREATE UNIQUE INDEX club_members_club_phone_unique
  ON club_members (club_id, phone)
  WHERE phone IS NOT NULL
    AND status NOT IN ('REMOVED', 'LEFT');

-- 인덱스 생성 확인
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'club_members'
  AND indexname = 'club_members_club_phone_unique';
-- 기대값: 1행

COMMIT;


-- ─── STEP 4: 제약 전체 상태 확인 ─────────────────────────────────────────
SELECT
  t.relname AS table_name,
  c.conname AS constraint_name,
  pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
WHERE t.relname IN ('club_members', 'tournament_entries')
  AND c.conname LIKE '%phone%'
ORDER BY t.relname, c.conname;
-- 기대값:
--   club_members_phone_format       CHECK (phone IS NULL OR phone ~ '^[0-9]{9,11}$')
--   tournament_entries_phone_format CHECK (phone IS NULL OR phone ~ '^[0-9]{9,11}$')


-- ─── STEP 5: 최종 통계 ──────────────────────────────────────────────────
SELECT 'profiles' AS tbl,
  COUNT(*) FILTER (WHERE phone IS NULL) AS null_cnt,
  COUNT(*) FILTER (WHERE phone ~ '^[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$') AS encrypted,
  COUNT(*) FILTER (WHERE phone IS NOT NULL AND phone !~ '^[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$') AS plaintext
FROM profiles
UNION ALL
SELECT 'club_members',
  COUNT(*) FILTER (WHERE phone IS NULL),
  COUNT(*) FILTER (WHERE phone ~ '^[0-9]{11}$'),  -- 11자리 표시
  COUNT(*) FILTER (WHERE phone IS NOT NULL AND phone !~ '^[0-9]{9,11}$')
FROM club_members
UNION ALL
SELECT 'tournament_entries',
  COUNT(*) FILTER (WHERE phone IS NULL),
  COUNT(*) FILTER (WHERE phone ~ '^[0-9]{11}$'),
  COUNT(*) FILTER (WHERE phone IS NOT NULL AND phone !~ '^[0-9]{9,11}$')
FROM tournament_entries;


-- ─── STEP 6: 과도기 .or() 쿼리 제거 알림 ──────────────────────────────────
-- Phase F UNIQUE index 생성 완료 후, 애플리케이션 코드에서 과도기 매칭 쿼리를
-- 단순 .eq(phone) 형태로 교체하는 PR을 생성한다.
--
-- 대상 파일 및 변경 내용:
--   src/lib/clubs/actions.ts
--     - joinClubAsRegistered L660~:
--         .or(`phone.eq.${normalizedUserPhone},phone.eq.${hyphenFormatted}`)
--         ↓
--         .eq('phone', normalizedUserPhone)
--     - respondJoinRequest L1057~:
--         동일한 .or() 블록 단순화
--
-- PR 생성 명령 (예시):
--   git checkout -b chore/phone-phase-f-cleanup
--   # 에디터로 두 위치 수정
--   git commit -m "chore: Phase F 완료 후 joinClubAsRegistered/respondJoinRequest 과도기 .or() 제거"
--   git push -u origin chore/phone-phase-f-cleanup
--   gh pr create --title "chore: Phase B 과도기 쿼리 제거" ...


-- ─── STEP 7: Phase G — 백업 테이블 정리 (1주일 모니터링 후 실행) ──────────
-- ⚠️ 본 섹션은 Phase F 완료 후 최소 1주일 운영 모니터링이 끝난 뒤 실행한다.
-- 그 사이 문제가 발견되면 _backup_* 테이블에서 복원 가능.

-- 7.1) 리뷰 테이블 전부 처리되었는지 최종 확인
-- SELECT COUNT(*) FROM _phone_migration_review WHERE NOT reviewed;
-- 기대값: 0

-- 7.2) 백업 테이블 일괄 DROP
-- DROP TABLE IF EXISTS _backup_club_members_20260410;
-- DROP TABLE IF EXISTS _backup_tournament_entries_20260410;
-- DROP TABLE IF EXISTS _backup_profiles_reencrypt_20260410;
-- DROP TABLE IF EXISTS _backup_club_members_phase_e_20260410;

-- 7.3) 리뷰 테이블 DROP (모든 항목이 reviewed=true 확인 후)
-- DROP TABLE IF EXISTS _phone_migration_review;

-- 7.4) Phase G 완료 통계
-- SELECT tablename FROM pg_tables
--   WHERE schemaname = 'public'
--     AND (tablename LIKE '_backup_%' OR tablename = '_phone_migration_review');
-- 기대값: 0행


-- ─── 끝 ────────────────────────────────────────────────────────────────────
-- 본 runbook 실행 완료 후:
--   1. phone-audit.md 11 체크리스트의 남은 항목 체크
--   2. design.md 0 설계 요약 상태를 "Done" 또는 "Phase F 완료"로 업데이트
--   3. `/pdca report phone-normalization-cleanup` 실행으로 완료 보고서 생성
-- ============================================================================
