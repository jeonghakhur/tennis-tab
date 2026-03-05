# 네이티브 앱 화면 인벤토리

> 현재 Next.js 웹앱의 모든 화면을 네이티브 앱 관점으로 재정리한 문서.
> 어드민 기능은 웹 전용 유지. 네이티브 앱에는 공개/인증/마이 영역만 포함.

---

## 네비게이션 구조 (Expo Router)

```
(tabs)/
├── index          → 대회 목록
├── clubs          → 클럽 목록
├── awards         → 수상 내역
├── community      → 커뮤니티
└── my             → 마이페이지

(stack)/
├── tournaments/[id]                    → 대회 상세
├── tournaments/[id]/bracket            → 대진표 보기
├── tournaments/[id]/payment            → 결제 (재설계 필요)
├── tournaments/[id]/payment/success    → 결제 성공 콜백
├── tournaments/[id]/payment/fail       → 결제 실패 콜백
├── clubs/[id]                          → 클럽 상세
├── clubs/[id]/sessions/[id]            → 세션 상세
├── clubs/[id]/members/[memberId]       → 클럽 멤버 상세
├── community/[id]                      → 게시글 상세
├── community/new                       → 게시글 작성 (MANAGER 이상)
├── community/[id]/edit                 → 게시글 수정 (MANAGER 이상)
├── my/profile/edit                     → 프로필 수정
├── my/clubs/[id]                       → 내 클럽 상세
└── support/                            → 고객지원 (WebView 임베드 또는 네이티브)
    ├── support/inquiry                 → 문의하기
    ├── support/inquiry/history         → 문의 내역
    └── support/inquiry/[id]           → 문의 상세

(auth)/
├── login          → 로그인
├── signup         → 회원가입
├── reset-password → 비밀번호 재설정
└── error          → 소셜 로그인 에러 핸들링
```

---

## 화면별 상세 명세

### 1. 대회 목록 (`/tournaments`)
**네이티브 화면:** `TournamentsScreen`

**UI 구성:**
- 헤더: "대회 일정" 타이틀 + 대회 생성 버튼 (ADMIN 이상)
- 대회 카드 목록 (FlatList)
  - 포스터 이미지 (`poster_url`)
  - 제목, 상태 배지, 날짜, 장소

**데이터 요구사항:**
```ts
supabase.from('tournaments')
  .select('id, title, status, start_date, end_date, location, poster_url')
  .order('start_date', { ascending: false })
```

**인터랙션:**
- 카드 탭 → 대회 상세로 이동
- 실시간 상태 업데이트 (Supabase Realtime)

---

### 2. 대회 상세 (`/tournaments/[id]`)
**네이티브 화면:** `TournamentDetailScreen`

**UI 구성:**
- 포스터 이미지 (전체 너비)
- 대회 정보 섹션 (날짜/장소/주최/대진형식/공/자격)
- 부서 목록 (각 부서별 날짜/장소/시상)
- 참가 신청 섹션 (신청 버튼 or 신청 현황)
- 참가자 목록

**데이터 요구사항:**
```ts
supabase.from('tournaments')
  .select(`
    *,
    tournament_divisions(*),
    tournament_entries(*)
    -- tournament_entries는 player_name, club_name 등을 자체 필드로 보유
    -- profiles JOIN 불필요
  `)
  .eq('id', tournamentId)
  .single()
```

**인터랙션:**
- 참가 신청/취소
- 결제로 이동 (entry_fee > 0)
- 대진표 보기 버튼 (bracket_matches 존재 시 활성)

---

### 3. 대진표 보기 (`/tournaments/[id]/bracket`)
**네이티브 화면:** `BracketViewScreen`

**UI 구성:**
- 예선 탭 / 본선 탭 (예선 있는 경우)
- 본선: 싱글 엘리미네이션 트리 (가로 스크롤)
- 예선: 조별 풀리그 표

**데이터 요구사항:**
```ts
supabase.from('bracket_configs').select('*').eq('division_id', divisionId)
supabase.from('bracket_matches').select(`
  *,
  team1_entry:team1_entry_id(player_name, club_name, team_members, profile:user_id(name)),
  team2_entry:team2_entry_id(player_name, club_name, team_members, profile:user_id(name))
`).eq('bracket_config_id', configId)
-- 주의: config_id → bracket_config_id, entry1_id → team1_entry_id, entry2_id → team2_entry_id
```

**인터랙션:**
- 실시간 경기 결과 업데이트 (Supabase Realtime)
- 경기 탭으로 포커스 이동
- ⚠️ DnD 없음 (뷰 전용)

**주의사항:**
- 웹에서는 가로 스크롤 + SVG 라인으로 구현
- 네이티브: `react-native-reanimated` + `react-native-gesture-handler`로 제스처 지원

---

### 4. 결제 (`/tournaments/[id]/payment`)
**네이티브 화면:** `PaymentScreen` ⚠️ **재설계 필요**

**웹 현재 구현:**
- TossPayments Web SDK (WebView 기반)
- 결제 성공/실패 redirect URL

**네이티브 전략 옵션:**
1. **WebView 임베드**: TossPayments WebView → 웹뷰 내 처리 (빠른 구현)
2. **TossPayments 모바일 SDK**: iOS/Android native SDK (인앱결제와 동일한 UX)
3. **IAP**: App Store/Play Store 인앱결제 (수수료 30% 주의)

**권장**: 초기에는 WebView 임베드 → TossPayments 모바일 SDK로 전환

---

### 5. 클럽 목록 (`/clubs`)
**네이티브 화면:** `ClubsScreen`

**UI 구성:**
- 검색 입력 (한글 초성 검색 지원)
- 클럽 카드 목록 (FlatList)
  - 클럽명, 지역, 회원수, 가입 유형

**데이터 요구사항:**
```ts
// clubs 테이블에 member_count 컬럼 없음 → 별도 count 쿼리 필요
supabase.from('clubs')
  .select('id, name, city, district, join_type')
  .order('name')
// 회원 수는 club_members를 별도로 count하거나 집계 뷰 활용
```

---

### 6. 클럽 상세 (`/clubs/[id]`)
**네이티브 화면:** `ClubDetailScreen`

**탭 구성:**
- 소개, 멤버, 세션, 랭킹

**데이터 요구사항:**
```ts
// club_members는 name, rating 등 자체 필드 보유 → profiles JOIN 불필요
supabase.from('clubs').select('*, club_members(*)').eq('id', id)
supabase.from('club_sessions').select('*').eq('club_id', id).order('session_date', { ascending: false })
```

---

### 7. 클럽 세션 상세 (`/clubs/[id]/sessions/[sessionId]`)
**네이티브 화면:** `ClubSessionDetailScreen`

**UI 구성:**
- 세션 정보 (날짜/장소/코트)
- 참석 응답 버튼 (참석/미참석/미정)
- 참석 명단
- 게스트 목록
- 경기 결과 목록

**데이터 요구사항:**
```ts
supabase.from('club_sessions').select(`
  *,
  club_session_attendances(*, club_member:club_member_id(name)),
  club_session_guests(*),
  club_match_results(
    *,
    player1:player1_member_id(name),
    player2:player2_member_id(name)
  )
`).eq('id', sessionId)
-- 주의:
-- attendances.member_id → club_member_id, profiles 아닌 club_members JOIN
-- match_results 선수명: club_members.name 직접 참조 (profiles 경유 불필요)
```

---

### 8. 수상 내역 (`/awards`)
**네이티브 화면:** `AwardsScreen`

**UI 구성:**
- 필터 (연도, 종목, 부서)
- 수상 카드 목록

**데이터 요구사항:**
```ts
supabase.from('tournament_awards')
  .select('*')
  .order('year', { ascending: false })
  .order('display_order')
```

---

### 9. 커뮤니티 목록 (`/community`)
**네이티브 화면:** `CommunityScreen`

**UI 구성:**
- 검색 입력
- 게시글 피드 (FlatList + 무한 스크롤)
- 게시글 작성 버튼 (MANAGER 이상)

**데이터 요구사항:**
```ts
// cursor 기반 페이지네이션
supabase.from('posts')
  .select('id, title, content, created_at, like_count, profiles(name, avatar_url)')
  .order('created_at', { ascending: false })
  .limit(FEED_LIMIT)
```

---

### 10. 게시글 상세 (`/community/[id]`)
**네이티브 화면:** `PostDetailScreen`

**UI 구성:**
- 게시글 내용 (HTML → React Native 렌더링)
- 좋아요 버튼
- 수정/삭제 버튼 (작성자 or ADMIN)

**주의사항:**
- TipTap HTML 콘텐츠 렌더링: `react-native-render-html` 검토

---

### 11. 게시글 작성/수정 (`/community/new`, `/community/[id]/edit`)
**네이티브 화면:** `PostEditorScreen`

**주의사항:**
- ⚠️ TipTap 에디터 → React Native 대안 필요
- 옵션: `react-native-rich-text-editor` or `@10play/tentap-editor`

---

### 12. 로그인 (`/auth/login`)
**네이티브 화면:** `LoginScreen`

**UI 구성:**
- 이메일/비밀번호 폼
- 소셜 로그인 버튼 (Google, Kakao, Naver)
- 회원가입 링크, 비밀번호 재설정 링크

**인증 전환:**
- 웹: `@supabase/ssr` + 쿠키 기반
- 네이티브: `@supabase/supabase-js` + `expo-secure-store`

---

### 13. 회원가입 (`/auth/signup`)
**네이티브 화면:** `SignupScreen`

**UI 구성:**
- 이메일, 비밀번호, 이름, 전화번호 폼

---

### 14. 마이페이지 (`/my/profile`)
**네이티브 화면:** `MyProfileScreen`

**탭 구성:**
1. **내 경기** — 참가 대회 목록 + 예정 경기 + 결과 입력
2. **수상** — 내 수상 이력 (이름 클레임 포함)
3. **통계** — 전체 경기/승리/패배/승률

**데이터 요구사항:**
```ts
// 웹 실제 시그니처 — userId 파라미터 없음 (내부적으로 getCurrentUser 호출)
getUserStats()      // 통계 (src/lib/data/user.ts)
getMyTournaments()  // 참가 대회 + 신청 현황 (src/lib/data/user.ts)
getMyMatches()      // 예정 경기 목록 (src/lib/data/user.ts)
// getMyAwards()는 별도 함수 없음 — awards 테이블에서 클라이언트 직접 조회
supabase.from('tournament_awards')
  .select('*')
  .contains('player_user_ids', [userId])

// 네이티브 앱에서는 userId를 파라미터로 받아 직접 쿼리
```

---

### 15. 프로필 수정 (`/my/profile/edit`)
**네이티브 화면:** `ProfileEditScreen`

**UI 구성:**
- 아바타 이미지 선택 (expo-image-picker)
- 이름, 전화번호, 성별, 입문년도, 레이팅, 클럽 정보

---

### 16. 내 신청 목록 (`/my/entries`)
**네이티브 화면:** `MyEntriesScreen`

**UI 구성:**
- 참가 신청 목록 (대회별)
- 상태 배지 (PENDING/APPROVED/CONFIRMED/CANCELLED)

---

### 17. 내 클럽 목록 (`/my/clubs`)
**네이티브 화면:** `MyClubsScreen`

**UI 구성:**
- 가입한 클럽 목록
- 클럽 가입 신청 버튼

---

### 18. 인증 에러 (`/auth/error`)
**네이티브 화면:** `AuthErrorScreen`

**UI 구성:**
- 소셜 로그인(Google/Kakao/Naver) 실패 시 표시
- 에러 메시지 + 재시도 버튼

---

### 19. 결제 성공 (`/tournaments/[id]/payment/success`)
**네이티브 화면:** `PaymentSuccessScreen`

**UI 구성:**
- 결제 완료 메시지
- 신청 내역 확인 버튼

---

### 20. 결제 실패 (`/tournaments/[id]/payment/fail`)
**네이티브 화면:** `PaymentFailScreen`

**UI 구성:**
- 결제 실패 메시지 + 오류 코드
- 재시도 버튼

---

### 21. 클럽 멤버 상세 (`/clubs/[id]/members/[memberId]`)
**네이티브 화면:** `ClubMemberDetailScreen`

**UI 구성:**
- 회원 프로필 (이름, 레이팅, 성별, 입문연도)
- 클럽 내 통계 (club_member_stats)

---

### 22. 내 클럽 상세 (`/my/clubs/[id]`)
**네이티브 화면:** `MyClubDetailScreen`

**UI 구성:**
- 내 클럽 관리 화면 (역할이 OWNER/ADMIN인 경우)
- 클럽 멤버 관리, 세션 생성 등

---

### 23. 고객지원 (`/support`)
**네이티브 화면:** `SupportScreen`

**UI 구성:**
- FAQ 목록
- 1:1 문의하기 버튼

---

### 24. 문의하기 (`/support/inquiry`)
**네이티브 화면:** `InquiryScreen`

---

### 25. 문의 내역 (`/support/inquiry/history`)
**네이티브 화면:** `InquiryHistoryScreen`

---

### 26. 문의 상세 (`/support/inquiry/[id]`)
**네이티브 화면:** `InquiryDetailScreen`

---

## 제외 화면

### 웹 어드민 전용 (완전 제외)

| 화면 | 이유 |
|------|------|
| `/admin/**` | 관리자 기능은 웹에서만 제공 |
| `/clubs/[id]/sessions/[sessionId]/manage` | 세션 관리(조편성 등) — 어드민 수준 기능, 초기엔 제외 |

### WebView로 임베드

| 화면 | 이유 |
|------|------|
| `/privacy` | 법적 필수 — 앱 심사용 WebView 임베드 |
| `/terms` | 법적 필수 — 앱 심사용 WebView 임베드 |

### 권한 필요 — 초기엔 제외, 추후 검토

| 화면 | 실제 경로 | 비고 |
|------|-----------|------|
| `/tournaments/new` | `src/app/tournaments/new/page.tsx` | `/admin/` 하위가 아닌 일반 경로. MANAGER 이상 권한 체크. 초기에는 웹에서만 제공하되 추후 네이티브 포함 검토 |
| `/tournaments/[id]/edit` | `src/app/tournaments/[id]/edit/page.tsx` | 마찬가지로 일반 경로 (organizer 권한). 추후 검토 |
