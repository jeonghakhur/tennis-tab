#!/usr/bin/env bash
# Supabase 원격 DB 스키마를 supabase/migrations/schema.sql 로 덤프
# 사용법:
#   export SUPABASE_DB_PASSWORD='your-database-password'
#   ./scripts/dump-schema.sh
# 또는 DB URL 전체 지정:
#   export SUPABASE_DB_URL='postgresql://postgres:password@db.xxx.supabase.co:5432/postgres'
#   ./scripts/dump-schema.sh

set -e
cd "$(dirname "$0")/.."

# .env.local 에서 프로젝트 ref 추출 (NEXT_PUBLIC_SUPABASE_URL만 사용)
if [ -f .env.local ]; then
  NEXT_PUBLIC_SUPABASE_URL=$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | cut -d= -f2- | tr -d '"' | tr -d "'")
fi

if [ -n "$SUPABASE_DB_URL" ]; then
  echo "Using SUPABASE_DB_URL for dump..."
  supabase db dump --db-url "$SUPABASE_DB_URL" -f supabase/migrations/schema.sql
  echo "Done: supabase/migrations/schema.sql"
  exit 0
fi

REF="${NEXT_PUBLIC_SUPABASE_URL#https://}"
REF="${REF%%.supabase.co}"
REF="${REF#https://}"

if [ -z "$REF" ] || [ "$REF" = "https://your-project" ]; then
  echo "Error: NEXT_PUBLIC_SUPABASE_URL not set or invalid in .env.local"
  exit 1
fi

if [ -z "$SUPABASE_DB_PASSWORD" ]; then
  echo "Error: SUPABASE_DB_PASSWORD or SUPABASE_DB_URL required."
  echo "  Supabase Dashboard > Settings > Database 에서 Database password 확인 후:"
  echo "  export SUPABASE_DB_PASSWORD='your-password'"
  echo "  ./scripts/dump-schema.sh"
  exit 1
fi

# URL 인코딩 (비밀번호에 특수문자 있을 수 있음)
# 간단히 그대로 사용 (공백/일부 특수문자만 주의)
URL="postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.${REF}.supabase.co:5432/postgres"
echo "Dumping schema from project ref: $REF ..."
supabase db dump --db-url "$URL" -f supabase/migrations/schema.sql
echo "Done: supabase/migrations/schema.sql"
