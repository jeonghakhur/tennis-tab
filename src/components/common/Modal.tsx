"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEsc?: boolean;
  children: React.ReactNode;
}

const SIZE_CLASSES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  full: "max-w-full mx-4",
} as const;

/**
 * 범용 모달 컴포넌트
 *
 * Portal을 사용하여 body에 직접 렌더링되며, 다크모드를 지원합니다.
 *
 * @example
 * ```tsx
 * <Modal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   title="제목"
 *   description="설명"
 *   size="lg"
 * >
 *   <Modal.Body>
 *     모달 본문 내용
 *   </Modal.Body>
 *   <Modal.Footer>
 *     <button onClick={onClose}>취소</button>
 *     <button onClick={onSave}>저장</button>
 *   </Modal.Footer>
 * </Modal>
 * ```
 */
export function Modal({
  isOpen,
  onClose,
  title,
  description,
  size = "md",
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEsc = true,
  children,
}: ModalProps) {
  // ESC 키로 닫기
  useEffect(() => {
    if (!isOpen || !closeOnEsc) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isOpen, closeOnEsc, onClose]);

  // body 스크롤 방지
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOverlayClick = () => {
    if (closeOnOverlayClick) {
      onClose();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 오버레이 */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={handleOverlayClick}
        aria-hidden="true"
      />

      {/* 모달 */}
      <div
        className={`relative w-full ${SIZE_CLASSES[size]} max-h-[90vh] overflow-y-auto rounded-2xl bg-(--bg-secondary) border border-(--border-color) shadow-2xl`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        aria-describedby={description ? "modal-description" : undefined}
      >
        {/* 헤더 */}
        {(title || description || showCloseButton) && (
          <div className="sticky top-0 z-10 flex items-start justify-between p-5 border-b border-(--border-color) bg-(--bg-secondary) rounded-t-2xl">
            <div className="flex-1">
              {title && (
                <h2
                  id="modal-title"
                  className="text-lg font-bold text-(--text-primary)"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p
                  id="modal-description"
                  className="text-sm text-(--text-secondary) mt-0.5"
                >
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-(--bg-secondary) transition-colors"
                aria-label="닫기"
              >
                <X className="w-5 h-5 text-(--text-muted)" />
              </button>
            )}
          </div>
        )}

        {/* 본문 */}
        {children}
      </div>
    </div>,
    document.body,
  );
}

// 서브 컴포넌트
Modal.Body = function ModalBody({ children }: { children: React.ReactNode }) {
  return <div className="p-5">{children}</div>;
};

Modal.Footer = function ModalFooter({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="sticky bottom-0 flex gap-3 p-5 border-t border-(--border-color) bg-(--bg-secondary) rounded-b-2xl">
      {children}
    </div>
  );
};
