# 입력값 보안 가이드

## 개요

사용자 입력을 처리할 때 반드시 적용해야 하는 보안 규칙입니다. XSS(Cross-Site Scripting), SQL Injection 등의 공격을 방지하기 위한 필수 사항입니다.

## 🔒 핵심 원칙

### 1. 사용자 입력은 절대 신뢰하지 않는다
- 모든 사용자 입력은 검증 및 살균(sanitization) 필수
- 클라이언트 측 검증만으로는 부족 (서버 측 검증 필수)

### 2. 입력 타입에 따른 적절한 처리
- 텍스트: HTML 태그 제거, 스크립트 패턴 제거
- 숫자: 숫자 이외의 문자 제거
- 이메일/URL: 형식 검증

## 📝 구현 가이드

### 텍스트 입력 보안 검증

```typescript
/**
 * 텍스트 입력값 보안 검증 (XSS 방지)
 * @param value 사용자 입력값
 * @returns 검증된 안전한 문자열
 */
function sanitizeInput(value: string): string {
  // 1. HTML 태그 제거
  const withoutTags = value.replace(/<[^>]*>/g, '');
  
  // 2. 스크립트 패턴 제거
  const withoutScripts = withoutTags
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
  
  return withoutScripts.trim();
}

// 사용 예시
const userInput = sanitizeInput(formData.name);
```

### 숫자 입력 검증

```typescript
/**
 * 숫자 입력값 검증
 * @param value 사용자 입력값
 * @returns 숫자와 소수점만 포함된 문자열
 */
function validateNumericInput(value: string): string {
  // 숫자와 소수점만 허용
  return value.replace(/[^0-9.]/g, '');
}

// 사용 예시
const rating = validateNumericInput(formData.ntrp_rating);
```

### 전화번호 검증

```typescript
/**
 * 전화번호 포맷팅 및 검증
 * @param value 사용자 입력값
 * @returns 포맷팅된 전화번호 (010-1234-5678)
 */
function formatPhoneNumber(value: string): string {
  // 숫자만 추출
  const digits = value.replace(/\D/g, "");
  
  // 포맷팅
  if (digits.length <= 3) {
    return digits;
  } else if (digits.length <= 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  } else {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  }
}
```

## 🎯 HTML Input 속성 가이드

### inputMode 속성 사용

모바일 환경에서 적절한 키보드를 표시하기 위해 `inputMode` 속성을 사용합니다:

```typescript
// 숫자 입력 (전화번호, 점수 등)
<input
  type="text"
  inputMode="numeric"
  value={value}
  onChange={handleChange}
/>

// 이메일 입력
<input
  type="email"
  inputMode="email"
  value={value}
  onChange={handleChange}
/>

// URL 입력
<input
  type="url"
  inputMode="url"
  value={value}
  onChange={handleChange}
/>
```

### type vs inputMode

- `type`: 데이터 타입 정의, 브라우저 검증
- `inputMode`: 모바일 키보드 종류 지정

## ⚠️ 위험한 패턴

### 절대 사용하지 말아야 할 것들

```typescript
// ❌ 나쁜 예: dangerouslySetInnerHTML 사용
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// ❌ 나쁜 예: eval() 사용
eval(userInput);

// ❌ 나쁜 예: Function() 생성자
new Function(userInput)();

// ❌ 나쁜 예: 직접 SQL 쿼리 실행
db.query(`SELECT * FROM users WHERE name = '${userInput}'`);
```

### ✅ 안전한 대안

```typescript
// ✅ 좋은 예: 텍스트 콘텐츠로 표시
<div>{sanitizeInput(userInput)}</div>

// ✅ 좋은 예: Parameterized Query 사용
db.query('SELECT * FROM users WHERE name = $1', [userInput]);

// ✅ 좋은 예: ORM 사용 (Supabase, Prisma 등)
await supabase
  .from('profiles')
  .select('*')
  .eq('name', userInput);
```

## 📋 체크리스트

새로운 입력 필드를 추가할 때 확인해야 할 사항:

- [ ] `sanitizeInput()` 또는 적절한 검증 함수 적용
- [ ] 적절한 `inputMode` 속성 설정
- [ ] 서버 측 검증 구현
- [ ] 최대 길이 제한 설정
- [ ] 필수/선택 여부 명시
- [ ] 에러 메시지 처리

## 🔧 React Hook Form + Zod 예시

더 강력한 검증을 위해 `react-hook-form`과 `zod`를 사용하는 것을 권장합니다:

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const profileSchema = z.object({
  name: z.string()
    .min(1, '이름을 입력하세요')
    .max(50, '이름은 50자 이하여야 합니다')
    .transform(sanitizeInput),
  phone: z.string()
    .regex(/^010-\d{4}-\d{4}$/, '올바른 전화번호 형식이 아닙니다')
    .optional(),
  ntrp_rating: z.number()
    .min(1.0, 'NTRP 점수는 1.0 이상이어야 합니다')
    .max(7.0, 'NTRP 점수는 7.0 이하여야 합니다')
    .optional(),
});

const form = useForm({
  resolver: zodResolver(profileSchema),
});
```

## 🚨 보안 인시던트 대응

의심스러운 입력을 발견한 경우:

1. **로그 기록**: 모든 의심스러운 입력을 로깅
2. **차단**: 해당 사용자의 요청을 일시적으로 차단
3. **분석**: 패턴 분석 및 보안 강화
4. **업데이트**: 필요시 검증 로직 업데이트

## 📚 참고 자료

- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [React Security Best Practices](https://react.dev/learn/writing-markup-with-jsx#the-rules-of-jsx)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/auth/server-side/nextjs)

---

**이 가이드는 모든 새로운 기능 개발 시 반드시 준수해야 합니다.**
