# Tennis Tab - Product Requirements Document

## 1. 개요

### 1.1 제품 소개
Tennis Tab은 테니스 대회 생성, 참가 신청, 클럽 관리 및 커뮤니티 기능을 제공하는 웹 서비스입니다.

### 1.2 목표
- 테니스 대회 개최 및 참가 프로세스 간소화
- 테니스 클럽 및 회원 관리 효율화
- 테니스 커뮤니티 활성화를 위한 소셜 기능 제공

### 1.3 대상 사용자
- 테니스 대회 주최자
- 테니스 대회 참가자
- 테니스 클럽 운영자
- 일반 테니스 동호인

---

## 2. 핵심 기능

### 2.1 회원 관리

#### 2.1.1 회원가입/로그인
- 이메일 기반 회원가입
- 소셜 로그인 (Google, Kakao)
- 비밀번호 찾기/재설정

#### 2.1.2 프로필 관리
- 기본 정보 (이름, 프로필 이미지, 연락처)
- 테니스 관련 정보 (실력 수준, 주 사용 손, 선호 포지션)
- 소속 클럽 정보
- 대회 참가 이력

---

### 2.2 대회 관리

#### 2.2.1 대회 생성
- **기본 정보**
  - 대회명
  - 대회 설명
  - 대회 일시 (시작일, 종료일)
  - 대회 장소
  - 대회 포스터 이미지

- **참가 설정**
  - 참가비
  - 최대 참가 인원
  - 참가 자격 조건 (실력 수준, 성별, 연령 등)
  - 신청 기간

- **대회 형식**
  - 토너먼트 (싱글 엘리미네이션, 더블 엘리미네이션)
  - 리그전
  - 조별 리그 + 토너먼트
  - 단식/복식/혼합복식

#### 2.2.2 대회 참가 신청
- 대회 목록 조회 (필터링: 지역, 날짜, 대회 형식)
- 대회 상세 정보 확인
- 참가 신청
- 신청 취소
- 참가비 결제 (선택적)

#### 2.2.3 대회 운영
- 참가자 명단 관리
- 대진표 생성 및 관리
- 경기 결과 입력
- 순위/결과 발표

#### 2.2.4 대회 상태
- `DRAFT` - 작성 중
- `OPEN` - 모집 중
- `CLOSED` - 모집 마감
- `IN_PROGRESS` - 진행 중
- `COMPLETED` - 종료
- `CANCELLED` - 취소

---

### 2.3 클럽 관리

#### 2.3.1 클럽 생성
- 클럽명
- 클럽 소개
- 클럽 로고/이미지
- 활동 지역
- 정기 모임 정보

#### 2.3.2 회원 관리
- 회원 초대 (초대 링크, 이메일)
- 회원 승인/거절
- 회원 역할 관리 (관리자, 일반 회원)
- 회원 탈퇴 처리

#### 2.3.3 클럽 역할
- `OWNER` - 클럽 소유자 (생성자)
- `ADMIN` - 관리자
- `MEMBER` - 일반 회원

---

### 2.4 포스트 (커뮤니티)

#### 2.4.1 포스트 작성
- 제목
- 본문 (텍스트, 이미지)
- 카테고리 (대회 후기, 정보 공유, 자유 게시판 등)
- 연관 대회 태그 (선택적)

#### 2.4.2 포스트 상호작용
- **좋아요**
  - 좋아요 추가/취소
  - 좋아요 수 표시
  - 좋아요 한 사용자 목록

- **댓글**
  - 댓글 작성
  - 댓글 수정/삭제
  - 대댓글 (1단계 depth)
  - 댓글 좋아요

#### 2.4.3 포스트 관리
- 수정/삭제 (작성자 본인)
- 신고 기능
- 검색 (제목, 내용)

---

## 3. 데이터 모델

### 3.1 User (사용자)
| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 고유 ID |
| email | string | 이메일 |
| password | string | 비밀번호 (해시) |
| name | string | 이름 |
| profileImage | string | 프로필 이미지 URL |
| phone | string | 연락처 |
| skillLevel | enum | 실력 수준 |
| createdAt | datetime | 가입일 |

### 3.2 Tournament (대회)
| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 고유 ID |
| title | string | 대회명 |
| description | text | 대회 설명 |
| startDate | datetime | 시작일 |
| endDate | datetime | 종료일 |
| location | string | 장소 |
| maxParticipants | number | 최대 참가 인원 |
| entryFee | number | 참가비 |
| status | enum | 대회 상태 |
| format | enum | 대회 형식 |
| organizerId | string | 주최자 ID |
| createdAt | datetime | 생성일 |

### 3.3 TournamentEntry (대회 참가)
| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 고유 ID |
| tournamentId | string | 대회 ID |
| userId | string | 참가자 ID |
| status | enum | 신청 상태 |
| createdAt | datetime | 신청일 |

### 3.4 Club (클럽)
| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 고유 ID |
| name | string | 클럽명 |
| description | text | 클럽 소개 |
| logo | string | 로고 URL |
| region | string | 활동 지역 |
| ownerId | string | 소유자 ID |
| createdAt | datetime | 생성일 |

### 3.5 ClubMember (클럽 회원)
| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 고유 ID |
| clubId | string | 클럽 ID |
| userId | string | 회원 ID |
| role | enum | 역할 |
| joinedAt | datetime | 가입일 |

### 3.6 Post (포스트)
| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 고유 ID |
| title | string | 제목 |
| content | text | 본문 |
| category | enum | 카테고리 |
| authorId | string | 작성자 ID |
| tournamentId | string | 연관 대회 ID (선택) |
| createdAt | datetime | 작성일 |
| updatedAt | datetime | 수정일 |

### 3.7 Like (좋아요)
| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 고유 ID |
| userId | string | 사용자 ID |
| postId | string | 포스트 ID |
| createdAt | datetime | 생성일 |

### 3.8 Comment (댓글)
| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 고유 ID |
| content | text | 댓글 내용 |
| authorId | string | 작성자 ID |
| postId | string | 포스트 ID |
| parentId | string | 부모 댓글 ID (대댓글) |
| createdAt | datetime | 작성일 |

---

## 4. 페이지 구조

```
/                           # 홈 (대회 목록, 최신 포스트)
├── /auth
│   ├── /login              # 로그인
│   ├── /register           # 회원가입
│   └── /forgot-password    # 비밀번호 찾기
├── /tournaments
│   ├── /                   # 대회 목록
│   ├── /create             # 대회 생성
│   ├── /[id]               # 대회 상세
│   └── /[id]/manage        # 대회 관리 (주최자용)
├── /clubs
│   ├── /                   # 클럽 목록
│   ├── /create             # 클럽 생성
│   ├── /[id]               # 클럽 상세
│   └── /[id]/manage        # 클럽 관리 (관리자용)
├── /posts
│   ├── /                   # 포스트 목록
│   ├── /create             # 포스트 작성
│   └── /[id]               # 포스트 상세
├── /profile
│   ├── /                   # 내 프로필
│   ├── /edit               # 프로필 수정
│   └── /[id]               # 다른 사용자 프로필
└── /my
    ├── /tournaments        # 내 대회 (참가/주최)
    └── /clubs              # 내 클럽
```

---

## 5. 기술 스택

### 5.1 Frontend
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand / React Query
- **Form**: React Hook Form + Zod

### 5.2 Backend
- **API**: Next.js API Routes / Server Actions
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: NextAuth.js

### 5.3 Infrastructure
- **Hosting**: Vercel
- **Database**: Supabase / PlanetScale
- **Storage**: Cloudflare R2 / AWS S3
- **Payment**: 토스페이먼츠 (선택적)

---

## 6. MVP 범위

### Phase 1 - 핵심 기능
- [ ] 회원가입/로그인
- [ ] 대회 생성 및 조회
- [ ] 대회 참가 신청
- [ ] 기본 프로필 관리

### Phase 2 - 클럽 기능
- [ ] 클럽 생성
- [ ] 클럽 회원 관리
- [ ] 클럽별 대회 연동

### Phase 3 - 커뮤니티 기능
- [ ] 포스트 작성/조회
- [ ] 좋아요 기능
- [ ] 댓글 기능

### Phase 4 - 고급 기능
- [ ] 대진표 자동 생성
- [ ] 결제 연동
- [ ] 알림 기능
- [ ] 통계/대시보드

---

## 7. 비기능 요구사항

### 7.1 성능
- 페이지 로딩 시간 3초 이내
- API 응답 시간 500ms 이내

### 7.2 보안
- HTTPS 적용
- 비밀번호 암호화
- SQL Injection 방지
- XSS 방지

### 7.3 접근성
- 모바일 반응형 디자인
- 웹 접근성 가이드라인 준수

---

## 8. 용어 정의

| 용어 | 정의 |
|------|------|
| Tournament | 테니스 대회 |
| Entry | 대회 참가 신청 |
| Club | 테니스 클럽/동호회 |
| Post | 커뮤니티 게시글 |
| Bracket | 대진표 |
