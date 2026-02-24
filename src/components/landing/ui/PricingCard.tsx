"use client";

import { useRef, useState, memo, useCallback } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

// 3D rotation constants
const ROTATION_FACTOR = 20;
const PERSPECTIVE = 800;

interface PricingFeature {
  readonly text: string;
  readonly included: boolean;
}

interface PricingCardProps {
  readonly name: string;
  readonly price: string;
  readonly period: string;
  readonly description?: string;
  readonly features: readonly PricingFeature[];
  readonly highlighted?: boolean;
  readonly buttonText: string;
  readonly buttonHref: string;
  readonly badge?: string;
  readonly className?: string;
}

export const PricingCard = memo(function PricingCard({
  name,
  price,
  period,
  description,
  features,
  highlighted = false,
  buttonText,
  buttonHref,
  badge,
  className,
}: PricingCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ rotateX: 0, rotateY: 0 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || !highlighted) return;

    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = (y - centerY) / ROTATION_FACTOR;
    const rotateY = (centerX - x) / ROTATION_FACTOR;

    setTransform({ rotateX, rotateY });
  }, [highlighted]);

  const handleMouseLeave = useCallback(() => {
    setTransform({ rotateX: 0, rotateY: 0 });
  }, []);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "relative rounded-2xl p-6 transition-all duration-300 will-change-transform",
        highlighted
          ? "bg-gradient-to-br from-violet-600 to-blue-600 text-white scale-105 shadow-2xl shadow-violet-500/30"
          : "bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 hover:shadow-xl hover:border-violet-200 dark:hover:border-violet-800",
        className
      )}
      style={{
        transform: highlighted
          ? `perspective(${PERSPECTIVE}px) rotateX(${transform.rotateX}deg) rotateY(${transform.rotateY}deg)`
          : undefined,
        transformStyle: "preserve-3d",
      }}
    >
      {/* Glow effect for highlighted card */}
      {highlighted && (
        <div
          className="absolute inset-0 rounded-2xl opacity-50 -z-10 blur-3xl"
          style={{
            background: "linear-gradient(135deg, #8B5CF6, #3B82F6)",
            transform: "scale(0.8)",
          }}
        />
      )}

      {/* Badge */}
      {badge && (
        <div
          className={cn(
            "absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold whitespace-nowrap",
            highlighted
              ? "bg-white text-violet-600 shadow-lg"
              : "bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400"
          )}
        >
          {badge}
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-6">
        <h3
          className={cn(
            "text-lg font-bold mb-2",
            highlighted ? "text-white" : "text-gray-900 dark:text-white"
          )}
        >
          {name}
        </h3>
        <div className="flex items-baseline justify-center gap-1">
          <span
            className={cn(
              "text-4xl font-bold",
              highlighted ? "text-white" : "text-gray-900 dark:text-white"
            )}
          >
            {price}
          </span>
          <span
            className={cn(
              "text-sm",
              highlighted ? "text-white/70" : "text-gray-500 dark:text-gray-400"
            )}
          >
            {period}
          </span>
        </div>
        {description && (
          <p
            className={cn(
              "text-sm mt-2",
              highlighted ? "text-white/70" : "text-gray-500 dark:text-gray-400"
            )}
          >
            {description}
          </p>
        )}
      </div>

      {/* Features */}
      <ul className="space-y-3 mb-6">
        {features.map((feature, index) => (
          <li key={index} className="flex items-center gap-3">
            <div
              className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-transform",
                highlighted
                  ? "bg-white/20"
                  : feature.included
                  ? "bg-emerald-100 dark:bg-emerald-900/30"
                  : "bg-gray-100 dark:bg-slate-800"
              )}
            >
              <Check
                className={cn(
                  "w-3 h-3",
                  highlighted
                    ? "text-white"
                    : feature.included
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-gray-400"
                )}
              />
            </div>
            <span
              className={cn(
                "text-sm",
                highlighted
                  ? "text-white/90"
                  : feature.included
                  ? "text-gray-700 dark:text-gray-300"
                  : "text-gray-400 dark:text-gray-500"
              )}
            >
              {feature.text}
            </span>
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      <Link
        href={buttonHref}
        className={cn(
          "block w-full py-3 px-4 rounded-xl text-center font-semibold transition-all",
          highlighted
            ? "bg-white text-violet-600 hover:bg-gray-100 hover:shadow-lg"
            : "bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-slate-700"
        )}
      >
        {buttonText}
      </Link>
    </div>
  );
});
