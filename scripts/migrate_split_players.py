"""
players 배열에 다수 선수가 있는 레코드를 1인당 1레코드로 분리

실행:
  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python3 scripts/migrate_split_players.py

legacy_id 포맷: {original_legacy_id}_{index}
재실행 안전: 이미 분리된 레코드는 players 길이가 1이므로 스킵
"""

import os
import sys


def main() -> None:
    try:
        from supabase import create_client
    except ImportError:
        print('ERROR: pip3 install supabase')
        sys.exit(1)

    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    if not url or not key:
        print('ERROR: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 환경변수 필요')
        sys.exit(1)

    sb = create_client(url, key)

    result = sb.table('tournament_awards').select('*').execute()
    multi = [r for r in result.data if len(r.get('players', [])) > 1]
    print(f'분리 대상: {len(multi)}건')

    for record in multi:
        players = record['players']
        base_legacy_id = record.get('legacy_id') or record['id']

        # 원본 삭제
        sb.table('tournament_awards').delete().eq('id', record['id']).execute()

        # 1인당 1레코드 삽입
        for i, player in enumerate(players):
            new_record = {
                k: v for k, v in record.items()
                if k not in ('id', 'created_at', 'updated_at')
            }
            new_record['players'] = [player]
            new_record['legacy_id'] = f"{base_legacy_id}_{i}"
            sb.table('tournament_awards').insert(new_record).execute()

        print(f'  분리 완료: {players} → {len(players)}건 (base: {base_legacy_id})')

    # 결과 확인
    after = sb.table('tournament_awards').select('id').execute()
    print(f'\n완료: {after.count if after.count else len(after.data)}건')


if __name__ == '__main__':
    main()
