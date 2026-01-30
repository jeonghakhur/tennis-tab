# Tennis Tab - Product Requirements Document

## 1. 개요

### 1.1 제품 소개

Tennis Tab은 **자연어 기반 인터페이스**를 통해 테니스 대회 검색, 참가 신청, 경기 결과 등록 등을 간편하게 처리할 수 있는 웹 서비스입니다.

### 1.2 핵심 가치

- **자연어 인터페이스**: "이번 주 서울 대회 뭐 있어?"처럼 자연스러운 대화로 서비스 이용
- **간편한 대회 관리**: 대회 생성부터 대진표, 결과 관리까지 원스톱 처리
- **커뮤니티 활성화**: 테니스 동호인 간 정보 공유 및 네트워킹

### 1.3 대상 사용자

| 사용자 유형 | 설명 |
|------------|------|
| 비회원 | 대회 검색, 대진표/결과 조회 |
| 일반 회원 | 대회 참가 신청, 경기 결과 등록, 커뮤니티 활동 |
| 관리자 | 대회 생성, 대진표 관리, 참가자 승인 |

---

## 2. 자연어 처리 (NLP) 기능

### 2.1 개요

사용자가 채팅 형태로 자연어를 입력하면 AI가 의도를 파악하여 적절한 액션을 수행합니다.

### 2.2 기술 스택

- **LLM**: OpenAI GPT-4o-mini
- **처리 방식**: Server-side API Route
- **응답 형식**: Structured JSON → 액션 실행 → 자연어 응답

### 2.3 지원 기능 (Intent)

#### 비회원 (로그인 불필요)

| Intent | 설명 | 예시 입력 |
|--------|------|----------|
| `SEARCH_TOURNAMENT` | 대회 검색 | "이번 주 서울에서 열리는 대회 알려줘" |
| `VIEW_BRACKET` | 대진표 조회 | "서울 오픈 대진표 보여줘" |
| `VIEW_RESULTS` | 경기 결과 조회 | "서울 오픈 결과 알려줘" |
| `VIEW_REQUIREMENTS` | 참가 기준 조회 | "서울 오픈 참가 조건이 뭐야?" |
| `HELP` | 도움말 | "뭘 할 수 있어?" |

#### 회원 (로그인 필요)

| Intent | 설명 | 예시 입력 |
|--------|------|----------|
| `VIEW_MY_TOURNAMENTS` | 내 참가 대회 조회 | "내가 신청한 대회 목록 보여줘" |
| `CHECK_ENTRY_STATUS` | 참가 신청 상태 확인 | "강남 오픈 신청 됐어?" |
| `REGISTER_RESULT` | 경기 결과 등록 | "김철수한테 6-4, 6-2로 이겼어" |
| `VIEW_MY_SCHEDULE` | 내 경기 일정/장소 조회 | "다음 경기 몇 번 코트야?" |
| `JOIN_TOURNAMENT` | 참가 신청 | "서울 오픈 참가 신청할게" |
| `CANCEL_ENTRY` | 참가 취소 | "서울 오픈 참가 취소해줘" |

#### 관리자 (관리자 권한 필요)

| Intent | 설명 | 예시 입력 |
|--------|------|----------|
| `CREATE_TOURNAMENT` | 대회 생성 | "3월 15일 강남 오픈 대회 만들어줘" |
| `GENERATE_BRACKET` | 대진표 자동 생성 | "강남 오픈 대진표 생성해" |
| `MANAGE_ENTRIES` | 참가자 관리 | "홍길동 참가 승인해줘" |
| `UPDATE_TOURNAMENT` | 대회 정보 수정 | "강남 오픈 장소를 올림픽공원으로 변경해" |

### 2.4 처리 파이프라인

```
1. 사용자 입력 수신
   ↓
2. GPT-4o-mini API 호출
   - System Prompt: 도메인 컨텍스트 + Intent 목록 + 출력 형식
   - User Input: 사용자 메시지
   ↓
3. JSON 응답 파싱
   {
     "intent": "SEARCH_TOURNAMENT",
     "entities": { "location": "서울", "date": "이번 주" },
     "confidence": 0.95
   }
   ↓
4. 권한 검증
   - 비회원 가능 Intent인지 확인
   - 로그인 필요 시 로그인 유도
   ↓
5. 데이터베이스 액션 실행
   ↓
6. 자연어 응답 생성 후 반환
```

### 2.5 예상 비용

| 항목 | 수치 |
|------|------|
| 평균 입력 토큰 | ~300 tokens |
| 평균 출력 토큰 | ~150 tokens |
| 일 1,000건 요청 시 | ~$0.10/일 |
| 월 예상 비용 | ~$3/월 |

---

## 3. 회원 관리

### 3.1 소셜 로그인

| 제공자 | 설명 |
|--------|------|
| **네이버** | 네이버 OAuth 2.0 |
| **카카오** | 카카오 OAuth 2.0 |

- Supabase Auth를 통한 소셜 로그인 통합
- 최초 로그인 시 프로필 자동 생성

### 3.2 사용자 역할

| 역할 | 권한 |
|------|------|
| `USER` | 기본 회원 (대회 참가, 결과 등록) |
| `ADMIN` | 관리자 (대회 생성, 대진표 관리) |
| `SUPER_ADMIN` | 슈퍼 관리자 (전체 시스템 관리) |

### 3.3 프로필 정보

- 이름 (닉네임)
- 프로필 이미지
- 연락처
- 실력 수준 (입문/초급/중급/고급/선수)
- 주 사용 손 (오른손/왼손/양손)
- 소속 클럽

---

## 4. 대회 관리

### 4.1 대회 생성 (관리자)

**기본 정보**
- 대회명
- 대회 설명
- 대회 일시 (시작일, 종료일)
- 대회 장소
- 대회 포스터 이미지

**참가 설정**
- 참가비
- 최대 참가 인원
- 참가 자격 조건 (실력 수준, 성별, 연령 등)
- 신청 기간

**대회 형식**
- 토너먼트 (싱글 엘리미네이션, 더블 엘리미네이션)
- 리그전
- 조별 리그 + 토너먼트
- 단식/복식/혼합복식

### 4.2 대회 상태

| 상태 | 설명 |
|------|------|
| `DRAFT` | 작성 중 |
| `OPEN` | 참가 모집 중 |
| `CLOSED` | 모집 마감 |
| `IN_PROGRESS` | 대회 진행 중 |
| `COMPLETED` | 대회 종료 |
| `CANCELLED` | 대회 취소 |

### 4.3 대진표 관리

- 자동 대진표 생성 (시드 배정 옵션)
- 수동 대진표 수정
- 경기 일정/코트 배정
- 실시간 결과 업데이트

---

## 5. 데이터 모델 (Supabase)

### 5.1 users

| 필드 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK, Supabase Auth ID |
| email | text | 이메일 |
| name | text | 이름/닉네임 |
| avatar_url | text | 프로필 이미지 |
| phone | text | 연락처 |
| skill_level | enum | 실력 수준 |
| role | enum | 사용자 역할 |
| created_at | timestamptz | 가입일 |

### 5.2 tournaments

| 필드 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| title | text | 대회명 |
| description | text | 대회 설명 |
| start_date | timestamptz | 시작일 |
| end_date | timestamptz | 종료일 |
| location | text | 장소 |
| address | text | 상세 주소 |
| max_participants | int | 최대 참가 인원 |
| entry_fee | int | 참가비 |
| status | enum | 대회 상태 |
| format | enum | 대회 형식 |
| requirements | jsonb | 참가 조건 |
| organizer_id | uuid | FK → users |
| created_at | timestamptz | 생성일 |

### 5.3 tournament_entries

| 필드 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| tournament_id | uuid | FK → tournaments |
| user_id | uuid | FK → users |
| status | enum | 신청 상태 (pending/approved/rejected) |
| created_at | timestamptz | 신청일 |

### 5.4 matches

| 필드 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| tournament_id | uuid | FK → tournaments |
| round | int | 라운드 번호 |
| match_number | int | 경기 번호 |
| player1_id | uuid | FK → users |
| player2_id | uuid | FK → users |
| winner_id | uuid | FK → users |
| score | text | 스코어 (예: "6-4, 6-3") |
| court_number | text | 코트 번호 |
| scheduled_at | timestamptz | 예정 시간 |
| completed_at | timestamptz | 완료 시간 |

### 5.5 chat_logs

| 필드 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| user_id | uuid | FK → users (nullable) |
| session_id | text | 세션 ID (비회원용) |
| message | text | 사용자 입력 |
| response | text | AI 응답 |
| intent | text | 파악된 Intent |
| entities | jsonb | 추출된 엔티티 |
| created_at | timestamptz | 생성일 |

---

## 6. 페이지 구조

```
/                           # 홈 (자연어 입력 + 대회 목록)
├── /auth
│   └── /callback           # OAuth 콜백
├── /tournaments
│   ├── /                   # 대회 목록
│   ├── /[id]               # 대회 상세
│   ├── /[id]/bracket       # 대진표
│   └── /[id]/results       # 결과
├── /admin                  # 관리자 전용
│   ├── /tournaments/create # 대회 생성
│   └── /tournaments/[id]   # 대회 관리
├── /my
│   ├── /tournaments        # 내 대회
│   └── /profile            # 내 프로필
└── /api
    ├── /chat               # 자연어 처리 API
    └── /auth               # 인증 관련 API
```

---

## 7. 기술 스택

### 7.1 Frontend

| 기술 | 용도 |
|------|------|
| Next.js 16 | App Router 기반 프레임워크 |
| TypeScript | 타입 안정성 |
| Tailwind CSS | 스타일링 |
| React Query | 서버 상태 관리 |
| Zustand | 클라이언트 상태 관리 |

### 7.2 Backend

| 기술 | 용도 |
|------|------|
| Next.js API Routes | API 엔드포인트 |
| Supabase | 데이터베이스 + 인증 |
| OpenAI API | GPT-4o-mini (자연어 처리) |

### 7.3 Infrastructure

| 기술 | 용도 |
|------|------|
| Vercel | 호스팅 |
| Supabase | PostgreSQL + Auth + Storage |

### 7.4 인증 (Supabase Auth)

| 제공자 | 설정 |
|--------|------|
| 네이버 | Naver Developers 앱 등록 필요 |
| 카카오 | Kakao Developers 앱 등록 필요 |

---

## 8. MVP 범위

### Phase 1 - 자연어 기반 MVP

- [ ] 자연어 입력 UI (홈 화면)
- [ ] GPT-4o-mini 연동 API
- [ ] 대회 검색 (자연어)
- [ ] 대진표/결과 조회 (자연어)
- [ ] 네이버/카카오 소셜 로그인
- [ ] 기본 프로필 관리

### Phase 2 - 대회 참가

- [ ] 대회 참가 신청 (자연어)
- [ ] 참가 상태 확인 (자연어)
- [ ] 경기 결과 등록 (자연어)
- [ ] 내 경기 일정 조회 (자연어)

### Phase 3 - 관리자 기능

- [ ] 대회 생성 (관리자 UI)
- [ ] 대진표 자동 생성
- [ ] 참가자 승인/거절

### Phase 4 - 고급 기능

- [ ] 클럽 기능
- [ ] 커뮤니티 (포스트)
- [ ] 알림 기능
- [ ] 통계/대시보드

---

## 9. 환경 변수

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxx

# OpenAI
OPENAI_API_KEY=sk-xxx

# OAuth (Supabase에서 설정)
# - 네이버: Naver Developers에서 Client ID/Secret 발급
# - 카카오: Kakao Developers에서 REST API 키 발급
```

---

## 10. 용어 정의

| 용어 | 정의 |
|------|------|
| Intent | 사용자의 의도 (예: 대회 검색, 결과 등록) |
| Entity | 문장에서 추출된 정보 (예: 대회명, 날짜, 장소) |
| Tournament | 테니스 대회 |
| Entry | 대회 참가 신청 |
| Bracket | 대진표 |
| Match | 개별 경기 |
