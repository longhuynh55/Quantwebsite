"use client";

import { Toaster as Sonner, toast } from "sonner";

// Re-export toast functions for convenience
export { toast };

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "group flex items-center gap-3 w-full p-4 rounded-xl shadow-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100",
          title: "text-sm font-medium",
          description: "text-sm text-gray-500 dark:text-gray-400",
          actionButton: "bg-blue-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors",
          cancelButton: "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors",
          success: "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20",
          error: "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20",
          warning: "border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20",
          info: "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20",
        },
      }}
      richColors
      closeButton
    />
  );
}

// Convenience functions with icons
export const showSuccess = (message: string, description?: string) => {
  toast.success(message, { description });
};

export const showError = (message: string, description?: string) => {
  toast.error(message, { description });
};

export const showWarning = (message: string, description?: string) => {
  toast.warning(message, { description });
};

export const showInfo = (message: string, description?: string) => {
  toast.info(message, { description });
};

export const showLoading = (message: string) => {
  return toast.loading(message);
};

export const dismissToast = (toastId?: string | number) => {
  toast.dismiss(toastId);
};
