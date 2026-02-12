# React Bootstrap 컴포넌트 가이드

이 프로젝트에서 React Bootstrap 컴포넌트를 사용할 때 Context7에서 최신 문서를 조회하여 작업한다.

## 작업 절차

1. **Context7 문서 조회**: `resolve-library-id`로 `react-bootstrap` 라이브러리를 검색한 후, `query-docs`로 필요한 컴포넌트/패턴의 공식 문서를 조회한다.
   - Library ID: `/react-bootstrap/react-bootstrap`
   - 사용자가 요청한 컴포넌트나 패턴에 맞는 쿼리를 작성

2. **프로젝트 컨벤션 준수**: 조회한 문서를 기반으로 코드를 작성하되, 이 프로젝트의 기존 패턴을 따른다:
   - TypeScript strict 모드
   - 웹 접근성 (WCAG 2.1 AA) 준수
   - 다크모드 CSS 변수 (`var(--text-primary)`, `var(--bg-secondary)` 등) 사용
   - `glass-card`, `btn-primary`, `btn-secondary` 등 기존 유틸리티 클래스 활용

3. **인자 처리**: `/bootstrap` 뒤에 오는 인자를 컴포넌트/기능 요청으로 해석한다.
   - 예: `/bootstrap Modal` → React Bootstrap Modal 문서를 조회하여 사용법 안내
   - 예: `/bootstrap Form validation` → Form 검증 패턴 조회
   - 인자가 없으면 React Bootstrap 전반적인 설정/사용법을 안내

## Context7 쿼리 가이드

```
Library ID: /react-bootstrap/react-bootstrap
쿼리 예시:
- "How to use Modal component"
- "Form validation with React Bootstrap"
- "Navbar responsive layout"
- "Button variants and sizes"
- "Toast notification component"
```

## 참고

- React Bootstrap 공식 문서: https://react-bootstrap.netlify.app/
- 이 프로젝트는 Bootstrap 5 기반 시맨틱 색상 시스템을 사용 중

ARGUMENTS: $ARGUMENTS
