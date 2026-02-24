"use client";

import { useRef, useState, memo, useCallback } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// 3D rotation constants
const ROTATION_FACTOR = 15;
const PERSPECTIVE = 1000;

interface FeatureCardProps {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly description: string;
  readonly features: readonly string[];
  readonly href: string;
  readonly gradient?: string;
  readonly className?: string;
}

export const FeatureCard = memo(function FeatureCard({
  icon: Icon,
  title,
  description,
  features,
  href,
  gradient = "from-blue-500 to-violet-600",
  className,
}: FeatureCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ rotateX: 0, rotateY: 0, scale: 1 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = (y - centerY) / ROTATION_FACTOR;
    const rotateY = (centerX - x) / ROTATION_FACTOR;

    setTransform({ rotateX, rotateY, scale: 1.02 });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTransform({ rotateX: 0, rotateY: 0, scale: 1 });
  }, []);

  return (
    <Link href={href} className={cn("block group", className)}>
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 transition-all duration-300 hover:shadow-2xl hover:shadow-violet-500/20 will-change-transform"
        style={{
          transform: `perspective(${PERSPECTIVE}px) rotateX(${transform.rotateX}deg) rotateY(${transform.rotateY}deg) scale(${transform.scale})`,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Glow effect on hover */}
        <div
          className={cn(
            "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 blur-2xl",
            `bg-gradient-to-r ${gradient}`
          )}
          style={{ transform: "scale(0.85)" }}
        />

        {/* Shine effect */}
        <div
          className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{
            background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.1) 45%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.1) 55%, transparent 60%)",
            transform: "translateX(-100%)",
            animation: "shine 1.5s ease-in-out infinite",
          }}
        />

        {/* Icon - with 3D lift effect */}
        <div
          className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br transition-transform duration-300 group-hover:translate-z-4",
            gradient
          )}
          style={{
            transform: "translateZ(20px)",
          }}
        >
          <Icon className="w-6 h-6 text-white" />
        </div>

        {/* Content */}
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{description}</p>

        {/* Features list */}
        <ul className="space-y-2 mb-4">
          {features.map((feature, index) => (
            <li key={index} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-blue-500 to-violet-500 flex-shrink-0" />
              {feature}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <div className="flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 group-hover:gap-2 transition-all">
          Thử ngay
          <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
});
