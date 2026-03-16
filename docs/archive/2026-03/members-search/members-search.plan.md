# Plan: 클럽 전체 회원 통합 검색

## 1. 개요

### 배경
현재 `/admin/clubs/[id]` 에서 특정 클럽의 회원만 조회할 수 있어, 관리자가 특정 회원을 찾으려면 클럽별로 일일이 들어가야 한다. 여러 클럽을 관리하는 시스템 관리자 입장에서 이름이나 연락처 하나로 전체 회원을 검색할 수단이 없다.

### 목표
- 관리자가 **이름 / 전화번호**로 전체 클럽 회원을 통합 검색
- 한글 초성 검색 지원 (`matchesKoreanSearch` 유틸 재사용)
- 검색 결과에서 소속 클럽 페이지로 바로 이동
- ADMIN 이상: 전체 클럽 회원 / MANAGER: 자신의 관리 클럽 회원만

### 범위

| 포함 | 제외 |
|------|------|
| 이름 / 전화번호 통합 검색 | 회원 직접 수정 (해당 클럽 상세에서 처리) |
| 한글 초성 검색 | 협회 단위 필터링 (추후 확장) |
| 소속 클럽 링크 | 회원 일괄 내보내기(CSV 등) |
| URL `?q=` 쿼리 동기화 | 삭제/제거된 회원 포함 여부 토글 |
| 역할 / 가입 구분 표시 | 실시간 Realtime 구독 |

---

## 2. 데이터 모델

### DB 변경 없음
기존 `club_members` + `clubs` 테이블 조인만으로 구현 가능.

### 조회 쿼리 설계

```sql
SELECT
  cm.id, cm.name, cm.phone, cm.gender, cm.birth_year,
  cm.role, cm.status, cm.is_registered, cm.rating,
  cm.club_id,
  c.name AS club_name
FROM club_members cm
JOIN clubs c ON c.id = cm.club_id
WHERE cm.status NOT IN ('REMOVED', 'LEFT')
  -- MANAGER: AND cm.club_id IN (관리 클럽 목록)
ORDER BY c.name, cm.name
```

- 검색 필터(`name ILIKE`, `phone ILIKE`)는 **Server Action 서버 사이드** 또는
  **클라이언트 사이드** 중 선택 → 클라이언트 방식 채택
  - 이유: 회원 수가 수천 명 이하인 서비스 규모에서 전체 로드 후 클라이언트 필터가 UX 더 빠름
  - 한글 초성 검색(`matchesKoreanSearch`)은 JS 레이어에서만 가능
  - URL 동기화는 `/korean-search` 스킬 패턴 활용

---

## 3. 영향 범위

### 3.1 Server Actions (`src/lib/clubs/actions.ts`)

| 함수 | 내용 |
|------|------|
| `getAllClubMembers(options?)` | 신규 추가. ADMIN: 전체, MANAGER: 관리 클럽만 반환 |

반환 타입:
```ts
type MemberWithClub = ClubMember & { club_name: string }

getAllClubMembers(): Promise<{ data: MemberWithClub[]; error?: string }>
```

### 3.2 신규 페이지

| 경로 | 파일 |
|------|------|
| `/admin/clubs/members` | `src/app/admin/clubs/members/page.tsx` |

- Server Component: `getAllClubMembers()` 호출 후 초기 데이터 전달
- `?q=` 쿼리 파라미터를 `searchParams`로 읽어 초기 검색어 설정
- 권한: MANAGER 이상 (기존 `/admin/clubs`와 동일)

### 3.3 신규 컴포넌트

| 파일 | 역할 |
|------|------|
| `src/components/clubs/AllMembersSearch.tsx` | 검색 UI + 결과 목록 (Client Component) |

- `input[type=text]` 검색창 — URL `?q=` 동기화 (디바운스 300ms, `router.replace`)
- `matchesKoreanSearch(member.name, q)` 로 이름 초성 검색
- `member.phone?.includes(q)` 로 전화번호 검색
- 결과 행 클릭 → `/admin/clubs/[club_id]?q=` 로 이동

### 3.4 기존 파일 수정

| 파일 | 변경 내용 |
|------|----------|
| `src/app/admin/clubs/page.tsx` | "전체 회원 검색" 버튼 추가 (ADMIN/MANAGER 모두 노출) |

---

## 4. UI 설계

### 4.1 `/admin/clubs` 페이지 상단 버튼 추가

```
┌──────────────────────────────────────────────┐
│  클럽 관리                  [전체 회원 검색] [클럽 생성] │
└──────────────────────────────────────────────┘
```

### 4.2 `/admin/clubs/members` 검색 페이지

```
┌──────────────────────────────────────────────┐
│ ← 클럽 관리     전체 회원 검색                 │
│                                              │
│  🔍 [이름 또는 연락처 검색                   ] │
│     총 N명 중 M명                            │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ 김상록  |  상록회  |  회원  | 010-...  │  │
│  │         가입회원                       │  │
│  ├────────────────────────────────────────┤  │
│  │ 이승화  |  서초테니스  | 총무 | 010-..│  │
│  │         비가입회원                     │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

**결과 행 표시 항목:**
- 이름, 소속 클럽명(링크), 역할 배지, 연락처
- 가입/비가입 구분 (`is_registered`)
- 행 전체 클릭 → `/admin/clubs/[club_id]`로 이동

**빈 결과:**
- 검색어 없음: "검색어를 입력하세요" 안내
- 검색 결과 없음: "검색 결과가 없습니다"

---

## 5. 구현 순서

| 단계 | 작업 | 복잡도 |
|------|------|--------|
| 1 | `getAllClubMembers()` Server Action 추가 | 낮음 |
| 2 | `/admin/clubs/members/page.tsx` Server Component 생성 | 낮음 |
| 3 | `AllMembersSearch.tsx` Client Component 구현 (검색 + URL 동기화) | 중간 |
| 4 | `/admin/clubs/page.tsx`에 "전체 회원 검색" 링크 버튼 추가 | 낮음 |
| 5 | TypeScript 타입 정의 (`MemberWithClub`) | 낮음 |
| 6 | `tsc --noEmit` + `next build` 확인 | 낮음 |

---

## 6. 기술적 고려사항

### 권한
- `getAllClubMembers()`에서 `checkClubOwnerAuth` 대신 별도 권한 로직 필요
  - ADMIN 이상: 전체 클럽 `join clubs`
  - MANAGER: `club_members where user_id = me AND role IN (OWNER, ADMIN, MATCH_DIRECTOR)` 로 관리 클럽 ID 추출 후 필터

### 성능
- 클라이언트 사이드 필터 채택 이유: 초성 검색은 JS만 가능, 전체 로드 후 메모리 필터가 응답 빠름
- 데이터 규모 예상: 클럽 수십 개 × 회원 수십 명 = 최대 수천 row → 클라이언트 필터 충분

### URL 동기화
- `router.replace` 디바운스 300ms (`/korean-search` 스킬 패턴 동일하게 적용)
- 직접 URL 접근(`/admin/clubs/members?q=김`) 시 서버에서 초기 검색어 주입 → `AllMembersSearch` props로 전달

### 한글 초성 검색
- `src/lib/utils/korean.ts`의 `matchesKoreanSearch()` 재사용
- 이름은 초성 검색, 전화번호는 `includes()` 단순 검색

---

## 7. 검증 기준

- [ ] ADMIN 계정: 전체 클럽 회원 목록 로드 및 검색 동작
- [ ] MANAGER 계정: 자신의 관리 클럽 회원만 표시 (다른 클럽 회원 미노출)
- [ ] 이름 한글 초성 검색 동작 (예: "ㄱㅅ" → "김상록" 검색됨)
- [ ] 전화번호 부분 검색 동작 (예: "1234" → 해당 번호 포함 회원 검색)
- [ ] 검색어 URL 동기화 (`?q=` 파라미터 반영)
- [ ] 결과 행 클릭 시 해당 클럽 상세 페이지로 이동
- [ ] `/admin/clubs` 페이지에서 "전체 회원 검색" 버튼 노출
- [ ] `tsc --noEmit` 통과
- [ ] `next build` 통과
