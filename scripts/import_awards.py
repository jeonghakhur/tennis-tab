"""
레거시 Sanity → Supabase tournament_awards import 스크립트

실행:
  pip install supabase
  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python3 scripts/import_awards.py

legacy_id(UNIQUE)로 중복 upsert — 재실행해도 안전
"""

import json
import os
import sys

NDJSON_PATH = '/Users/jeonghak/Downloads/mapo_tennis-export-2026-02-23t06-52-56-253z/data.ndjson'

RANK_MAP = {
    '우승': '우승',
    '준우승': '준우승',
    '3위': '3위',
    '공동3위': '공동3위',
}


def main() -> None:
    try:
        from supabase import create_client
    except ImportError:
        print('ERROR: pip install supabase 먼저 실행하세요')
        sys.exit(1)

    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    if not url or not key:
        print('ERROR: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 환경변수를 설정하세요')
        sys.exit(1)

    supabase = create_client(url, key)

    with open(NDJSON_PATH, encoding='utf-8') as f:
        docs = [json.loads(line) for line in f]

    awards = [
        d for d in docs
        if d.get('_type') == 'award'
        and not d.get('_id', '').startswith('drafts.')
    ]
    print(f'처리 대상: {len(awards)}건')

    rows = []
    skipped = 0
    for a in awards:
        rank = RANK_MAP.get(a.get('awardCategory', ''))
        if not rank:
            print(f'  SKIP (알 수 없는 rank "{a.get("awardCategory")}"): {a.get("_id")}')
            skipped += 1
            continue

        game_type = a.get('gameType', '개인전')
        if game_type not in ('단체전', '개인전'):
            game_type = '개인전'

        rows.append({
            'competition':  a.get('competition', '').strip(),
            'year':         int(a['year']),
            'division':     a.get('division', '').strip(),
            'game_type':    game_type,
            'award_rank':   rank,
            'players':      [p.strip() for p in a.get('players', []) if p.strip()],
            'club_name':    a.get('club', '').strip() or None,
            'display_order': a.get('order', 0) or 0,
            'legacy_id':    a['_id'],
        })

    if not rows:
        print('import할 데이터가 없습니다.')
        return

    # 배치 처리 (Supabase 단건 제한 대응)
    BATCH = 100
    total_inserted = 0
    for i in range(0, len(rows), BATCH):
        batch = rows[i:i + BATCH]
        result = (
            supabase.table('tournament_awards')
            .upsert(batch, on_conflict='legacy_id')
            .execute()
        )
        total_inserted += len(result.data)
        print(f'  {i + len(batch)}/{len(rows)} 완료...')

    print(f'\nimport 완료: {total_inserted}건 (스킵: {skipped}건)')


if __name__ == '__main__':
    main()
