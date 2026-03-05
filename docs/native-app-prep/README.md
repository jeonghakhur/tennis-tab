# 네이티브 앱 개발 준비 문서

> Tennis Tab Next.js 프로젝트를 기반으로 Expo/React Native 앱 개발을 위한 준비 문서.
> 현재 코드베이스 재작성 없이 네이티브 앱 개발 시 레퍼런스로 활용.

---

## 문서 목록

| 문서 | 내용 |
|------|------|
| [native-screens.md](./native-screens.md) | 현재 페이지 → 모바일 화면 매핑, 각 화면별 UI/데이터/인터랙션 명세 |
| [shared-code.md](./shared-code.md) | 재사용 가능/변환 필요/재구현 필요 코드 분류 |
| [supabase-schema.md](./supabase-schema.md) | DB 스키마, 테이블 구조, RLS 정책 요약 |
| [project-structure.md](./project-structure.md) | 모노레포 vs 별도레포 결정, Expo 초기 설정 |

---

## 핵심 결정 사항 요약

### 포함/제외 화면
- **포함 (17개 화면)**: 대회, 클럽, 커뮤니티, 수상, 마이페이지, 인증
- **제외**: 어드민 전체 (`/admin/**`) — 웹 전용 유지
- **재설계 필요**: 결제 (`/payment`) — TossPayments 모바일 대응

### 공유 코드
- **그대로 재사용**: TypeScript 타입, 유틸 함수 5개, 브래킷 알고리즘
- **변환 필요**: Server Actions → Supabase JS 직접 호출, 인증 스토리지
- **재구현 필요**: 모든 UI 컴포넌트, TipTap 에디터, DnD (어드민 전용이라 불필요)

### 프로젝트 구조
- **단기**: 별도 레포 (`tennis-tab-mobile`)로 빠르게 시작
- **중기**: Turborepo 모노레포로 통합 (공유 코드 drift 발생 시)

### 기술 스택
- 라우팅: Expo Router v4
- 스타일: NativeWind v4 (Tailwind CSS 동일 API)
- 인증: Supabase + `expo-secure-store`
- 상태관리: Zustand (웹과 동일)
- 실시간: Supabase Realtime (`@supabase/supabase-js` — 웹과 동일 API)

---

## 실행 순서

1. ✅ 화면 인벤토리 문서 작성 (`native-screens.md`)
2. ✅ 공유 패키지 분석 (`shared-code.md`)
3. ✅ Supabase 스키마 문서화 (`supabase-schema.md`)
4. ✅ 프로젝트 구조 결정 (`project-structure.md`)
5. ⬜ `tennis-tab-mobile` 레포 생성 + Expo 초기 설정
6. ⬜ Supabase 연결 + 기본 인증 플로우 검증
7. ⬜ 화면 인벤토리 기반으로 화면 단위 개발
