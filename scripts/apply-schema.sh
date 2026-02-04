#!/usr/bin/env bash
# 00_initial_schema.sql 기준으로 Supabase 원격 DB 스키마 초기화 후 적용
# ⚠️ public 스키마의 모든 테이블·데이터가 삭제됩니다.
#
# 사용법:
#   export SUPABASE_DB_PASSWORD='your-database-password'
#   ./scripts/apply-schema.sh
# 또는:
#   export SUPABASE_DB_URL='postgresql://postgres:password@db.xxx.supabase.co:5432/postgres'
#   ./scripts/apply-schema.sh

set -e
cd "$(dirname "$0")/.."

if [ -f .env.local ]; then
  NEXT_PUBLIC_SUPABASE_URL=$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | cut -d= -f2- | tr -d '"' | tr -d "'")
fi

if [ -z "$SUPABASE_DB_URL" ]; then
  REF="${NEXT_PUBLIC_SUPABASE_URL#https://}"
  REF="${REF%%.supabase.co}"
  if [ -z "$SUPABASE_DB_PASSWORD" ]; then
    echo "Error: SUPABASE_DB_PASSWORD 또는 SUPABASE_DB_URL 필요"
    echo "  Supabase Dashboard > Settings > Database 에서 비밀번호 확인"
    exit 1
  fi
  SUPABASE_DB_URL="postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.${REF}.supabase.co:5432/postgres"
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql 이 없습니다. Supabase Dashboard > SQL Editor 에서"
  echo "  1) DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;"
  echo "  2) supabase/migrations/00_initial_schema.sql 내용 실행"
  exit 1
fi

echo "⚠️  public 스키마 전체가 초기화됩니다. 계속하려면 Enter, 취소는 Ctrl+C"
read -r

psql "$SUPABASE_DB_URL" -c "DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;"
psql "$SUPABASE_DB_URL" -f supabase/migrations/00_initial_schema.sql
echo "✅ 00_initial_schema.sql 적용 완료."
