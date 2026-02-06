"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface AlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmText?: string;
  type?: "info" | "warning" | "error" | "success";
}

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: "info" | "warning" | "error" | "success";
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

  useEffect(() => {
    setMounted(true);
  }, []);

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
        className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full relative shadow-2xl"
        style={{ zIndex: 10000 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          {title}
        </h3>
        <p
          className="text-gray-600 dark:text-gray-400 mb-6"
          style={{ whiteSpace: "pre-line" }}
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

  useEffect(() => {
    setMounted(true);
  }, []);

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
        className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full relative shadow-2xl"
        style={{ zIndex: 10000 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          {title}
        </h3>
        <p
          className="text-gray-600 dark:text-gray-400 mb-6"
          style={{ whiteSpace: "pre-line" }}
        >
          {message}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl py-3 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
