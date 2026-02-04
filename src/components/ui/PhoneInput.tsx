"use client";

import { useState, useEffect } from "react";
import { formatPhoneNumber, validatePhoneNumber } from "@/lib/utils/phone";

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  showGuide?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onValidationChange?: (isValid: boolean, error?: string) => void;
}

export default function PhoneInput({
  value,
  onChange,
  id = "phone",
  name = "phone",
  required = false,
  disabled = false,
  showGuide = true,
  className = "",
  style,
  onValidationChange,
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
    const formatted = formatPhoneNumber(e.target.value);
    onChange(formatted);
  };

  const handleBlur = () => {
    setTouched(true);
  };

  const defaultStyle: React.CSSProperties = {
    backgroundColor: "var(--bg-card)",
    border: `1px solid ${error && touched ? "#ef4444" : "var(--border-color)"}`,
    color: "var(--text-primary)",
    ...style,
  };

  return (
    <div className="w-full">
      <input
        type="tel"
        id={id}
        name={name}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        required={required}
        disabled={disabled}
        inputMode="numeric"
        autoComplete="tel"
        className={`w-full px-4 py-3 rounded-lg outline-none transition-colors ${className}`}
        style={defaultStyle}
        placeholder="010-0000-0000"
        maxLength={13}
      />
      {showGuide && (
        <p
          className="text-xs mt-1"
          style={{ color: error && touched ? "#ef4444" : "var(--text-muted)" }}
        >
          {error && touched ? error : "휴대폰 번호를 입력하세요 (예: 010-1234-5678)"}
        </p>
      )}
    </div>
  );
}
