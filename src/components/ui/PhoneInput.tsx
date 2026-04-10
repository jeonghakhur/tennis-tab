"use client";

import { useState, useEffect, Ref } from "react";
import { formatPhoneNumber, validatePhoneNumber } from "@/lib/utils/phone";

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  /** 읽기 전용 (ex. 로그인된 회원이 자기 번호 수정 못 하게 할 때) */
  readOnly?: boolean;
  /** 가이드 안내 문구 노출 여부 */
  showGuide?: boolean;
  /** 컨테이너 className */
  className?: string;
  /** input 요소에 직접 적용할 className (기존 폼 스타일 유지용) */
  inputClassName?: string;
  /** placeholder 오버라이드. 기본값 "010-0000-0000" */
  placeholder?: string;
  style?: React.CSSProperties;
  /** 에러 여부 외부에서 감지 */
  onValidationChange?: (isValid: boolean, error?: string) => void;
  /** 포커스 관리를 위한 외부 ref (callback ref 지원) */
  inputRef?: Ref<HTMLInputElement>;
  /** blur 이벤트 핸들러 */
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  /** 내장 에러 메시지 표시 여부 (기본 false — 대부분의 폼이 자체 에러 표시 사용) */
  showInlineError?: boolean;
}

/**
 * 전화번호 공용 입력 컴포넌트.
 *
 * 입력 즉시 숫자만 남기고 하이픈을 자동 삽입한다(`formatPhoneNumber`).
 * 실제 저장 시에는 호출부에서 `unformatPhoneNumber()`로 숫자만 추출해 저장한다.
 *
 * 기본 동작:
 * - 하이픈/공백/언더스코어/점 등 비숫자 문자는 onChange 시점에 즉시 제거
 * - 화면 표시는 `010-1234-5678` 하이픈 포맷
 * - 최대 13자(하이픈 포함) 제한
 * - type="tel", inputMode="numeric", autoComplete="tel"
 */
export default function PhoneInput({
  value,
  onChange,
  id = "phone",
  name = "phone",
  required = false,
  disabled = false,
  readOnly = false,
  showGuide = true,
  className = "",
  inputClassName = "",
  placeholder = "010-0000-0000",
  style,
  onValidationChange,
  inputRef,
  onBlur,
  showInlineError = false,
}: PhoneInputProps) {
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (touched || value) {
      const validation = validatePhoneNumber(value);
      if (validation === true) {
        setError(null);
        onValidationChange?.(true);
      } else {
        setError(validation);
        onValidationChange?.(false, validation);
      }
    }
  }, [value, touched, onValidationChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // formatPhoneNumber 내부에서 /\D/g 로 모든 비숫자 제거 후 하이픈 재삽입
    const formatted = formatPhoneNumber(e.target.value);
    onChange(formatted);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setTouched(true);
    onBlur?.(e);
  };

  // inputClassName이 주어지면 그것만 사용 (기존 폼 스타일 유지).
  // 없으면 PhoneInput 기본 스타일 적용.
  const hasCustomClass = inputClassName.length > 0;
  const defaultStyle: React.CSSProperties = hasCustomClass
    ? (style ?? {})
    : {
        backgroundColor: "var(--bg-card)",
        border: `1px solid ${error && touched ? "#ef4444" : "var(--border-color)"}`,
        color: "var(--text-primary)",
        ...style,
      };

  const inputClass = hasCustomClass
    ? inputClassName
    : `w-full px-4 py-3 rounded-lg outline-none transition-colors ${className}`;

  return (
    <div className={hasCustomClass ? "" : "w-full"}>
      <input
        ref={inputRef}
        type="tel"
        id={id}
        name={name}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        inputMode="numeric"
        autoComplete="tel"
        className={inputClass}
        style={defaultStyle}
        placeholder={placeholder}
        maxLength={13}
      />
      {showGuide && showInlineError && (
        <p
          className="text-xs mt-1"
          style={{ color: error && touched ? "#ef4444" : "var(--text-muted)" }}
        >
          {error && touched ? error : ""}
        </p>
      )}
    </div>
  );
}
