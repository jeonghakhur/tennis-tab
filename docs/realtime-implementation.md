# 실시간 점수 반영 기능 구현

## 개요
Supabase Realtime을 사용하여 점수 입력, 코트 정보 변경 등이 **즉시 모든 화면에 반영**되도록 구현했습니다.

## 구현 내용

### 1. useMatchesRealtime Hook 생성
**파일**: `src/lib/realtime/useMatchesRealtime.ts`

```typescript
export function useMatchesRealtime({
  bracketConfigId,
  onMatchUpdate,
  enabled,
})
```

**기능**:
- `bracket_matches` 테이블의 변경사항을 실시간으로 감지
- `bracket_config_id` 필터로 특정 대진표만 구독
- 점수, 코트 정보, 경기 상태 변경 감지
- `onMatchUpdate` 콜백으로 로컬 상태 즉시 업데이트

**Realtime 필터**:
```javascript
{
  event: '*',                    // INSERT, UPDATE, DELETE 모두 감지
  schema: 'public',
  table: 'bracket_matches',
  filter: `bracket_config_id=eq.${bracketConfigId}`,
}
```

### 2. BracketManager 통합
**파일**: `src/components/admin/BracketManager/index.tsx`

**변경 사항**:
1. Hook import
   ```typescript
   import { useMatchesRealtime } from "@/lib/realtime/useMatchesRealtime";
   ```

2. 상태 업데이트 핸들러 추가
   ```typescript
   const handleMatchUpdate = useCallback((updatedMatch: BracketMatch) => {
     // 예선 경기 업데이트
     setPreliminaryMatches((prev) =>
       prev.map((m) => (m.id === updatedMatch.id ? updatedMatch : m))
     );
     // 본선 경기 업데이트
     setMainMatches((prev) =>
       prev.map((m) => (m.id === updatedMatch.id ? updatedMatch : m))
     );
   }, []);
   ```

3. Hook 활성화
   ```typescript
   useMatchesRealtime({
     bracketConfigId: config?.id || "",
     onMatchUpdate: handleMatchUpdate,
     enabled: !!config?.id,
   });
   ```

4. 점수 입력 후 불필요한 리페치 제거
   ```typescript
   // Before: await loadBracketData();
   // After: showSuccess("경기 결과가 저장되었습니다.");
   // Realtime이 자동으로 처리
   ```

### 3. BracketView 통합 (사용자 대진표)
**파일**: `src/components/tournaments/BracketView.tsx`

관리자 영역과 동일하게 Realtime을 구독하여, **다른 선수가 입력한 점수도 실시간으로 확인** 가능합니다.

## 동작 원리

```
사용자 점수 입력
    ↓
updateMatchResult() — Server Action
    ↓
DB 저장 (bracket_matches 업데이트)
    ↓
Supabase Realtime 감지
    ↓
postgres_changes 이벤트 발생
    ↓
구독중인 모든 클라이언트에 브로드캐스트
    ↓
onMatchUpdate 콜백 실행
    ↓
로컬 상태 즉시 업데이트
    ↓
화면에 반영 (리페치 불필요)
```

## 장점

| 개선 사항 | 효과 |
|----------|------|
| **자동 리페치 제거** | 불필요한 네트워크 요청 감소 |
| **즉시 반영** | 점수 입력 후 모든 탭/화면에 실시간 동기화 |
| **다중 사용자 지원** | 관리자/선수 모두 다른 사람의 변경사항 실시간 감지 |
| **코트 정보도 동기화** | 점수뿐 아니라 코트 정보도 실시간 반영 |
| **네트워크 효율** | 폴링 대신 이벤트 기반 push |

## 테스트 방법

### 관리자 화면
1. `/admin/tournaments/[id]/bracket` 접속
2. 두 개 이상의 브라우저 탭 열기
3. 한 탭에서 점수 입력 → 다른 탭에서 자동 반영되는지 확인

### 사용자 대진표
1. `/tournaments/[id]/bracket` 접속 (여러 탭)
2. 한 탭에서 점수 입력 → 다른 탭에서 즉시 반영 확인

## 세부 구현 사항

### Supabase 환경 설정
Realtime이 활성화되어 있어야 합니다 (기본값: 활성화).

### 성능 최적화
- **bracketConfigId 필터**: 불필요한 대진표 변경사항 감지 방지
- **enabled prop**: config 로드 완료 후에만 구독 시작
- **useCallback**: 불필요한 구독 재생성 방지

## 주의 사항

1. **Realtime은 비동기**: DB 저장 완료 후 약간의 지연(보통 < 100ms)
2. **오프라인 사용자**: Realtime 연결 끊김 시 수동 새로고침 필요
3. **많은 동시 경기**: 하나의 대회 내 여러 부서가 있어도 필터로 효율적 처리

## 코드 스냅샷

### Before (자동 리페치)
```typescript
const handleMatchResult = async (...) => {
  setLoading(true);
  try {
    const { error } = await updateMatchResult(...);
    if (error) showError(...);
    else await loadBracketData(); // 전체 데이터 리페치
  } finally {
    setLoading(false);
  }
};
```

### After (Realtime)
```typescript
const handleMatchResult = async (...) => {
  try {
    const { error } = await updateMatchResult(...);
    if (error) showError(...);
    else showSuccess("경기 결과가 저장되었습니다.");
    // Realtime이 자동으로 handleMatchUpdate() 호출
  } catch { ... }
};
```

## 향후 개선 사항

1. **낙관적 업데이트** (Optimistic Update): UI를 서버 응답 전에 미리 업데이트
2. **연결 상태 표시**: "실시간 연결 중..." 배너
3. **충돌 감지**: 동시에 같은 경기 수정 시 경고
4. **오프라인 대기열**: 인터넷 복구 후 변경사항 자동 동기화
