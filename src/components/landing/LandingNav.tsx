"use client";

import { useState, useEffect, useCallback, memo } from "react";
import Link from "next/link";
import { Menu, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const SCROLL_THRESHOLD = 20;

const navLinks = [
  { kind: "route", href: "/strategy-builder", label: "Strategy Builder" },
  { kind: "route", href: "/ml-lab", label: "Strategy Lab" },
  { kind: "anchor", href: "#features", label: "Tính năng" },
  { kind: "anchor", href: "#pricing", label: "Bảng giá" },
  { kind: "anchor", href: "#faq", label: "FAQ" },
] as const;

export const LandingNav = memo(function LandingNav() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleScroll = useCallback(() => {
    setIsScrolled(window.scrollY > SCROLL_THRESHOLD);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        isScrolled
          ? "bg-stone-50/95 dark:bg-neutral-950/95 backdrop-blur-sm border-b border-stone-200 dark:border-neutral-800"
          : "bg-transparent"
      )}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-700 dark:bg-emerald-600" />

      <div className="max-w-6xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo - newspaper masthead style */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="font-serif text-xl font-bold text-stone-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
              <span className="text-emerald-700 dark:text-emerald-400">Q</span>uantVN
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) =>
              link.kind === "anchor" ? (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-xs font-sans uppercase tracking-wider text-stone-600 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white transition-colors"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-xs font-sans uppercase tracking-wider text-stone-600 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white transition-colors"
                >
                  {link.label}
                </Link>
              )
            )}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-xs font-sans uppercase tracking-wider text-stone-600 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white transition-colors"
            >
              Đăng nhập
            </Link>
            <Link
              href="/dashboard"
              className="group flex items-center gap-2 px-5 py-2.5 bg-emerald-700 dark:bg-emerald-600 text-white text-xs font-sans font-semibold uppercase tracking-wider hover:bg-emerald-800 dark:hover:bg-emerald-500 transition-colors"
            >
              Dùng thử
              <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={toggleMobileMenu}
            className="md:hidden p-2 text-stone-600 dark:text-neutral-400 hover:bg-stone-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div
        className={cn(
          "md:hidden overflow-hidden transition-all duration-300 bg-stone-50 dark:bg-neutral-950 border-t border-stone-200 dark:border-neutral-800",
          isMobileMenuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="px-6 py-4 space-y-4">
          {navLinks.map((link) =>
            link.kind === "anchor" ? (
              <a
                key={link.href}
                href={link.href}
                onClick={closeMobileMenu}
                className="block py-2 text-xs font-sans uppercase tracking-wider text-stone-600 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeMobileMenu}
                className="block py-2 text-xs font-sans uppercase tracking-wider text-stone-600 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white"
              >
                {link.label}
              </Link>
            )
          )}
          <div className="pt-4 border-t border-stone-200 dark:border-neutral-800 space-y-3">
            <Link
              href="/dashboard"
              className="block py-2 text-xs font-sans uppercase tracking-wider text-stone-600 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white"
              onClick={closeMobileMenu}
            >
              Đăng nhập
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-700 dark:bg-emerald-600 text-white text-xs font-sans font-semibold uppercase tracking-wider"
              onClick={closeMobileMenu}
            >
              Dùng thử
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
});
