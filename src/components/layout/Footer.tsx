import Link from "next/link";
import { TrendingUp, Github, Linkedin, Twitter, Mail } from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-stone-50 dark:bg-neutral-950 border-t border-stone-200 dark:border-neutral-900 mt-auto">
      <div className="max-w-full px-6 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand Column */}
          <div className="lg:col-span-2 space-y-6">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 bg-emerald-700 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-900/20">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-xl tracking-tight text-stone-900 dark:text-white">QuantVN</span>
                <span className="text-[10px] text-stone-400 dark:text-neutral-500 font-bold uppercase tracking-widest -mt-1">Analytics Platform</span>
              </div>
            </Link>
            <p className="text-stone-500 dark:text-neutral-400 text-sm leading-relaxed max-w-sm">
              Advanced quantitative engine for the Vietnamese equity market. 
              Built for traders, researchers, and portfolio managers who demand precision and institutional-grade data.
            </p>
            <div className="flex space-x-4">
              {[Github, Linkedin, Twitter, Mail].map((Icon, i) => (
                <a key={i} href="#" className="w-8 h-8 rounded-lg bg-stone-100 dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 flex items-center justify-center text-stone-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:border-emerald-200 dark:hover:border-emerald-800 transition-all">
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Column 1: Analytics */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Market Analysis</h3>
            <ul className="space-y-2">
              {[
                { label: "Stock Screener", href: "/screener" },
                { label: "Technical Charts", href: "/charts" },
                { label: "Factor Rankings", href: "/factors" },
                { label: "Risk Analytics", href: "/risk" },
              ].map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-stone-600 dark:text-neutral-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 2: Strategies */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Quantitative</h3>
            <ul className="space-y-2">
              {[
                { label: "Backtest Engine", href: "/backtesting" },
                { label: "Portfolio Solver", href: "/portfolio" },
                { label: "ML Laboratory", href: "/ml-lab" },
                { label: "Indicator API", href: "/api" },
              ].map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-stone-600 dark:text-neutral-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Legal/Misc */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Platform</h3>
            <ul className="space-y-2">
              {[
                { label: "Documentation", href: "/learn" },
                { label: "Data Quality", href: "#" },
                { label: "Privacy Policy", href: "#" },
                { label: "Terms of Service", href: "#" },
              ].map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-stone-600 dark:text-neutral-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-16 pt-8 border-t border-stone-200 dark:border-neutral-900 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-6">
            <span className="text-xs text-stone-400">&copy; {currentYear} QuantVN Lab. All rights reserved.</span>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-tight">API Operational</span>
            </div>
          </div>
          
          <div className="text-[10px] text-stone-400 dark:text-neutral-500 italic max-w-md text-center md:text-right leading-relaxed">
            Market data provided by HOSE (2018-2025). This platform is for informational and educational purposes only. 
            Financial markets carry risk; execute strategies at your own discretion.
          </div>
        </div>
      </div>
    </footer>
  );
}
