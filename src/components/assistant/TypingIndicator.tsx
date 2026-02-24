"use client";

export function TypingIndicator() {
  return (
    <div className="flex items-center space-x-1 px-4 py-3">
      <div className="flex space-x-1">
        <div className="h-2 w-2 rounded-full bg-emerald-600 animate-bounce dark:bg-emerald-400" style={{ animationDelay: '0ms' }} />
        <div className="h-2 w-2 rounded-full bg-emerald-600 animate-bounce dark:bg-emerald-400" style={{ animationDelay: '150ms' }} />
        <div className="h-2 w-2 rounded-full bg-emerald-600 animate-bounce dark:bg-emerald-400" style={{ animationDelay: '300ms' }} />
      </div>
      <span className="ml-2 text-sm text-stone-500 dark:text-neutral-400">Analyzing grounded data...</span>
    </div>
  );
}
