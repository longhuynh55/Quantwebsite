import Link from "next/link";
import { TrendingUp, Github, Linkedin, Twitter, Mail } from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gradient-to-b from-gray-900 to-gray-950 text-white">
      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand Column */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center space-x-3 group mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-xl tracking-tight">QuantVN</span>
                <span className="text-[10px] text-gray-400 font-medium -mt-1">Quantitative Finance</span>
              </div>
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              A comprehensive quantitative finance platform for analyzing the Vietnamese stock market (HOSE). Backtest strategies, optimize portfolios, and explore factor investing.
            </p>
            <div className="flex space-x-3">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center justify-center transition-colors"
              >
                <Github className="w-4 h-4 text-gray-400" />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center justify-center transition-colors"
              >
                <Linkedin className="w-4 h-4 text-gray-400" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center justify-center transition-colors"
              >
                <Twitter className="w-4 h-4 text-gray-400" />
              </a>
            </div>
          </div>

          {/* Tools Column */}
          <div>
            <h3 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Tools</h3>
            <ul className="space-y-3">
              {[
                { href: "/screener", label: "Stock Screener", desc: "Filter by indicators" },
                { href: "/backtesting", label: "Strategy Backtesting", desc: "Test trading strategies" },
                { href: "/charts", label: "Interactive Charts", desc: "Technical analysis" },
                { href: "/portfolio", label: "Portfolio Optimization", desc: "Markowitz & more" },
              ].map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="group flex items-start"
                  >
                    <div>
                      <span className="text-gray-300 group-hover:text-white transition-colors text-sm font-medium">
                        {item.label}
                      </span>
                      <p className="text-gray-500 text-xs">{item.desc}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Analysis Column */}
          <div>
            <h3 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Analysis</h3>
            <ul className="space-y-3">
              {[
                { href: "/factors", label: "Factor Investing", desc: "Momentum, value, size" },
                { href: "/risk", label: "Risk Management", desc: "VaR, drawdowns, volatility" },
                { href: "/ml-lab", label: "ML Laboratory", desc: "Machine learning models" },
              ].map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="group flex items-start"
                  >
                    <div>
                      <span className="text-gray-300 group-hover:text-white transition-colors text-sm font-medium">
                        {item.label}
                      </span>
                      <p className="text-gray-500 text-xs">{item.desc}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources Column */}
          <div>
            <h3 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Resources</h3>
            <ul className="space-y-3">
              {[
                { href: "/learn", label: "Learning Hub", desc: "Start learning quant" },
                { href: "/learn/what-is-quant", label: "What is Quant Finance?", desc: "Beginner guide" },
                { href: "/learn/technical-indicators", label: "Technical Indicators", desc: "Deep dive" },
              ].map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="group flex items-start"
                  >
                    <div>
                      <span className="text-gray-300 group-hover:text-white transition-colors text-sm font-medium">
                        {item.label}
                      </span>
                      <p className="text-gray-500 text-xs">{item.desc}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>

            {/* Newsletter */}
            <div className="mt-8 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
              <h4 className="font-medium text-white text-sm mb-2">Stay Updated</h4>
              <p className="text-gray-400 text-xs mb-3">Get notified about new features and updates.</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="Email address"
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors">
                  <Mail className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <span>&copy; {currentYear} QuantVN. All rights reserved.</span>
              <span className="hidden md:inline">|</span>
              <span className="hidden md:inline">Data from HOSE 2020-2025</span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <Link href="/learn" className="text-gray-400 hover:text-white transition-colors">
                Documentation
              </Link>
              <Link href="#" className="text-gray-400 hover:text-white transition-colors">
                Privacy
              </Link>
              <Link href="#" className="text-gray-400 hover:text-white transition-colors">
                Terms
              </Link>
            </div>
          </div>
          <div className="mt-4 text-center text-xs text-gray-500">
            <p>
              <strong>Disclaimer:</strong> This platform is for educational and research purposes only.
              It is not intended as financial advice. Always do your own research before making investment decisions.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
