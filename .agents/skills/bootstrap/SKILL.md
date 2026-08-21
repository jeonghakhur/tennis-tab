---
name: bootstrap
description: React Bootstrap 컴포넌트 사용 시 Context7에서 공식 문서를 조회하여 작업. 컴포넌트 사용법, 설치, 레이아웃, 폼 등 React Bootstrap 관련 질문에 사용.
language: typescript,tsx
framework: react,nextjs,bootstrap
allowed-tools: Read, Write, Edit, Glob, Bash, WebFetch
---

# React Bootstrap 컴포넌트 가이드

React Bootstrap 컴포넌트를 사용할 때 Context7에서 최신 문서를 조회하여 작업한다.

## 작업 절차

1. **Context7 문서 조회**: `query-docs` 도구로 React Bootstrap 공식 문서를 조회한다.
   - Library ID: `/react-bootstrap/react-bootstrap`
   - 사용자가 요청한 컴포넌트나 패턴에 맞는 쿼리를 작성

2. **프로젝트 컨벤션 준수**: 조회한 문서를 기반으로 코드를 작성하되, 이 프로젝트의 기존 패턴을 따른다:
   - TypeScript strict 모드
   - 웹 접근성 (WCAG 2.1 AA) 준수
   - 다크모드 CSS 변수 (`var(--text-primary)`, `var(--bg-secondary)` 등) 사용
   - `glass-card`, `btn-primary`, `btn-secondary` 등 기존 유틸리티 클래스 활용

3. **인자 처리**: `/bootstrap` 뒤에 오는 인자($ARGUMENTS)를 컴포넌트/기능 요청으로 해석한다.
   - 예: `/bootstrap Modal` → React Bootstrap Modal 문서를 조회하여 사용법 안내
   - 예: `/bootstrap Form validation` → Form 검증 패턴 조회
   - 인자가 없으면 React Bootstrap 전반적인 설정/사용법을 안내

## Context7 쿼리 실행

반드시 아래 도구를 사용하여 문서를 조회한 후 답변한다:

```
도구: mcp__plugin_context7_context7__query-docs
libraryId: /react-bootstrap/react-bootstrap
query: (사용자 요청에 맞는 쿼리)
```

쿼리 예시:
- "How to use Modal component with hooks"
- "Form validation patterns"
- "Navbar responsive layout"
- "Button variants and sizes"
- "Accordion component usage"
- "Offcanvas sidebar component"

## 참고

- React Bootstrap 공식 문서: https://react-bootstrap.netlify.app/
- 이 프로젝트는 Bootstrap 5 기반 시맨틱 색상 시스템을 사용 중
- Bootstrap CSS는 글로벌로 로드됨

ARGUMENTS: $ARGUMENTS
