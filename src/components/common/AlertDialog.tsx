"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, X, AlertCircle, Info } from "lucide-react";

type DialogType = "info" | "warning" | "error" | "success";

const DEFAULT_TITLES: Record<DialogType, string> = {
  info: "알림",
  warning: "주의",
  error: "오류",
  success: "완료",
};

interface AlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  type?: DialogType;
}

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: DialogType;
  isLoading?: boolean;
}

/**
 * 알럿 다이얼로그 (확인 버튼만)
 */
export function AlertDialog({
  isOpen,
  onClose,
  title,
  message,
  confirmText = "확인",
  type = "info",
}: AlertDialogProps) {
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 다이얼로그 열릴 때 포커스 이동
  useEffect(() => {
    if (isOpen && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const typeStyles = {
    info: "bg-blue-600 hover:bg-blue-700",
    warning: "bg-amber-600 hover:bg-amber-700",
    error: "bg-red-600 hover:bg-red-700",
    success: "bg-emerald-600 hover:bg-emerald-700",
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4"
      style={{ zIndex: 9999 }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-message"
        tabIndex={-1}
        className="rounded-2xl p-6 max-w-md w-full relative shadow-2xl outline-none"
        style={{
          zIndex: 10000,
          backgroundColor: "var(--bg-secondary)",
          border: "1px solid var(--border-color)",
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        <h3
          id="alert-dialog-title"
          className="text-xl font-bold mb-4"
          style={{ color: "var(--text-primary)" }}
        >
          {title || DEFAULT_TITLES[type]}
        </h3>
        <p
          id="alert-dialog-message"
          className="mb-6"
          style={{ color: "var(--text-secondary)", whiteSpace: "pre-line" }}
        >
          {message}
        </p>
        <button
          onClick={onClose}
          className={`w-full ${typeStyles[type]} text-white rounded-xl py-3 font-medium transition-all`}
        >
          {confirmText}
        </button>
      </div>
    </div>,
    document.body,
  );
}

/**
 * 확인 다이얼로그 (예/아니오 버튼)
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "확인",
  cancelText = "취소",
  type = "info",
  isLoading = false,
}: ConfirmDialogProps) {
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const typeStyles = {
    info: "bg-blue-600 hover:bg-blue-700",
    warning: "bg-amber-600 hover:bg-amber-700",
    error: "bg-red-600 hover:bg-red-700",
    success: "bg-emerald-600 hover:bg-emerald-700",
  };

  const handleConfirm = () => {
    onConfirm();
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4"
      style={{ zIndex: 9999 }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        tabIndex={-1}
        className="rounded-2xl p-6 max-w-md w-full relative shadow-2xl outline-none"
        style={{
          zIndex: 10000,
          backgroundColor: "var(--bg-secondary)",
          border: "1px solid var(--border-color)",
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        <h3
          id="confirm-dialog-title"
          className="text-xl font-bold mb-4"
          style={{ color: "var(--text-primary)" }}
        >
          {title || DEFAULT_TITLES[type]}
        </h3>
        <p
          id="confirm-dialog-message"
          className="mb-6"
          style={{ color: "var(--text-secondary)", whiteSpace: "pre-line" }}
        >
          {message}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 rounded-xl py-3 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80"
            style={{
              backgroundColor: "var(--bg-card-hover)",
              color: "var(--text-secondary)",
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className={`flex-1 ${typeStyles[type]} text-white rounded-xl py-3 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isLoading ? "처리 중..." : confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Toast 알림 (자동으로 사라짐)
 */
interface ToastProps {
  isOpen: boolean;
  onClose: () => void;
  message: string;
  type?: "info" | "warning" | "error" | "success";
  duration?: number; // 밀리초, 기본 3초
}

export function Toast({
  isOpen,
  onClose,
  message,
  type = "success",
  duration = 3000,
}: ToastProps) {
  const [mounted, setMounted] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onClose, 300); // 애니메이션 시간
    }, duration);

    return () => clearTimeout(timer);
  }, [isOpen, duration, onClose]);

  if (!isOpen || !mounted) return null;

  const icons = {
    success: <Check className="w-5 h-5" />,
    error: <X className="w-5 h-5" />,
    warning: <AlertCircle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />,
  };

  const styles = {
    success: "bg-emerald-600 text-white",
    error: "bg-red-600 text-white",
    warning: "bg-amber-600 text-white",
    info: "bg-blue-600 text-white",
  };

  return createPortal(
    <div
      className="fixed top-4 right-4 flex items-center justify-center p-4"
      style={{ zIndex: 10001 }}
    >
      <div
        className={`${styles[type]} rounded-xl px-6 py-4 shadow-2xl flex items-center gap-3 min-w-[300px] max-w-md transition-all duration-300 ${
          isExiting
            ? "opacity-0 translate-y-[-20px]"
            : "opacity-100 translate-y-0"
        }`}
        style={{
          animation: isExiting ? "none" : "slideInDown 0.3s ease-out",
        }}
      >
        <div className="flex-shrink-0">{icons[type]}</div>
        <p className="flex-1 font-medium">{message}</p>
        <button
          onClick={() => {
            setIsExiting(true);
            setTimeout(onClose, 300);
          }}
          className="flex-shrink-0 hover:opacity-80 transition-opacity"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <style jsx>{`
        @keyframes slideInDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>,
    document.body,
  );
}
