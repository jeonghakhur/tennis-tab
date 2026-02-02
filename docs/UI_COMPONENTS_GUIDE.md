# UI 컴포넌트 가이드

Tennis Tab 프로젝트에서 사용하는 UI 컴포넌트에 대한 가이드입니다.

## shadcn/ui

이 프로젝트는 [shadcn/ui](https://ui.shadcn.com/)를 사용하여 UI 컴포넌트를 관리합니다.

### 설치된 컴포넌트

- **Select**: 드롭다운 선택 컴포넌트

### 새 컴포넌트 추가하기

```bash
npx shadcn@latest add [컴포넌트명]
```

예시:
```bash
npx shadcn@latest add button
npx shadcn@latest add input
npx shadcn@latest add dialog
```

---

## Select 컴포넌트

### Import

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
```

### 기본 사용법

```tsx
<Select value={value} onValueChange={setValue}>
  <SelectTrigger className="w-full">
    <SelectValue placeholder="선택하세요" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">옵션 1</SelectItem>
    <SelectItem value="option2">옵션 2</SelectItem>
    <SelectItem value="option3">옵션 3</SelectItem>
  </SelectContent>
</Select>
```

### 프로젝트 테마 적용 예시

Tennis Tab의 다크/라이트 테마에 맞게 스타일을 적용하려면:

```tsx
<Select
  value={formData.skill_level}
  onValueChange={(value) => {
    setFormData((prev) => ({
      ...prev,
      skill_level: value,
    }));
  }}
>
  <SelectTrigger
    className="w-full h-12 px-4"
    style={{
      backgroundColor: "var(--bg-card)",
      border: "1px solid var(--border-color)",
      color: "var(--text-primary)",
    }}
  >
    <SelectValue placeholder="선택 안함" />
  </SelectTrigger>
  <SelectContent
    style={{
      backgroundColor: "var(--bg-secondary)",
      border: "1px solid var(--border-color)",
    }}
  >
    <SelectItem value="option1" style={{ color: "var(--text-primary)" }}>
      옵션 1
    </SelectItem>
    <SelectItem value="option2" style={{ color: "var(--text-primary)" }}>
      옵션 2
    </SelectItem>
  </SelectContent>
</Select>
```

### 옵션 배열로 렌더링하기

```tsx
const options = [
  { value: "1_YEAR", label: "1년" },
  { value: "2_YEARS", label: "2년" },
  { value: "3_YEARS", label: "3년" },
  // ...
];

<Select value={value} onValueChange={setValue}>
  <SelectTrigger className="w-full h-12 px-4">
    <SelectValue placeholder="선택하세요" />
  </SelectTrigger>
  <SelectContent>
    {options.map((option) => (
      <SelectItem key={option.value} value={option.value}>
        {option.label}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

### 빈 값 처리

shadcn Select는 빈 문자열("")을 value로 사용할 수 없습니다. 빈 값이 필요한 경우 "none"과 같은 placeholder 값을 사용하세요:

```tsx
const options = [
  { value: "none", label: "선택 안함" },
  { value: "option1", label: "옵션 1" },
];

// 저장 시 "none" 값 처리
const handleSubmit = () => {
  const actualValue = value === "none" ? undefined : value;
  // ...
};
```

### Props

#### Select
| Prop | Type | Description |
|------|------|-------------|
| `value` | `string` | 현재 선택된 값 |
| `onValueChange` | `(value: string) => void` | 값이 변경될 때 호출되는 콜백 |
| `defaultValue` | `string` | 기본 선택 값 |
| `disabled` | `boolean` | 비활성화 여부 |

#### SelectTrigger
| Prop | Type | Description |
|------|------|-------------|
| `className` | `string` | 추가 CSS 클래스 |
| `size` | `"sm" \| "default"` | 트리거 크기 |

#### SelectContent
| Prop | Type | Description |
|------|------|-------------|
| `position` | `"item-aligned" \| "popper"` | 드롭다운 위치 방식 |
| `align` | `"start" \| "center" \| "end"` | 정렬 방식 |

#### SelectItem
| Prop | Type | Description |
|------|------|-------------|
| `value` | `string` | 옵션 값 (필수, 고유해야 함) |
| `disabled` | `boolean` | 비활성화 여부 |

---

## 테마 변수 참조

프로젝트에서 사용하는 CSS 변수:

```css
/* 배경색 */
--bg-primary      /* 메인 배경 */
--bg-secondary    /* 보조 배경 */
--bg-card         /* 카드 배경 */
--bg-card-hover   /* 카드 호버 배경 */

/* 텍스트 */
--text-primary    /* 메인 텍스트 */
--text-secondary  /* 보조 텍스트 */
--text-muted      /* 비활성 텍스트 */

/* 테두리 */
--border-color    /* 기본 테두리 */
--border-accent   /* 강조 테두리 */

/* 강조색 */
--accent-color    /* 메인 강조색 */
--accent-hover    /* 강조색 호버 */
```

---

## 참고 자료

- [shadcn/ui 공식 문서](https://ui.shadcn.com/)
- [Radix UI Select 문서](https://www.radix-ui.com/primitives/docs/components/select)
