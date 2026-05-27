# /commit — 코드 리뷰 후 커밋 & 푸시

커밋 전에 변경된 코드를 리뷰하고, 문제가 없을 때만 커밋 및 푸시를 진행합니다.

## 실행 순서

### 1단계 — 변경 사항 파악

```bash
git diff --stat HEAD
git status --short
```

변경된 파일 목록과 diff를 확인합니다.

### 2단계 — 코드 리뷰

변경된 각 파일에 대해 다음 항목을 검사합니다:

**버그 / 로직 오류**
- null/undefined 처리 누락
- 비동기 처리 오류 (await 누락, 에러 핸들링 없음)
- 타입 불일치

**보안**
- XSS, SQL Injection, Command Injection 취약점
- 민감 정보 하드코딩 (토큰, 비밀번호, API 키)
- `any` 타입 사용

**코드 품질**
- `console.log` 잔존 여부
- CLAUDE.md 금지 사항 위반 (lucide-react, Inter 폰트 등)
- 컴포넌트 300줄 초과
- 접근성 위반 (`div onClick` 등)

**리뷰 결과 출력 형식:**
```
## 코드 리뷰 결과

### 검사 파일: N개
| 파일 | 항목 | 심각도 | 내용 |
|------|------|--------|------|
| ... | ... | 🔴 Critical / 🟡 Warning / 🟢 Info | ... |

### 종합 판정: ✅ 통과 / ❌ 차단
```

### 3단계 — 판정에 따른 분기

**❌ Critical 이슈가 있으면:**
- 커밋을 중단합니다.
- 발견된 문제와 수정 방법을 안내합니다.
- 사용자가 수정 후 다시 `/commit`을 실행하도록 안내합니다.

**✅ 통과 (Warning/Info만 있거나 이슈 없음):**
- Warning 항목이 있다면 목록을 보여주고 계속 진행할지 AskUserQuestion으로 확인합니다.
- 사용자 확인 후 커밋 메시지를 작성합니다.

### 4단계 — 커밋 메시지 작성

변경 내용을 분석해 Conventional Commits 형식으로 메시지를 제안합니다:

```
<type>(<scope>): <요약> (한국어)

- 변경 내용 bullet 1
- 변경 내용 bullet 2
```

type: `feat` / `fix` / `refactor` / `style` / `chore` / `docs`

AskUserQuestion으로 메시지를 확인하거나 수정받습니다.

### 5단계 — 커밋 & 푸시

```bash
git add -A
git commit -m "<확정된 메시지>"
git push
```

푸시 완료 후 결과(브랜치명, 커밋 해시)를 출력합니다.
