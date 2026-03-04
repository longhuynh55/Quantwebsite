"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ScrollReveal } from "../ui/ScrollReveal";

/**
 * Mid-page CTA section — placed after FeaturesSection to capture
 * users who are convinced by the features but haven't scrolled to pricing yet.
 * Editorial style: emerald bar with serif headline.
 */
export function MidPageCTA() {
    return (
        <section className="py-16 bg-emerald-700 dark:bg-emerald-900">
            <ScrollReveal>
                <div className="max-w-4xl mx-auto px-6 text-center">
                    <h3 className="font-serif text-3xl md:text-4xl font-bold text-white mb-4">
                        Sẵn Sàng Thử?
                    </h3>
                    <p className="font-sans text-emerald-100 text-lg mb-8 max-w-xl mx-auto">
                        Bắt đầu phân tích 400+ cổ phiếu HOSE ngay hôm nay.
                        Không cần thẻ tín dụng.
                    </p>
                    <Link
                        href="/dashboard"
                        className="group inline-flex items-center gap-3 px-8 py-4 bg-white dark:bg-neutral-900 text-stone-900 dark:text-white font-sans font-semibold text-sm uppercase tracking-wider hover:bg-stone-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                        Dùng Thử Miễn Phí
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                </div>
            </ScrollReveal>
        </section>
    );
}
