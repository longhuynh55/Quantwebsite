"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface FAQItemProps {
  question: string;
  answer: string;
  defaultOpen?: boolean;
  className?: string;
}

export function FAQItem({ question, answer, defaultOpen = false, className }: FAQItemProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div
      className={cn(
        "border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden",
        className
      )}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-4 flex items-center justify-between gap-4 text-left hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <span className="font-medium text-gray-900 dark:text-white">{question}</span>
        <ChevronDown
          className={cn(
            "w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0 transition-transform duration-300",
            isOpen && "rotate-180"
          )}
        />
      </button>

      <div
        className={cn(
          "overflow-hidden transition-all duration-300",
          isOpen ? "max-h-96" : "max-h-0"
        )}
      >
        <div className="px-4 pb-4 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          {answer}
        </div>
      </div>
    </div>
  );
}
