"use client";

import { memo, useState } from "react";
import { Keyboard, X } from "lucide-react";
import { cn } from "@/lib/utils";

const shortcuts = [
    { keys: ["Delete"], action: "Delete selected node" },
    { keys: ["Ctrl", "Z"], action: "Undo" },
    { keys: ["Ctrl", "S"], action: "Save strategy" },
    { keys: ["Ctrl", "K"], action: "Search stocks / tools" },
    { keys: ["Ctrl", "+"], action: "Zoom in" },
    { keys: ["Ctrl", "−"], action: "Zoom out" },
    { keys: ["Ctrl", "0"], action: "Fit view" },
];

export const KeyboardShortcuts = memo(() => {
    const [isOpen, setIsOpen] = useState(false);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className={cn(
                    "fixed bottom-12 left-10 z-30",
                    "w-7 h-7 flex items-center justify-center",
                    "bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm",
                    "border border-stone-200 dark:border-neutral-700",
                    "rounded-lg shadow-sm",
                    "text-stone-500 dark:text-neutral-400",
                    "hover:text-stone-700 dark:hover:text-neutral-200",
                    "hover:bg-stone-50 dark:hover:bg-neutral-800",
                    "transition-all duration-200"
                )}
                title="Keyboard shortcuts"
            >
                <Keyboard className="w-4 h-4" />
            </button>
        );
    }

    return (
        <div
            className={cn(
                "fixed bottom-12 left-10 z-30",
                "w-56 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xl",
                "border border-stone-200 dark:border-neutral-700",
                "rounded-lg shadow-xl",
                "overflow-hidden",
                "animate-in fade-in slide-in-from-bottom-2 duration-200"
            )}
        >
            <div className="flex items-center justify-between px-3 py-2 border-b border-stone-100 dark:border-neutral-800">
                <div className="flex items-center gap-1.5">
                    <Keyboard className="w-3.5 h-3.5 text-stone-500 dark:text-neutral-400" />
                    <span className="text-xs font-semibold text-stone-700 dark:text-neutral-200">
                        Shortcuts
                    </span>
                </div>
                <button
                    onClick={() => setIsOpen(false)}
                    className="p-0.5 text-stone-400 hover:text-stone-600 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors"
                >
                    <X className="w-3 h-3" />
                </button>
            </div>

            <div className="py-1.5">
                {shortcuts.map((shortcut) => (
                    <div
                        key={shortcut.action}
                        className="flex items-center justify-between px-3 py-1"
                    >
                        <span className="text-[11px] text-stone-600 dark:text-neutral-400">
                            {shortcut.action}
                        </span>
                        <div className="flex items-center gap-0.5">
                            {shortcut.keys.map((key, i) => (
                                <span key={i}>
                                    <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-medium bg-stone-100 dark:bg-neutral-800 text-stone-600 dark:text-neutral-300 rounded border border-stone-200 dark:border-neutral-700 shadow-sm">
                                        {key}
                                    </kbd>
                                    {i < shortcut.keys.length - 1 && (
                                        <span className="text-[9px] text-stone-400 mx-0.5">+</span>
                                    )}
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
});

KeyboardShortcuts.displayName = "KeyboardShortcuts";
