# Plan: 카카오톡 공유 기능 (kakao-share)

## 개요

대회 상세 페이지(`/tournaments/[id]`)와 커뮤니티 포스트 상세 페이지(`/community/[id]`)에
카카오톡 공유 버튼을 추가하여 사용자가 콘텐츠를 손쉽게 외부에 공유할 수 있도록 한다.

## 배경 및 목적

- 테니스 대회 정보를 카카오톡으로 지인에게 공유하는 수요가 높음
- 커뮤니티 포스트 공유를 통한 신규 사용자 유입 기대
- 카카오 JS SDK는 무료이며 국내 점유율 1위 메신저와 연동 가능

## 범위 (Scope)

### In-Scope
- **대회 상세** (`/tournaments/[id]`): 카카오톡 공유 버튼
  - 공유 내용: 대회명, 날짜, 장소, 썸네일(대회 이미지 or 기본 이미지), 링크
- **커뮤니티 포스트 상세** (`/community/[id]`): 카카오톡 공유 버튼
  - 공유 내용: 포스트 제목, 내용 미리보기(100자), 작성자, 링크
- 공유 버튼 공통 컴포넌트 (`KakaoShareButton`)

### Out-of-Scope
- 클럽 상세 공유 (추후 검토)
- 카카오 로그인 연동 (별도 feature)
- 링크 미리보기 이미지 서버 생성 (OG 이미지)

## 기술 스택

| 항목 | 내용 |
|------|------|
| SDK | 카카오 JavaScript SDK (`@types/kakao.maps.d.ts` 없이 전역 Kakao 객체 사용) |
| 공유 타입 | `Kakao.Share.sendDefault` (피드 메시지) |
| 스크립트 로딩 | `next/script` (`strategy="afterInteractive"`) |
| 환경변수 | `NEXT_PUBLIC_KAKAO_JS_KEY` (JavaScript 앱 키) |

## 카카오 SDK 공유 메시지 구조

```
[피드 메시지]
┌─────────────────────────┐
│ [썸네일 이미지]           │
├─────────────────────────┤
│ 제목 (대회명 / 포스트 제목) │
│ 설명 (날짜·장소 / 내용 미리뷰) │
├─────────────────────────┤
│ [자세히 보기]  →  URL    │
└─────────────────────────┘
```

## 구현 계획

### 1단계: 환경 설정
- Kakao Developers에서 앱 생성 → JavaScript 앱 키 발급
- `.env.local`에 `NEXT_PUBLIC_KAKAO_JS_KEY` 추가
- `layout.tsx`에 카카오 SDK 스크립트 추가

### 2단계: 공통 컴포넌트
- `src/components/common/KakaoShareButton.tsx` 생성
  - props: `title`, `description`, `imageUrl?`, `linkUrl`, `buttonText?`
  - SDK init 상태 체크 (`window.Kakao?.isInitialized()`)
  - 로딩 전/실패 시 fallback: URL 복사

### 3단계: 페이지 적용
- `TournamentDetailPage` / `src/app/tournaments/[id]/page.tsx`
- `CommunityPostDetailPage` / `src/app/community/[id]/page.tsx`

## 요구사항

### 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-01 | 대회 상세 페이지에 카카오톡 공유 버튼 표시 |
| FR-02 | 커뮤니티 포스트 상세 페이지에 카카오톡 공유 버튼 표시 |
| FR-03 | 공유 클릭 시 피드 메시지 형태로 카카오톡 전송 |
| FR-04 | SDK 미로딩 시 링크 복사로 fallback |
| FR-05 | 비회원도 공유 버튼 사용 가능 |
| FR-06 | 모바일/PC 모두 동작 |

### 비기능 요구사항
- SDK 스크립트는 페이지 렌더링 블로킹 없이 `afterInteractive` 로드
- 공유 버튼은 기존 UI와 일관된 디자인 (emerald/테니스 테마)

## 예상 파일 변경

| 파일 | 변경 유형 | 내용 |
|------|----------|------|
| `src/app/layout.tsx` | 수정 | 카카오 SDK 스크립트 추가 |
| `src/components/common/KakaoShareButton.tsx` | 신규 | 공통 공유 버튼 컴포넌트 |
| `src/app/tournaments/[id]/page.tsx` | 수정 | 공유 버튼 삽입 |
| `src/app/community/[id]/page.tsx` | 수정 | 공유 버튼 삽입 |
| `.env.local` | 수정 | NEXT_PUBLIC_KAKAO_JS_KEY 추가 |
| `.env.example` | 수정 | 키 예시 추가 |

## 우선순위 및 일정

| 단계 | 내용 | 예상 공수 |
|------|------|---------|
| P1 | 환경 설정 + KakaoShareButton 컴포넌트 | 1h |
| P1 | 대회 상세 적용 | 0.5h |
| P1 | 커뮤니티 포스트 상세 적용 | 0.5h |
| P2 | OG 이미지 자동화 | 추후 |

## 성공 지표

- 공유 버튼 클릭 → 카카오톡 공유 창 정상 오픈
- SDK 미초기화 상태에서 URL 복사 fallback 동작
- 모바일 카카오앱에서 공유 후 링크 클릭 시 올바른 페이지 이동

## 참고

- 카카오 SDK 문서: https://developers.kakao.com/docs/latest/ko/message/js-link
- 공유 메시지 타입: Feed (피드), List, Commerce, Location 중 **Feed** 사용
