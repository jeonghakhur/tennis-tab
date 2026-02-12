# Plan: 클럽 가입 신청 시 자기소개 기능

## 1. 개요

### 배경
현재 클럽 가입 신청(APPROVAL 타입) 시 사용자 이름과 전화번호만 전달된다. 클럽 관리자 입장에서 신청자가 누구인지, 어떤 경력/실력인지 판단할 정보가 부족하여 승인/거절 결정이 어렵다.

### 목표
- 클럽 가입 신청 시 **자기소개글**을 작성할 수 있는 textarea 제공
- 클럽 관리자가 **가입 승인 대기** 목록에서 자기소개를 확인 가능
- OPEN 타입 클럽은 즉시 가입이므로 자기소개 입력 불필요 (선택적 표시)

### 범위

| 포함 | 제외 |
|------|------|
| `club_members` 테이블에 `introduction` 컬럼 추가 | 자기소개 수정 기능 (가입 후) |
| 가입 신청 시 자기소개 textarea UI | 프로필 자기소개 (별도 기능) |
| 관리자 대기 목록에서 자기소개 표시 | 자기소개 기반 자동 승인 |
| `joinClubAsRegistered()` 액션에 introduction 파라미터 추가 | 자기소개 검색/필터링 |

---

## 2. 데이터 모델

### 2.1 `club_members` 테이블 변경

```sql
-- 자기소개 컬럼 추가
ALTER TABLE club_members ADD COLUMN introduction TEXT;

-- 길이 제한 (500자)
ALTER TABLE club_members ADD CONSTRAINT club_members_introduction_length
  CHECK (introduction IS NULL OR char_length(introduction) <= 500);
```

- nullable: OPEN 타입이나 관리자 초대 등 자기소개 없이 가입하는 경우
- 500자 제한: DB 레벨 CHECK + 클라이언트/서버 검증

---

## 3. 영향 범위

### 3.1 Server Actions (`src/lib/clubs/actions.ts`)

| 함수 | 변경 내용 |
|------|----------|
| `joinClubAsRegistered(clubId)` | `joinClubAsRegistered(clubId, introduction?)` 파라미터 추가 |

- `introduction` 파라미터 추가 (optional string)
- sanitizeInput 적용
- 500자 초과 검증
- INSERT 시 `introduction` 컬럼에 저장

### 3.2 타입 (`src/lib/clubs/types.ts`)

| 변경 | 내용 |
|------|------|
| `ClubMember` 인터페이스 | `introduction: string \| null` 필드 추가 |

### 3.3 UI 컴포넌트

| 파일 | 변경 내용 |
|------|----------|
| `src/app/clubs/[id]/page.tsx` | APPROVAL 클럽 가입 시 자기소개 textarea 모달/섹션 추가 |
| `src/components/clubs/ClubMemberList.tsx` | PENDING 회원 목록에 자기소개 표시 |

### 3.4 검증 (`src/lib/utils/validation.ts`)

- `validateIntroduction(text)`: 500자 초과 검증 (optional 필드)

---

## 4. UI 설계

### 4.1 가입 신청 (clubs/[id]/page.tsx)

**APPROVAL 타입 클럽:**

현재: "가입 신청" 버튼 클릭 → 즉시 서버 액션 호출

변경: "가입 신청" 버튼 클릭 → **자기소개 입력 모달** → 확인 → 서버 액션 호출

```
┌────────────────────────────────┐
│  클럽 가입 신청                 │
│                                │
│  자기소개 (선택)                │
│  ┌──────────────────────────┐  │
│  │ 테니스 경력 3년차입니다.  │  │
│  │ 주로 주말에 활동하고...   │  │
│  │                          │  │
│  └──────────────────────────┘  │
│  0 / 500                       │
│                                │
│  [취소]          [가입 신청]    │
└────────────────────────────────┘
```

- textarea placeholder: "간단한 자기소개를 작성해주세요. (선택)"
- 글자수 카운터: `{현재} / 500`
- 빈 값 허용 (선택 입력)

**OPEN 타입 클럽:** 기존과 동일 (즉시 가입, 모달 없음)

### 4.2 관리자 가입 승인 대기 (ClubMemberList.tsx)

현재: 이름 + 전화번호만 표시

변경: 이름 + 전화번호 + **자기소개** 표시

```
┌─────────────────────────────────────┐
│ 가입 승인 대기 (2건)                 │
├─────────────────────────────────────┤
│ 홍길동  010-1234-5678               │
│ "테니스 경력 3년, 주말 활동 희망"    │
│                    [거절] [승인]     │
├─────────────────────────────────────┤
│ 김테니  010-9876-5432               │
│ (자기소개 없음)                      │
│                    [거절] [승인]     │
└─────────────────────────────────────┘
```

- 자기소개가 있으면 따옴표로 감싸서 표시
- 없으면 "(자기소개 없음)" 또는 생략

---

## 5. 구현 순서

| 단계 | 작업 | 복잡도 |
|------|------|--------|
| 1 | DB 마이그레이션 (introduction 컬럼 + CHECK 제약) | 낮음 |
| 2 | 타입 업데이트 (`ClubMember.introduction`) | 낮음 |
| 3 | Server Action 수정 (`joinClubAsRegistered`) | 낮음 |
| 4 | 가입 신청 모달 UI (`clubs/[id]/page.tsx`) | 중간 |
| 5 | 관리자 대기 목록에 자기소개 표시 (`ClubMemberList.tsx`) | 낮음 |
| 6 | TypeScript 검증 + 빌드 확인 | 낮음 |

---

## 6. 기술적 고려사항

### 보안
- `sanitizeInput()` 적용 (XSS 방지)
- DB CHECK 제약 + 서버 사이드 검증 (500자)
- 클라이언트 maxLength + 서버 이중 검증

### 접근성
- textarea에 `<label>` 연결 또는 `aria-label`
- 글자수 카운터는 `aria-live="polite"`로 스크린리더 대응

### 마이그레이션 안전성
- `ADD COLUMN ... NULL` — 기존 데이터 영향 없음
- 기본값 없이 nullable로 추가하므로 다운타임 없음

---

## 7. 검증 기준

- [ ] `club_members.introduction` 컬럼 추가 마이그레이션 성공
- [ ] APPROVAL 클럽 가입 신청 시 자기소개 모달 표시
- [ ] 자기소개 입력 후 가입 신청 → DB에 저장 확인
- [ ] 자기소개 없이도 가입 신청 가능 (선택 입력)
- [ ] 500자 초과 시 클라이언트 + 서버 검증 동작
- [ ] 관리자 승인 대기 목록에서 자기소개 확인 가능
- [ ] OPEN 클럽 가입 시 기존과 동일 (모달 없음)
- [ ] `tsc --noEmit` 통과
- [ ] `next build` 통과
