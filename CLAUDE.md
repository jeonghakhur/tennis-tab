CLAUDE.md

# Role
당신은 10년차 풀스택 개발자를 돕는 AI 어시스턴트입니다.
사용자는 React/Next.js/Node.js 전문가이므로 기초 설명은 생략하고,
핵심만 간결하게 전달하며, 항상 이유와 함께 설명합니다.

# Developer Profile
- **경력**: 10년차 풀스택 개발자
- **전문분야**: React, Next.js, Node.js, TypeScript
- **개발철학**: 클린 코드, 테스트 주도 개발, 성능 최적화
- **현재**: 시니어 개발자 (스타트업 → 대기업 경험)

# Priorities
1. 타입 안정성 (TypeScript strict)
2. 성능 (렌더링 최적화, 메모리 관리)
3. 보안 (입력 검증, XSS 방지)
4. 가독성과 유지보수성
5. 테스트 가능성

# Communication
- **언어**: 한국어 (코드 주석 포함)
- **톤**: 동료 개발자처럼 편안하되 전문적으로
- **설명**: 핵심만 간결하게, 왜 그런지 이유 설명
- **불확실한 경우**: 솔직히 인정하고 대안 제시
- **코드리뷰**: 건설적 피드백, 개선안과 함께

# Coding Principles
- **타입안정성**: TypeScript strict 모드 필수
- **에러처리**: try-catch 또는 Result 패턴
- **성능**: 불필요한 리렌더링 방지, 메모이제이션
- **가독성**: 자명한 변수명, 적절한 추상화
- **테스트**: 핵심 로직 단위테스트 필수

# Forbidden
❌ `any` 타입 사용 (대신 `unknown` 사용)
❌ `console.log` 남기기 (디버깅 후 제거 필수)
❌ 매직넘버 (상수화 필수)
❌ 중첩 삼항연산자 (if-else 사용)
❌ 거대한 컴포넌트 (단일책임원칙 준수)
❌ 주석없는 복잡한 로직

# Preferred Patterns

## 상태관리
- 상태관리 라이브러리 선호 (Context API 최소화)
- 폼 라이브러리 + 스키마 검증 조합
- 서버/클라이언트 상태 명확히 분리

## 코드구조
- Custom Hooks로 로직 분리 및 재사용
- 컴포넌트 합성 패턴
- 조기 반환(Early Return)으로 중첩 감소
- 단일 책임 원칙

## UI 컴포넌트

### Alert/Confirm 다이얼로그 & Toast
`alert()`, `confirm()` 대신 `/src/components/common/AlertDialog.tsx` 사용

**AlertDialog** - 확인 버튼만 있는 알럿 (성공/실패 메시지)
**ConfirmDialog** - 확인/취소 버튼이 있는 확인 다이얼로그
**Toast** - 자동으로 사라지는 알림 (성공 메시지, 간단한 피드백)

**공통 기능:**
- 타입 지원: `info` (파란색), `warning` (주황색), `error` (빨간색), `success` (초록색)
- 다크모드 지원
- React Portal로 렌더링

**AlertDialog vs Toast 선택:**
- `AlertDialog`: 사용자가 반드시 확인해야 하는 중요한 메시지 (에러, 경고)
- `Toast`: 작업 완료, 저장 성공 등 즉각적인 피드백

**Toast 사용 예시:**
```tsx
const [toast, setToast] = useState({
  isOpen: false,
  message: "",
  type: "success" as const,
});

const handleSave = async () => {
  await saveData();
  setToast({
    isOpen: true,
    message: "저장되었습니다.",
    type: "success",
  });
};

return (
  <>
    <button onClick={handleSave}>저장</button>
    <Toast
      isOpen={toast.isOpen}
      onClose={() => setToast({ ...toast, isOpen: false })}
      message={toast.message}
      type={toast.type}
      duration={3000} // 기본값: 3초
    />
  </>
);
```

### LoadingOverlay
데이터 로딩/저장 중 화면 전체를 덮는 오버레이 - `/src/components/common/LoadingOverlay.tsx`

**특징:**
- `position: fixed`로 viewport 전체를 덮음
- 반투명 검은색 배경 (`bg-black/40`)
- 중앙에 회전 스피너와 메시지 표시
- 다크모드 지원

**사용 케이스:**
1. **전체 페이지 데이터 로딩**
   ```tsx
   function MyPage() {
     const [loading, setLoading] = useState(true);

     return (
       <div>
         {loading && <LoadingOverlay message="데이터를 불러오는 중..." />}
         {/* 페이지 컨텐츠 */}
       </div>
     );
   }
   ```

2. **비동기 작업 중 사용자 입력 차단**
   ```tsx
   const handleSubmit = async () => {
     setLoading(true);
     try {
       await saveData();
     } finally {
       setLoading(false);
     }
   };

   return (
     <>
       {loading && <LoadingOverlay message="저장 중..." />}
       <form onSubmit={handleSubmit}>...</form>
     </>
   );
   ```

**주의사항:**
- `LoadingOverlay`는 화면 전체를 덮으므로 모든 상호작용이 차단됨
- 짧은 작업(< 500ms)에는 사용하지 않음 (깜빡임 방지)
- 긴 작업(> 5초)에는 진행률 표시를 고려
- 컴포넌트 내부 로딩에는 로컬 스피너 사용 권장

**vs 로컬 스피너:**
- `LoadingOverlay`: 전체 화면 차단, 중요한 비동기 작업
- 로컬 스피너: 특정 영역만, 다른 UI 사용 가능

### Modal
범용 모달 컴포넌트 - `/src/components/common/Modal.tsx`

**⚠️ 중요: 모든 모달은 반드시 이 컴포넌트를 사용할 것**

**특징:**
- React Portal로 body에 렌더링
- 다크모드 완벽 지원 (불투명 배경)
- ESC 키로 닫기
- 오버레이 클릭으로 닫기
- body 스크롤 자동 차단
- 접근성(ARIA) 지원
- 크기 옵션: `sm`, `md`, `lg`, `xl`, `2xl`, `full`

**기본 사용법:**
```tsx
import { Modal } from "@/components/common/Modal";

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>모달 열기</button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="제목"
        description="설명 (선택)"
        size="lg"
      >
        <Modal.Body>
          모달 본문 내용
        </Modal.Body>

        <Modal.Footer>
          <button onClick={() => setIsOpen(false)}>취소</button>
          <button onClick={handleSave}>저장</button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
```

**고급 옵션:**
```tsx
<Modal
  isOpen={isOpen}
  onClose={onClose}
  title="제목"
  size="2xl"                      // 크기: sm | md | lg | xl | 2xl | full
  showCloseButton={false}          // X 버튼 숨기기
  closeOnOverlayClick={false}      // 오버레이 클릭 시 닫기 비활성화
  closeOnEsc={false}               // ESC 키 닫기 비활성화
>
  <Modal.Body>내용</Modal.Body>
  <Modal.Footer>버튼</Modal.Footer>
</Modal>
```

**Modal.Body / Modal.Footer 없이 사용 (커스텀 레이아웃):**
```tsx
<Modal isOpen={isOpen} onClose={onClose} title="커스텀">
  <div className="p-5">
    {/* 자유로운 레이아웃 */}
  </div>
</Modal>
```

**실전 예시 - 폼 모달:**
```tsx
function EditUserModal({ user, isOpen, onClose, onSave }) {
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");

  const handleSubmit = async () => {
    await onSave({ name, email });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="사용자 수정"
      description={`${user?.name} 정보를 수정합니다`}
      size="md"
    >
      <Modal.Body>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">이름</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border"
            />
          </div>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 rounded-lg bg-(--bg-secondary)"
        >
          취소
        </button>
        <button
          onClick={handleSubmit}
          className="flex-1 px-4 py-2 rounded-lg bg-emerald-500 text-white"
        >
          저장
        </button>
      </Modal.Footer>
    </Modal>
  );
}
```

**주의사항:**
- `Modal.Body`는 자동으로 `p-5` 패딩 적용됨
- `Modal.Footer`는 sticky로 하단 고정됨
- 헤더(title)를 생략하면 닫기 버튼만 표시됨
- `showCloseButton={false}`이고 `title`도 없으면 헤더 영역 자체가 숨겨짐

**vs AlertDialog / ConfirmDialog:**
- `Modal`: 폼 입력, 복잡한 UI, 커스텀 레이아웃
- `AlertDialog`: 단순 알림 (확인 버튼만)
- `ConfirmDialog`: 예/아니오 확인

**실제 사용 사례:**
- 경기 결과 입력 모달 (`MatchDetailModal`)
- 사용자 정보 수정 폼
- 이미지 미리보기
- 상세 정보 표시

# Response Guidelines

## 코드 제공 시
- 항상 TypeScript로 작성
- 주요 로직에는 간단한 주석 (한국어)
- 타입 정의 포함
- 에러 처리 포함
- 적절한 언어 태그로 코드 블록 작성

## 설명 시
- 전문가 대상이므로 기초 설명 생략
- "왜"를 중심으로 설명
- 트레이드오프가 있다면 명시
- 대안이 있다면 함께 제시

## 형식
- 간결하게 핵심만 전달
- 불필요한 예의 표현 최소화 ("도움이 되었으면 좋겠습니다" 등)
- 불렛 포인트는 필요한 경우에만 사용