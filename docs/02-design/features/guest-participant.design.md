# Design: 클럽 모임 게스트 참석자 기능 (Guest Participant)

## 선행 문서
- Plan: `docs/01-plan/features/guest-participant.plan.md`
- 관련 Migration: 19 (club_sessions), 20 (doubles_support), 21 (add_doubles_match_type)

---

## DB 스키마 (Migration 23)

### 신규 테이블: `club_session_guests`

```sql
CREATE TABLE club_session_guests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES club_sessions(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  gender      TEXT CHECK (gender IN ('MALE', 'FEMALE')),
  notes       TEXT,
  created_by  UUID NOT NULL REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE club_session_guests ENABLE ROW LEVEL SECURITY;

-- SELECT: 해당 세션 클럽의 ACTIVE 멤버만 조회 가능
CREATE POLICY "club_session_guests_select" ON club_session_guests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM club_sessions cs
      JOIN club_members cm ON cm.club_id = cs.club_id
      WHERE cs.id = session_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'ACTIVE'
    )
  );

-- INSERT/DELETE: 임원만 (Server Action에서 admin client 사용 → RLS bypass)
```

### 변경 테이블: `club_match_results` 컬럼 추가

```sql
ALTER TABLE club_match_results
  ADD COLUMN player1_guest_id  UUID REFERENCES club_session_guests(id) ON DELETE SET NULL,
  ADD COLUMN player2_guest_id  UUID REFERENCES club_session_guests(id) ON DELETE SET NULL,
  ADD COLUMN player1b_guest_id UUID REFERENCES club_session_guests(id) ON DELETE SET NULL,
  ADD COLUMN player2b_guest_id UUID REFERENCES club_session_guests(id) ON DELETE SET NULL;

-- 슬롯 XOR 제약: member_id와 guest_id 동시 설정 불가
ALTER TABLE club_match_results
  ADD CONSTRAINT chk_player1_exclusive
    CHECK (NOT (player1_member_id IS NOT NULL AND player1_guest_id IS NOT NULL)),
  ADD CONSTRAINT chk_player2_exclusive
    CHECK (NOT (player2_member_id IS NOT NULL AND player2_guest_id IS NOT NULL)),
  ADD CONSTRAINT chk_player1b_exclusive
    CHECK (NOT (player1b_member_id IS NOT NULL AND player1b_guest_id IS NOT NULL)),
  ADD CONSTRAINT chk_player2b_exclusive
    CHECK (NOT (player2b_member_id IS NOT NULL AND player2b_guest_id IS NOT NULL));

-- 기존 NOT NULL 제약 완화 (player1/2는 member 또는 guest 중 하나)
ALTER TABLE club_match_results
  ALTER COLUMN player1_member_id DROP NOT NULL,
  ALTER COLUMN player2_member_id DROP NOT NULL;

-- player1 슬롯 필수 보장 (member 또는 guest 중 하나는 반드시)
ALTER TABLE club_match_results
  ADD CONSTRAINT chk_player1_required
    CHECK (player1_member_id IS NOT NULL OR player1_guest_id IS NOT NULL),
  ADD CONSTRAINT chk_player2_required
    CHECK (player2_member_id IS NOT NULL OR player2_guest_id IS NOT NULL);
```

---

## 타입 정의 (`src/lib/clubs/types.ts`)

```typescript
// 신규
export interface ClubSessionGuest {
  id: string
  session_id: string
  name: string
  gender: 'MALE' | 'FEMALE' | null
  notes: string | null
  created_by: string
  created_at: string
}

// 자동 대진 풀 유니온 타입
export type SchedulePlayer =
  | {
      type: 'member'
      memberId: string
      name: string
      gender: 'MALE' | 'FEMALE' | null
      gamesPlayed: number
      availableFrom: string   // HH:MM
      availableUntil: string  // HH:MM
    }
  | {
      type: 'guest'
      guestId: string
      name: string
      gender: 'MALE' | 'FEMALE' | null
      gamesPlayed: number
      availableFrom: string   // 세션 시작 시간으로 고정
      availableUntil: string  // 세션 종료 시간으로 고정
    }

// ClubMatchResult 확장
export interface ClubMatchResult {
  // 기존 필드 유지 ...
  player1_member_id: string | null  // nullable로 변경
  player2_member_id: string | null  // nullable로 변경

  // 신규 guest 필드
  player1_guest_id?: string | null
  player2_guest_id?: string | null
  player1b_guest_id?: string | null
  player2b_guest_id?: string | null

  // JOIN 결과 (기존 member join 유지, guest join 추가)
  player1?: { id: string; name: string } | null
  player2?: { id: string; name: string } | null
  player1b?: { id: string; name: string } | null
  player2b?: { id: string; name: string } | null
  player1_guest?: { id: string; name: string } | null
  player2_guest?: { id: string; name: string } | null
  player1b_guest?: { id: string; name: string } | null
  player2b_guest?: { id: string; name: string } | null
}
```

---

## Server Actions (`src/lib/clubs/session-actions.ts`)

### 신규 함수

#### `addSessionGuest`
```typescript
export async function addSessionGuest(input: {
  sessionId: string
  name: string
  gender?: 'MALE' | 'FEMALE' | null
  notes?: string
  clubId: string
}): Promise<{ data: ClubSessionGuest | null; error: string | null }>
```
- `checkSessionOfficerAuth(clubId)` 호출
- 세션 상태 OPEN/CLOSED 만 허용 (COMPLETED 불가)
- `supabaseAdmin`으로 INSERT

#### `removeSessionGuest`
```typescript
export async function removeSessionGuest(input: {
  guestId: string
  clubId: string
}): Promise<{ error: string | null }>
```
- `checkSessionOfficerAuth(clubId)` 호출
- 해당 게스트가 참여한 경기가 COMPLETED 상태이면 삭제 불가 (에러 반환)
- `supabaseAdmin`으로 DELETE

#### `getSessionGuests`
```typescript
export async function getSessionGuests(
  sessionId: string
): Promise<ClubSessionGuest[]>
```
- 일반 supabase client 사용 (RLS SELECT 정책 적용)

### 변경 함수

#### `getClubSessionDetail`
```typescript
// 기존 반환값에 guests 추가
return {
  session,
  attendances,    // 기존
  matches,        // 기존
  guests,         // 신규: ClubSessionGuest[]
}
```

#### `createMatchResult`
```typescript
// player 슬롯 타입 변경
type PlayerSlot =
  | { memberId: string }
  | { guestId: string }

// 입력 구조 변경
input: {
  sessionId: string
  clubId: string
  matchType: MatchType
  team1: { main: PlayerSlot; partner?: PlayerSlot }
  team2: { main: PlayerSlot; partner?: PlayerSlot }
  courtNumber?: string
  scheduledTime?: string
}
```
- player1_member_id / player1_guest_id 중 하나만 설정
- 게스트 포함 경기 감지 후 `has_guest` 플래그 (내부 처리용)

#### `updateStatsAfterMatch` (내부 헬퍼)
```typescript
// 변경: guest 슬롯 건너뜀
const memberSlots = [
  match.player1_member_id,
  match.player2_member_id,
  match.player1b_member_id,
  match.player2b_member_id,
].filter(Boolean) as string[]

// winner 판정 로직 변경
const team1Captain = match.player1_member_id ?? match.player1b_member_id
const team2Captain = match.player2_member_id ?? match.player2b_member_id
const team1Won = match.winner_member_id === team1Captain
```

#### `getClubRankingsByPeriod`
```typescript
// select 쿼리에 guest join 추가
const matchSelect = `
  ...,
  player1_guest:club_session_guests!player1_guest_id(id, name),
  player2_guest:club_session_guests!player2_guest_id(id, name),
  player1b_guest:club_session_guests!player1b_guest_id(id, name),
  player2b_guest:club_session_guests!player2b_guest_id(id, name)
`

// addPlayer 호출 시 member_id가 있는 슬롯만 처리 (변경 없음)
// winner 판정: team1Captain = player1_member_id ?? player1b_member_id (변경)
```

#### `getMemberGameResults`
```typescript
// 상대/파트너 이름 표시 시 guest fallback 추가
partner: match.partner_member ?? match.partner_guest ?? null
opponent1: match.opponent1_member ?? match.opponent1_guest ?? null
opponent2: match.opponent2_member ?? match.opponent2_guest ?? null
```

#### `reportMatchResult`
```typescript
// 게스트 포함 경기 차단
const match = await getMatch(matchId)
const hasGuest = [
  match.player1_guest_id,
  match.player2_guest_id,
  match.player1b_guest_id,
  match.player2b_guest_id,
].some(Boolean)

if (hasGuest) {
  return { error: '게스트 포함 경기는 관리자만 점수를 입력할 수 있습니다.' }
}
```

#### `createAutoScheduleMatches` (주요 변경)
```typescript
// Step 1: 풀 구성 변경
const memberPlayers: SchedulePlayer[] = attendances
  .filter(a => a.status === 'ATTENDING')
  .map(a => ({
    type: 'member',
    memberId: a.club_member_id,
    name: a.member.name,
    gender: a.member.gender,
    gamesPlayed: 0,
    availableFrom: a.available_from ?? session.start_time,
    availableUntil: a.available_until ?? session.end_time,
  }))

const guestPlayers: SchedulePlayer[] = guests.map(g => ({
  type: 'guest',
  guestId: g.id,
  name: g.name,
  gender: g.gender,
  gamesPlayed: 0,
  availableFrom: session.start_time,  // 게스트는 전 시간 참가
  availableUntil: session.end_time,
}))

const pool: SchedulePlayer[] = [...memberPlayers, ...guestPlayers]

// Step 2: 슬롯 배정 시 member/guest 구분
function buildMatchInsert(p1: SchedulePlayer, p1b: SchedulePlayer, p2: SchedulePlayer, p2b: SchedulePlayer) {
  return {
    player1_member_id: p1.type === 'member' ? p1.memberId : null,
    player1_guest_id: p1.type === 'guest' ? p1.guestId : null,
    player1b_member_id: p1b.type === 'member' ? p1b.memberId : null,
    player1b_guest_id: p1b.type === 'guest' ? p1b.guestId : null,
    player2_member_id: p2.type === 'member' ? p2.memberId : null,
    player2_guest_id: p2.type === 'guest' ? p2.guestId : null,
    player2b_member_id: p2b.type === 'member' ? p2b.memberId : null,
    player2b_guest_id: p2b.type === 'guest' ? p2b.guestId : null,
    winner_member_id: null,
  }
}

// Step 3: winner_member_id 세팅 시 member 슬롯 우선
// (adminOverrideMatchResult에서 winner 설정 시 동일 로직 적용)
```

---

## UI 컴포넌트 변경

### 1. `AttendanceList.tsx` — 게스트 섹션 추가

```tsx
// 임원 전용: 게스트 섹션
{isOfficer && (
  <section>
    <h3>게스트 ({guests.length}명)</h3>
    {guests.map(g => (
      <div key={g.id} className="flex items-center justify-between">
        <div>
          <Badge variant="secondary">게스트</Badge>
          <span>{g.name}</span>
          {g.gender && <span className="text-xs">{g.gender === 'MALE' ? '남' : '여'}</span>}
        </div>
        <button onClick={() => handleRemoveGuest(g.id)}>삭제</button>
      </div>
    ))}
    <GuestAddForm onAdd={handleAddGuest} />
  </section>
)}
```

게스트 추가 인라인 폼:
```tsx
// GuestAddForm (AttendanceList 내부 or 별도 컴포넌트)
// 필드: 이름(text, 필수), 성별(radio: 남/여/미선택), 메모(text, 선택)
// 제출 → addSessionGuest() → onAdd() 콜백
```

### 2. `MatchBoard.tsx` — 게스트 이름 표시

```tsx
// 헬퍼: 슬롯에서 표시 이름 추출
function getPlayerName(
  member: { name: string } | null | undefined,
  guest: { name: string } | null | undefined
): string {
  return member?.name ?? guest?.name ?? '?'
}

// 게스트 포함 시 배지 표시
const hasGuest = [match.player1_guest_id, match.player2_guest_id,
                  match.player1b_guest_id, match.player2b_guest_id].some(Boolean)

{hasGuest && <Badge variant="info" className="text-[10px]">게스트</Badge>}
```

### 3. `MatchResultForm.tsx` — 게스트 경기 권한 처리

```tsx
// 게스트 포함 경기: 선수 모드 숨김 (임원 모드만)
const hasGuest = [match.player1_guest_id, match.player2_guest_id,
                  match.player1b_guest_id, match.player2b_guest_id].some(Boolean)

// 선수 자신이 경기에 포함되어 있더라도 게스트 경기면 임원 모드 강제
const effectiveIsOfficer = isOfficer || hasGuest
```

### 4. `BracketEditor.tsx` — 선수 선택에 게스트 포함

```tsx
// 선수 선택 드롭다운 옵션
type PlayerOption =
  | { type: 'member'; id: string; name: string; gender: string | null }
  | { type: 'guest'; id: string; name: string; gender: string | null }

// 그룹 구분 표시
<optgroup label="회원">
  {memberOptions.map(...)}
</optgroup>
<optgroup label="게스트">
  {guestOptions.map(g => (
    <option key={`guest-${g.id}`} value={`guest:${g.id}`}>
      {g.name} (게스트)
    </option>
  ))}
</optgroup>
```

### 5. `MemberResultsClient.tsx` — 게스트 상대 이름 표시

```tsx
// 상대 이름 표시 시 guest fallback (기존 opponent1 구조 유지)
const oppName = isDoubles
  ? `${match.opponent1?.name ?? match.opponent1_guest?.name ?? '?'} / ${match.opponent2?.name ?? match.opponent2_guest?.name ?? '?'}`
  : (match.opponent1?.name ?? match.opponent1_guest?.name ?? '?')
```

---

## 데이터 흐름

### 게스트 등록 흐름
```
임원 → GuestAddForm 제출
  → addSessionGuest(sessionId, name, gender)
  → supabaseAdmin INSERT club_session_guests
  → onGuestsChange() → 게스트 목록 refetch
```

### 게스트 포함 자동 대진 흐름
```
임원 → "자동 대진 생성" 클릭
  → createAutoScheduleMatches(sessionId, { includeGuests: true })
  → 멤버 풀(attendances) + 게스트 풀(guests) 병합
  → SchedulePlayer[] 기반 4중 조합 탐색
  → player*_member_id / player*_guest_id 컬럼 분리 INSERT
  → UI 대진표 갱신
```

### 게스트 경기 점수 입력 흐름
```
임원 → MatchResultForm (임원 모드 강제)
  → adminOverrideMatchResult(matchId, team1Score, team2Score)
  → winner_member_id = team1Captain (player1_member_id ?? player1b_member_id)
  → updateStatsAfterMatch: member 슬롯만 통계 갱신, guest 슬롯 무시
```

---

## 파일 수정 목록

| 파일 | 변경 유형 | 내용 |
|------|---------|------|
| `supabase/migrations/23_guest_participant.sql` | 신규 | 테이블 생성 + 컬럼 추가 + RLS |
| `src/lib/clubs/types.ts` | 수정 | `ClubSessionGuest`, `SchedulePlayer` 타입 추가, `ClubMatchResult` 확장 |
| `src/lib/clubs/session-actions.ts` | 수정 | 신규 3개 함수 + 5개 함수 수정 |
| `src/components/clubs/sessions/AttendanceList.tsx` | 수정 | 게스트 섹션 + GuestAddForm |
| `src/components/clubs/sessions/MatchBoard.tsx` | 수정 | 게스트 이름 표시 + 배지 |
| `src/components/clubs/sessions/MatchResultForm.tsx` | 수정 | 게스트 경기 임원 모드 강제 |
| `src/components/clubs/sessions/BracketEditor.tsx` | 수정 | 선수 선택에 게스트 포함 |
| `src/app/clubs/[id]/members/[memberId]/MemberResultsClient.tsx` | 수정 | 게스트 상대 이름 표시 |
| `src/app/clubs/[id]/sessions/[sessionId]/page.tsx` | 수정 | guests 데이터 페치 + props 전달 |

---

## 구현 순서

1. Migration 23 (DB 스키마)
2. `types.ts` 타입 추가
3. 신규 Server Actions: `addSessionGuest`, `removeSessionGuest`, `getSessionGuests`
4. `getClubSessionDetail` 반환에 guests 추가
5. `updateStatsAfterMatch` + `getClubRankingsByPeriod` winner 로직 수정
6. `reportMatchResult` 게스트 경기 차단
7. `AttendanceList` 게스트 섹션 UI
8. `MatchBoard` + `MatchResultForm` 게스트 처리
9. `BracketEditor` 게스트 선택
10. `createAutoScheduleMatches` 혼합 풀 지원
11. `getMemberGameResults` 게스트 상대 이름
