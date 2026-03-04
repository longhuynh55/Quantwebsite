"use client";

import { useEffect, useRef, useState, useMemo } from "react";

interface UseScrollRevealOptions {
    /** IntersectionObserver threshold (0-1). Default: 0.15 */
    threshold?: number;
    /** Root margin for early/late trigger. Default: "0px" */
    rootMargin?: string;
    /** Once visible, stay visible. Default: true */
    once?: boolean;
}

/**
 * Hook that detects when an element scrolls into the viewport.
 * Returns a ref to attach and an isVisible boolean.
 *
 * Editorial design: subtle fade+slide animations, no bounce.
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
    options: UseScrollRevealOptions = {}
) {
    const { threshold = 0.15, rootMargin = "0px", once = true } = options;
    const ref = useRef<T>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    if (once) {
                        observer.unobserve(element);
                    }
                } else if (!once) {
                    setIsVisible(false);
                }
            },
            { threshold, rootMargin }
        );

        observer.observe(element);

        return () => {
            observer.disconnect();
        };
    }, [threshold, rootMargin, once]);

    return { ref, isVisible };
}
