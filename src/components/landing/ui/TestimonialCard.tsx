"use client";

import { useRef, useState, memo, useCallback } from "react";
import { Star, Quote } from "lucide-react";
import { cn } from "@/lib/utils";

// 3D constants
const ROTATION_FACTOR = 25;
const PERSPECTIVE = 1000;

interface TestimonialCardProps {
  readonly quote: string;
  readonly author: string;
  readonly role: string;
  readonly location: string;
  readonly rating?: number;
  readonly className?: string;
}

export const TestimonialCard = memo(function TestimonialCard({
  quote,
  author,
  role,
  location,
  rating = 5,
  className,
}: TestimonialCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ rotateX: 0, rotateY: 0, translateY: 0 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = (y - centerY) / ROTATION_FACTOR;
    const rotateY = (centerX - x) / ROTATION_FACTOR;

    setTransform({ rotateX, rotateY, translateY: -4 });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTransform({ rotateX: 0, rotateY: 0, translateY: 0 });
  }, []);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "relative bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 transition-all duration-300 hover:shadow-xl hover:shadow-violet-500/10 hover:border-violet-200 dark:hover:border-violet-800 will-change-transform",
        className
      )}
      style={{
        transform: `perspective(${PERSPECTIVE}px) rotateX(${transform.rotateX}deg) rotateY(${transform.rotateY}deg) translateY(${transform.translateY}px)`,
      }}
    >
      {/* Quote icon */}
      <Quote className="absolute top-4 right-4 w-8 h-8 text-gray-100 dark:text-slate-800" />

      {/* Quote */}
      <blockquote className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mb-4 relative z-10">
        &quot;{quote}&quot;
      </blockquote>

      {/* Author */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-violet-500/20">
          {author.charAt(0)}
        </div>
        <div>
          <div className="font-semibold text-gray-900 dark:text-white text-sm">{author}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{role}</div>
          <div className="text-xs text-gray-400 dark:text-gray-500">{location}</div>
        </div>
      </div>

      {/* Rating */}
      <div className="flex gap-0.5 mt-4" aria-label={`Rating: ${rating} out of 5 stars`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn(
              "w-4 h-4 transition-transform",
              i < rating
                ? "text-amber-400 fill-amber-400"
                : "text-gray-300 dark:text-gray-600"
            )}
            style={{ transitionDelay: `${i * 50}ms` }}
          />
        ))}
      </div>
    </div>
  );
});
