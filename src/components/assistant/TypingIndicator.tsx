"use client";

export function TypingIndicator() {
  return (
    <div className="flex items-center space-x-1 px-4 py-3">
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">Analyzing grounded data...</span>
    </div>
  );
}
