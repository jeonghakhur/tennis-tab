-- ============================================================================
-- Phase A: 전화번호 정규화 영향도 DRY-RUN 조사
--
-- 목적: 마이그레이션 실행 전 전체 영향도 파악 (읽기 전용, 쓰기 없음)
-- 실행: Supabase SQL Editor 또는 psql에서 블록별로 실행
-- 결과: docs/03-analysis/phone-audit.md에 저장
--
-- 관련 문서:
--   - Plan: docs/01-plan/features/phone-normalization-cleanup.plan.md
--   - Design: docs/02-design/features/phone-normalization-cleanup.design.md
-- ============================================================================

-- ─── A.1) phone 컬럼 보유 테이블별 카운트 ──────────────────────────────────
SELECT 'profiles' AS tbl, COUNT(*) AS total, COUNT(phone) AS with_phone FROM profiles
UNION ALL SELECT 'club_members', COUNT(*), COUNT(phone) FROM club_members
UNION ALL SELECT 'tournament_entries', COUNT(*), COUNT(phone) FROM tournament_entries
UNION ALL SELECT 'coaches', COUNT(*), COUNT(phone) FROM coaches
UNION ALL SELECT 'clubs', COUNT(*), COUNT(contact_phone) FROM clubs
UNION ALL SELECT 'lesson_bookings', COUNT(*), COUNT(guest_phone) FROM lesson_bookings
UNION ALL SELECT 'lesson_inquiries', COUNT(*), COUNT(phone) FROM lesson_inquiries
UNION ALL SELECT 'associations(pres)', COUNT(*), COUNT(president_phone) FROM associations
UNION ALL SELECT 'associations(sec)', COUNT(*), COUNT(secretary_phone) FROM associations;


-- ─── A.2) club_members 포맷 분포 ──────────────────────────────────────────
SELECT
  CASE
    WHEN phone IS NULL THEN 'NULL'
    WHEN phone ~ '^[0-9]{11}$' THEN '숫자 11자리 (정규화 완료)'
    WHEN phone ~ '^[0-9]{10}$' THEN '숫자 10자리 (유선?)'
    WHEN phone ~ '^010-[0-9]{4}-[0-9]{4}$' THEN '010-XXXX-XXXX'
    WHEN phone ~ '^010\s[0-9]{4}\s[0-9]{4}$' THEN '010 XXXX XXXX (공백)'
    WHEN phone ~ '^[0-9]{2,3}-[0-9]{3,4}-[0-9]{4}$' THEN '지역번호-XXXX-XXXX'
    WHEN phone ~ '^[a-f0-9]{20,}:' THEN '암호화 오저장'
    WHEN phone LIKE '+82%' THEN '국제포맷 +82'
    ELSE '기타'
  END AS format_pattern,
  COUNT(*) AS cnt
FROM club_members
GROUP BY 1
ORDER BY cnt DESC;


-- ─── A.3) tournament_entries 포맷 분포 ────────────────────────────────────
SELECT
  CASE
    WHEN phone IS NULL THEN 'NULL'
    WHEN phone ~ '^[0-9]{11}$' THEN '숫자 11자리'
    WHEN phone ~ '^010-[0-9]{4}-[0-9]{4}$' THEN '010-XXXX-XXXX'
    WHEN phone ~ '^010\s[0-9]{4}\s[0-9]{4}$' THEN '010 XXXX XXXX'
    WHEN phone ~ '^[a-f0-9]{20,}:' THEN '암호화 오저장'
    WHEN phone LIKE '+82%' THEN '국제포맷 +82'
    ELSE '기타'
  END AS format_pattern,
  COUNT(*) AS cnt
FROM tournament_entries
GROUP BY 1
ORDER BY cnt DESC;


-- ─── A.4) profiles 평문 대상 식별 (암호화 정책 위반) ──────────────────────
SELECT id, name, email, phone, created_at
FROM profiles
WHERE phone IS NOT NULL
  AND phone !~ '^[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$'
ORDER BY created_at DESC;


-- ─── A.5) club_members 암호화 오저장 식별 ─────────────────────────────────
SELECT id, club_id, name, phone, length(phone) AS len
FROM club_members
WHERE phone ~ '^[a-f0-9]{20,}:';


-- ─── A.6) 중복 그룹 A/C 식별 (REMOVED/LEFT 제외) ──────────────────────────
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
    array_agg(DISTINCT name_norm ORDER BY name_norm) AS names
  FROM normalized
  GROUP BY club_id, phone_norm
  HAVING COUNT(*) > 1
)
SELECT
  CASE WHEN distinct_names = 1 THEN 'A (동일인)' ELSE 'C (다른 이름)' END AS group_type,
  club_id, phone_norm, total, names
FROM groups
ORDER BY group_type, total DESC;


-- ─── A.7) tournament_entries.team_members JSONB 내부 phone 필드 ──────────
SELECT COUNT(*) AS team_entries_with_phone_field
FROM tournament_entries
WHERE team_members IS NOT NULL
  AND jsonb_typeof(team_members) = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(team_members) AS m
    WHERE m ? 'phone'
  );

-- A.7.b) partner_data JSONB 내부 phone 필드도 함께 확인
SELECT COUNT(*) AS entries_with_partner_phone_field
FROM tournament_entries
WHERE partner_data IS NOT NULL
  AND partner_data ? 'phone';


-- ─── A.8) 국제화 +82 포맷 존재 여부 ──────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM club_members WHERE phone LIKE '+82%') AS cm_plus82,
  (SELECT COUNT(*) FROM tournament_entries WHERE phone LIKE '+82%') AS te_plus82,
  (SELECT COUNT(*) FROM clubs WHERE contact_phone LIKE '+82%') AS clubs_plus82,
  (SELECT COUNT(*) FROM coaches WHERE phone LIKE '+82%') AS coaches_plus82;


-- ─── A.9) 그룹 A victim의 FK 참조 범위 사전 점검 ──────────────────────────
-- 그룹 A로 분류될 victim id 목록을 먼저 추출
WITH normalized AS (
  SELECT id, club_id, name, phone, is_registered, user_id, status, created_at,
         introduction,
         regexp_replace(phone, '[^0-9]', '', 'g') AS phone_norm,
         TRIM(name) AS name_norm
  FROM club_members
  WHERE phone IS NOT NULL
    AND phone !~ '^[a-f0-9]{20,}:'
    AND status NOT IN ('REMOVED','LEFT')
),
group_a AS (
  SELECT club_id, phone_norm, name_norm
  FROM normalized
  GROUP BY club_id, phone_norm, name_norm
  HAVING COUNT(*) > 1
),
ranked AS (
  SELECT n.id, n.club_id, n.name,
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
  COUNT(*) FILTER (WHERE rn = 1) AS survivors,
  COUNT(*) FILTER (WHERE rn > 1) AS victims_to_delete,
  array_agg(id) FILTER (WHERE rn > 1) AS victim_ids
FROM ranked;

-- A.9.b) victim_ids 배열을 활용한 FK 테이블 참조 수 (실행 시 victim_ids 치환 필요)
-- 예시 (실제로는 A.9 결과의 victim_ids로 치환):
--
-- WITH victim_ids AS (SELECT unnest(ARRAY['uuid1','uuid2',...]::uuid[]) AS id)
-- SELECT 'club_session_attendances' AS tbl, COUNT(*)
-- FROM club_session_attendances
-- WHERE club_member_id IN (SELECT id FROM victim_ids);


-- ─── A.10) club_members를 참조하는 FK 전체 목록 (사전 파악) ──────────────
SELECT
  tc.table_name AS referencing_table,
  kcu.column_name AS referencing_column,
  ccu.table_name AS referenced_table,
  ccu.column_name AS referenced_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'club_members'
ORDER BY tc.table_name, kcu.column_name;
