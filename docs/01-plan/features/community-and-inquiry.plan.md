# Plan: 커뮤니티 포스트 & 1:1 문의

## 1. 개요

### 1.1 배경
Tennis Tab 서비스에 커뮤니티 기능과 고객센터 1:1 문의 기능이 부재하여, 사용자 간 정보 공유 및 운영진과의 소통 채널이 없는 상태. PRD Phase 4에 명시된 "커뮤니티 (포스트)" 기능 구현과 함께, 고객센터 1:1 문의를 통해 사용자 지원 체계를 구축한다.

### 1.2 목표
- 커뮤니티 게시판을 통한 테니스 관련 정보 공유 및 소통 공간 제공
- 1:1 문의를 통한 사용자-관리자 간 비공개 소통 채널 구축
- 기존 Navigation/Footer의 커뮤니티·고객센터 링크(`/posts`, `/help`, `/contact`)를 실제 기능으로 연결

### 1.3 범위

**In Scope:**
- 카테고리별 커뮤니티 게시판 (공지사항, 자유게시판, 정보공유, 대회후기)
- 포스트 CRUD (작성은 MANAGER 이상, 조회는 전체)
- 포스트 댓글 (로그인 회원 전체)
- 1:1 문의 작성 및 내 문의 내역 조회
- 관리자 문의 답변 기능

**Out of Scope (향후):**
- 포스트 좋아요/북마크
- 이미지/파일 첨부 (Supabase Storage 연동)
- 실시간 채팅 상담
- 푸시 알림 연동

---

## 2. 사용자 스토리

### 2.1 커뮤니티 포스트

| ID | 역할 | 스토리 | 우선순위 |
|----|------|--------|----------|
| US-01 | 비회원/회원 | 커뮤니티 게시판에서 카테고리별 포스트 목록을 볼 수 있다 | P0 |
| US-02 | 비회원/회원 | 포스트 상세 내용과 댓글을 볼 수 있다 | P0 |
| US-03 | MANAGER+ | 카테고리를 선택하여 포스트를 작성할 수 있다 | P0 |
| US-04 | MANAGER+ | 내가 작성한 포스트를 수정/삭제할 수 있다 | P0 |
| US-05 | 로그인 회원 | 포스트에 댓글을 작성할 수 있다 | P1 |
| US-06 | 로그인 회원 | 내가 작성한 댓글을 수정/삭제할 수 있다 | P1 |
| US-07 | ADMIN+ | 모든 포스트와 댓글을 삭제할 수 있다 (관리) | P1 |
| US-08 | 비회원/회원 | 포스트를 제목/내용으로 검색할 수 있다 | P2 |

### 2.2 1:1 문의

| ID | 역할 | 스토리 | 우선순위 |
|----|------|--------|----------|
| US-09 | 로그인 회원 | 1:1 문의를 작성할 수 있다 (제목, 내용, 카테고리) | P0 |
| US-10 | 로그인 회원 | 내 문의 내역과 답변 상태를 확인할 수 있다 | P0 |
| US-11 | 로그인 회원 | 답변이 달린 문의의 상세 내용을 볼 수 있다 | P0 |
| US-12 | ADMIN+ | 접수된 문의 목록을 볼 수 있다 | P0 |
| US-13 | ADMIN+ | 문의에 답변을 작성할 수 있다 | P0 |
| US-14 | ADMIN+ | 문의 상태를 변경할 수 있다 (대기중→처리중→완료) | P1 |

---

## 3. 기능 상세

### 3.1 커뮤니티 포스트

#### 카테고리
| 카테고리 | 코드 | 작성 권한 | 설명 |
|----------|------|-----------|------|
| 공지사항 | `NOTICE` | ADMIN+ | 서비스 공지, 업데이트 안내 |
| 자유게시판 | `FREE` | MANAGER+ | 자유로운 주제의 글 |
| 정보공유 | `INFO` | MANAGER+ | 테니스 관련 정보, 팁 공유 |
| 대회후기 | `REVIEW` | MANAGER+ | 대회 참가 후기, 경험 공유 |

#### 포스트 데이터
- 제목 (필수, 최대 100자)
- 내용 (필수, 최대 5000자, 텍스트)
- 카테고리 (필수)
- 작성자, 작성일, 수정일
- 조회수
- 댓글 수 (비정규화)
- 고정 여부 (공지사항 상단 고정)

#### 댓글 데이터
- 내용 (필수, 최대 1000자)
- 작성자, 작성일, 수정일

### 3.2 1:1 문의

#### 문의 카테고리
| 카테고리 | 코드 | 설명 |
|----------|------|------|
| 서비스 이용 | `SERVICE` | 서비스 이용 관련 문의 |
| 대회 관련 | `TOURNAMENT` | 대회 참가, 결과 등 |
| 계정/인증 | `ACCOUNT` | 로그인, 회원정보 등 |
| 기타 | `ETC` | 기타 문의 |

#### 문의 상태
| 상태 | 코드 | 설명 |
|------|------|------|
| 대기중 | `PENDING` | 접수 후 미답변 |
| 처리중 | `IN_PROGRESS` | 관리자가 확인 중 |
| 완료 | `RESOLVED` | 답변 완료 |

#### 문의 데이터
- 제목 (필수, 최대 100자)
- 내용 (필수, 최대 3000자)
- 카테고리 (필수)
- 상태, 작성자, 작성일
- 답변 내용, 답변자, 답변일

---

## 4. 페이지 구조

```
/community                        # 커뮤니티 메인 (포스트 목록)
├── /community/[id]               # 포스트 상세 + 댓글
├── /community/new                # 포스트 작성 (MANAGER+)
├── /community/[id]/edit          # 포스트 수정 (작성자)
│
/support                          # 고객센터 메인
├── /support/inquiry              # 1:1 문의 작성
├── /support/inquiry/history      # 내 문의 내역
├── /support/inquiry/[id]         # 문의 상세 + 답변 조회
│
/admin
├── /admin/inquiries              # 문의 관리 (ADMIN+)
└── /admin/inquiries/[id]         # 문의 답변 작성
```

---

## 5. 데이터 모델 (신규 테이블)

### 5.1 posts (커뮤니티 포스트)

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | uuid | PK, default gen_random_uuid() | |
| category | text | NOT NULL, CHECK | NOTICE/FREE/INFO/REVIEW |
| title | text | NOT NULL, max 100 | 제목 |
| content | text | NOT NULL, max 5000 | 내용 |
| author_id | uuid | FK → profiles.id, NOT NULL | 작성자 |
| view_count | integer | default 0 | 조회수 |
| comment_count | integer | default 0 | 댓글 수 (비정규화) |
| is_pinned | boolean | default false | 상단 고정 |
| created_at | timestamptz | default now() | |
| updated_at | timestamptz | default now() | |

### 5.2 post_comments (댓글)

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | uuid | PK, default gen_random_uuid() | |
| post_id | uuid | FK → posts.id, NOT NULL, ON DELETE CASCADE | |
| author_id | uuid | FK → profiles.id, NOT NULL | 작성자 |
| content | text | NOT NULL, max 1000 | 내용 |
| created_at | timestamptz | default now() | |
| updated_at | timestamptz | default now() | |

### 5.3 inquiries (1:1 문의)

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | uuid | PK, default gen_random_uuid() | |
| category | text | NOT NULL, CHECK | SERVICE/TOURNAMENT/ACCOUNT/ETC |
| title | text | NOT NULL, max 100 | 제목 |
| content | text | NOT NULL, max 3000 | 내용 |
| author_id | uuid | FK → profiles.id, NOT NULL | 문의자 |
| status | text | NOT NULL, default 'PENDING' | PENDING/IN_PROGRESS/RESOLVED |
| reply_content | text | nullable | 답변 내용 |
| reply_by | uuid | FK → profiles.id, nullable | 답변자 |
| replied_at | timestamptz | nullable | 답변일 |
| created_at | timestamptz | default now() | |
| updated_at | timestamptz | default now() | |

---

## 6. 권한 매트릭스

| 기능 | 비회원 | USER | MANAGER | ADMIN | SUPER_ADMIN |
|------|--------|------|---------|-------|-------------|
| 포스트 조회 | O | O | O | O | O |
| 포스트 작성 | X | X | O | O | O |
| 공지사항 작성 | X | X | X | O | O |
| 포스트 수정 (본인) | - | - | O | O | O |
| 포스트 삭제 (본인) | - | - | O | O | O |
| 포스트 삭제 (타인) | X | X | X | O | O |
| 포스트 고정 | X | X | X | O | O |
| 댓글 작성 | X | O | O | O | O |
| 댓글 수정/삭제 (본인) | - | O | O | O | O |
| 댓글 삭제 (타인) | X | X | X | O | O |
| 1:1 문의 작성 | X | O | O | O | O |
| 내 문의 조회 | X | O | O | O | O |
| 전체 문의 관리 | X | X | X | O | O |
| 문의 답변 | X | X | X | O | O |

---

## 7. RLS 정책

### posts
- SELECT: 전체 허용 (비회원 포함)
- INSERT: MANAGER 이상 (카테고리별 추가 검증은 Server Action에서)
- UPDATE: 본인 작성 글 OR ADMIN 이상
- DELETE: 본인 작성 글 OR ADMIN 이상

### post_comments
- SELECT: 전체 허용
- INSERT: 로그인 사용자 (auth.uid() IS NOT NULL)
- UPDATE: 본인 작성 댓글
- DELETE: 본인 작성 댓글 OR ADMIN 이상

### inquiries
- SELECT: 본인 문의 OR ADMIN 이상
- INSERT: 로그인 사용자
- UPDATE: ADMIN 이상 (답변 작성, 상태 변경)
- DELETE: 없음 (문의 삭제 불가)

---

## 8. 기술적 고려사항

### 8.1 Server Actions
- `src/lib/community/actions.ts` — 포스트 CRUD, 댓글 CRUD
- `src/lib/support/actions.ts` — 문의 CRUD, 답변 작성
- 권한 검증: 기존 `checkRole()` 패턴 활용
- 입력 검증: `validation.ts`에 `validatePostInput()`, `validateInquiryInput()` 추가

### 8.2 Navigation 연결
- 상단 Navigation: "커뮤니티" 링크 → `/community` (현재 `/#community`)
- Footer: "커뮤니티" → `/community`, "고객센터" → `/support`, "문의하기" → `/support/inquiry`

### 8.3 성능
- 포스트 목록: 페이지네이션 (20개씩)
- 조회수: Server Action에서 증가 (중복 방지는 향후)
- comment_count 비정규화로 목록에서 JOIN 최소화

---

## 9. 구현 순서 (권장)

| 순서 | 작업 | 예상 규모 |
|------|------|-----------|
| 1 | DB 마이그레이션 (posts, post_comments, inquiries + RLS) | S |
| 2 | 커뮤니티 포스트 Server Actions + 타입 정의 | M |
| 3 | 커뮤니티 목록 페이지 (`/community`) | M |
| 4 | 커뮤니티 상세 페이지 + 댓글 (`/community/[id]`) | M |
| 5 | 커뮤니티 작성/수정 페이지 | M |
| 6 | 1:1 문의 Server Actions + 타입 정의 | S |
| 7 | 고객센터 페이지 + 문의 작성 (`/support`) | M |
| 8 | 내 문의 내역 + 상세 조회 | S |
| 9 | 관리자 문의 관리 페이지 (`/admin/inquiries`) | M |
| 10 | Navigation/Footer 링크 연결 | S |

---

## 10. 성공 지표

- 포스트 CRUD 정상 동작 (카테고리별 권한 포함)
- 댓글 CRUD 정상 동작 (본인만 수정/삭제)
- 1:1 문의 접수 → 관리자 답변 → 사용자 확인 플로우 완료
- RLS 정책으로 비인가 접근 차단 확인
- 모바일 반응형 정상 표시
