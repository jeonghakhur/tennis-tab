"use client";

interface LoadingOverlayProps {
  message?: string;
}

export function LoadingOverlay({ message = "저장 중..." }: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 border-4 border-gray-200 dark:border-gray-700 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-transparent border-t-blue-600 rounded-full animate-spin"></div>
        </div>
        <p className="text-gray-900 dark:text-white font-medium">{message}</p>
      </div>
    </div>
  );
}
