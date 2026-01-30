# Tennis Tab 🎾

자연어 기반 인터페이스로 테니스 대회를 관리하는 웹 서비스

## 🌟 주요 기능

- **자연어 인터페이스**: "이번 주 서울 대회 뭐 있어?" 같은 자연스러운 대화로 서비스 이용
- **대회 관리**: 대회 생성, 참가 신청, 대진표 관리
- **소셜 로그인**: 네이버/카카오 간편 로그인
- **실시간 업데이트**: 경기 결과 실시간 반영
- **다크/라이트 모드**: 사용자 선호에 맞는 테마

## 🛠 기술 스택

### Frontend
- **Next.js 16** - React 프레임워크 (App Router)
- **React 19** - UI 라이브러리
- **TypeScript** - 타입 안정성
- **Tailwind CSS 4** - 스타일링

### Backend & Infrastructure
- **Supabase** - PostgreSQL 데이터베이스 + 인증
- **OpenAI GPT-4o-mini** - 자연어 처리
- **Vercel** - 호스팅 (계획)

## 📦 설치 및 실행

### 1. 저장소 클론

```bash
git clone <repository-url>
cd tennis-tab
```

### 2. 의존성 설치

```bash
yarn install
```

### 3. Supabase 설정

상세한 Supabase 연동 가이드는 [docs/SUPABASE_SETUP.md](./docs/SUPABASE_SETUP.md)를 참고하세요.

간단 요약:
1. Supabase 프로젝트 생성
2. 데이터베이스 스키마 적용 (`supabase/migrations/00_initial_schema.sql`)
3. 네이버/카카오 OAuth 설정
4. 환경 변수 설정

### 4. 환경 변수 설정

`.env.local` 파일을 생성하고 다음 내용을 입력:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
OPENAI_API_KEY=sk-your-openai-key
```

### 5. 개발 서버 실행

```bash
yarn dev
```

브라우저에서 http://localhost:3000 접속

## 📁 프로젝트 구조

```
tennis-tab/
├── src/
│   ├── app/                    # Next.js App Router 페이지
│   │   ├── page.tsx           # 메인 랜딩 페이지
│   │   ├── layout.tsx         # 루트 레이아웃
│   │   ├── globals.css        # 전역 스타일
│   │   └── auth/              # 인증 관련 페이지
│   ├── components/            # 재사용 가능한 컴포넌트
│   │   ├── ThemeProvider.tsx # 테마 관리
│   │   ├── ThemeToggle.tsx   # 테마 토글 버튼
│   │   └── AuthProvider.tsx  # 인증 컨텍스트
│   ├── lib/                   # 유틸리티 함수
│   │   ├── supabase/         # Supabase 클라이언트
│   │   └── auth/             # 인증 관련 함수
│   └── middleware.ts          # Next.js 미들웨어
├── supabase/
│   └── migrations/            # 데이터베이스 마이그레이션
├── docs/                      # 문서
│   ├── PRD.md                # 제품 요구사항 문서
│   └── SUPABASE_SETUP.md     # Supabase 설정 가이드
└── public/                    # 정적 파일
```

## 📚 문서

- [PRD (제품 요구사항 문서)](./docs/PRD.md)
- [Supabase 연동 가이드](./docs/SUPABASE_SETUP.md)

## 🚀 배포

### Vercel 배포

```bash
yarn build
```

Vercel에 배포 시:
1. 프로젝트를 GitHub에 푸시
2. Vercel에서 프로젝트 import
3. 환경 변수 설정
4. 배포 완료!

## 🔐 환경 변수

| 변수명 | 설명 | 필수 |
|--------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 공개 키 | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 서비스 키 | ✅ |
| `NEXT_PUBLIC_SITE_URL` | 사이트 URL | ✅ |
| `OPENAI_API_KEY` | OpenAI API 키 | ⏳ (Phase 1) |

## 🗺 로드맵

### Phase 1 - MVP (현재)
- [x] 랜딩 페이지 UI
- [x] 테마 시스템
- [x] Supabase 연동
- [x] 소셜 로그인 (네이버/카카오)
- [ ] GPT-4o-mini 연동
- [ ] 자연어 대회 검색

### Phase 2 - 대회 참가
- [ ] 대회 참가 신청
- [ ] 참가 상태 확인
- [ ] 경기 결과 등록
- [ ] 내 경기 일정

### Phase 3 - 관리자 기능
- [ ] 대회 생성
- [ ] 대진표 생성
- [ ] 참가자 관리

### Phase 4 - 고급 기능
- [ ] 클럽 기능
- [ ] 커뮤니티
- [ ] 알림
- [ ] 통계/대시보드

## 🤝 기여

이슈와 Pull Request를 환영합니다!

## 📄 라이선스

ISC

## 📧 문의

프로젝트 관련 문의사항이 있으시면 이슈를 등록해주세요.
