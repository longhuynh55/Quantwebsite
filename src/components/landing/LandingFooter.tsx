import Link from "next/link";
import { Mail, MapPin, GraduationCap } from "lucide-react";

const footerLinks = {
  product: [
    { label: "Screener", href: "/screener" },
    { label: "Backtesting", href: "/backtesting" },
    { label: "Portfolio", href: "/portfolio" },
    { label: "Biểu đồ", href: "/charts" },
  ],
  resources: [
    { label: "Hướng dẫn", href: "/learn" },
    { label: "API", href: "/learn" },
  ],
};

export function LandingFooter() {
  return (
    <footer className="bg-stone-900 dark:bg-black text-white">
      {/* Top border */}
      <div className="h-1 bg-emerald-700 dark:bg-emerald-600" />

      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand - newspaper masthead style */}
          <div className="col-span-1 md:col-span-2">
            <Link href="/" className="inline-block mb-4">
              <span className="font-serif text-2xl font-bold">
                <span className="text-emerald-400">Q</span>uantVN
              </span>
            </Link>
            <p className="font-serif text-stone-400 dark:text-neutral-400 leading-relaxed max-w-sm mb-6">
              Nền tảng phân tích định lượng cho thị trường chứng khoán Việt Nam.
              Áp dụng Machine Learning và AI trong tài chính.
            </p>

            {/* UEL Badge */}
            <div className="flex items-center gap-3 mb-4 px-4 py-3 bg-stone-800/50 dark:bg-neutral-900/50 rounded-lg border border-stone-700 dark:border-neutral-800">
              <GraduationCap className="w-6 h-6 text-emerald-500" />
              <div>
                <p className="text-sm font-medium text-white">
                  Khóa luận tốt nghiệp 2026
                </p>
                <p className="text-xs text-stone-400">
                  Khoa Tài chính - Ngân hàng, ĐH Kinh tế - Luật (UEL)
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm text-stone-500 dark:text-neutral-500">
                <Mail className="w-4 h-4 text-emerald-600" />
                <span>contact@quantvn.vn</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-stone-500 dark:text-neutral-500">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <span>TP. Hồ Chí Minh, Việt Nam</span>
              </div>
            </div>
          </div>

          {/* Product Links */}
          <div>
            <div className="text-xs font-sans uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500 mb-4">
              Tính năng
            </div>
            <ul className="space-y-2">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-stone-400 dark:text-neutral-400 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources Links */}
          <div>
            <div className="text-xs font-sans uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500 mb-4">
              Tài nguyên
            </div>
            <ul className="space-y-2">
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-stone-400 dark:text-neutral-400 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-stone-800 dark:border-neutral-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs font-sans text-stone-500 dark:text-neutral-500">
            © 2026 QuantVN — Khóa luận tốt nghiệp, Đại học Kinh tế - Luật (UEL)
          </p>

          {/* Tech stack */}
          <div className="flex items-center gap-4 text-xs font-sans text-stone-600 dark:text-neutral-600">
            <span>Next.js</span>
            <span>•</span>
            <span>TypeScript</span>
            <span>•</span>
            <span>AI/ML</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
