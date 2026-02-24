"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { ArrowRight, Database, Brain, TrendingUp, Shield, BarChart3, Cpu, LineChart } from "lucide-react";

// Tree node data
const treeNodes = [
  { id: "data", label: "Data", icon: Database, x: 50, y: 85, color: "#10b981" },
  { id: "ohlcv", label: "OHLCV", icon: BarChart3, x: 25, y: 65, color: "#059669" },
  { id: "fundamentals", label: "Fundamentals", icon: Database, x: 75, y: 65, color: "#059669" },
  { id: "backtest", label: "Backtest", icon: LineChart, x: 15, y: 45, color: "#0891b2" },
  { id: "risk", label: "Risk", icon: Shield, x: 40, y: 45, color: "#0891b2" },
  { id: "portfolio", label: "Portfolio", icon: BarChart3, x: 60, y: 45, color: "#0891b2" },
  { id: "ai", label: "AI", icon: Brain, x: 85, y: 45, color: "#8b5cf6" },
  { id: "screener", label: "Screener", icon: Cpu, x: 25, y: 25, color: "#f59e0b" },
  { id: "optimize", label: "Optimize", icon: TrendingUp, x: 75, y: 25, color: "#f59e0b" },
  { id: "results", label: "Results", icon: TrendingUp, x: 50, y: 8, color: "#ef4444" },
];

const treeConnections = [
  ["data", "ohlcv"],
  ["data", "fundamentals"],
  ["ohlcv", "backtest"],
  ["ohlcv", "risk"],
  ["fundamentals", "portfolio"],
  ["fundamentals", "ai"],
  ["backtest", "screener"],
  ["risk", "screener"],
  ["portfolio", "optimize"],
  ["ai", "optimize"],
  ["screener", "results"],
  ["optimize", "results"],
];

function TreeNode({
  node,
  isActive,
  delay,
  onClick
}: {
  node: typeof treeNodes[0];
  isActive: boolean;
  delay: number;
  onClick: () => void;
}) {
  const Icon = node.icon;

  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
      className="cursor-pointer transition-all duration-500"
      style={{ animationDelay: `${delay}ms` }}
      onClick={onClick}
    >
      {/* Glow effect */}
      <circle
        r="12"
        fill={node.color}
        opacity={isActive ? 0.3 : 0}
        className="transition-opacity duration-300"
      >
        <animate
          attributeName="r"
          values="12;16;12"
          dur="2s"
          repeatCount="indefinite"
          begin={`${delay}ms`}
        />
      </circle>

      {/* Main circle */}
      <circle
        r="8"
        fill={isActive ? node.color : "#1f2937"}
        stroke={node.color}
        strokeWidth="2"
        className="transition-all duration-300"
      />

      {/* Icon */}
      <foreignObject x="-6" y="-6" width="12" height="12">
        <Icon
          className="w-3 h-3"
          style={{ color: isActive ? "#fff" : node.color }}
        />
      </foreignObject>

      {/* Label */}
      <text
        y="20"
        textAnchor="middle"
        className="fill-current text-[8px] font-medium uppercase tracking-wider"
        style={{ fill: isActive ? node.color : "#6b7280" }}
      >
        {node.label}
      </text>
    </g>
  );
}

function TreeConnection({
  start,
  end,
  isActive,
  delay
}: {
  start: typeof treeNodes[0];
  end: typeof treeNodes[0];
  isActive: boolean;
  delay: number;
}) {
  const pathD = `M ${start.x} ${start.y} Q ${(start.x + end.x) / 2} ${(start.y + end.y) / 2 - 5} ${end.x} ${end.y}`;

  return (
    <g>
      {/* Background path */}
      <path
        d={pathD}
        fill="none"
        stroke="#1f2937"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* Animated path */}
      <path
        d={pathD}
        fill="none"
        stroke={isActive ? "#10b981" : "#374151"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="100"
        strokeDashoffset={isActive ? 0 : 100}
        className="transition-all duration-1000"
        style={{ transitionDelay: `${delay}ms` }}
      />

      {/* Data pulse animation */}
      {isActive && (
        <circle r="2" fill="#10b981">
          <animateMotion
            dur="2s"
            repeatCount="indefinite"
            begin={`${delay}ms`}
          >
            <mpath href={`#${start.id}-${end.id}`} />
          </animateMotion>
        </circle>
      )}

      <animate
        href={`#${start.id}-${end.id}`}
        attributeName="stroke-dashoffset"
        from="100"
        to="0"
        dur="1s"
        begin={`${delay}ms`}
        fill="freeze"
      />
    </g>
  );
}

export function WorkTreeHero() {
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [isAnimated, setIsAnimated] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Trigger animation on mount
    const timer = setTimeout(() => setIsAnimated(true), 500);
    return () => clearTimeout(timer);
  }, []);

  const getNodeById = (id: string) => treeNodes.find(n => n.id === id);
  const activeNodeData = activeNode ? getNodeById(activeNode) : null;

  const nodeDescriptions: Record<string, { title: string; desc: string }> = {
    data: {
      title: "400+ Cổ Phiếu HOSE",
      desc: "7 năm dữ liệu lịch sử, cập nhật hàng ngày từ nguồn chính thức"
    },
    ohlcv: {
      title: "OHLCV Data",
      desc: "Giá mở, cao, thấp, đóng + khối lượng giao dịch hàng ngày"
    },
    fundamentals: {
      title: "Báo cáo tài chính",
      desc: "Bảng cân đối, P&L, lưu chuyển tiền tệ quarterly"
    },
    backtest: {
      title: "5 Chiến lược",
      desc: "SMA, EMA, RSI, Bollinger Bands, Momentum"
    },
    risk: {
      title: "Risk Metrics",
      desc: "VaR 95/99, CVaR, Max Drawdown, Sortino Ratio"
    },
    portfolio: {
      title: "Portfolio Optimization",
      desc: "Modern Portfolio Theory, Efficient Frontier"
    },
    ai: {
      title: "GLM 4.7 Flash",
      desc: "AI assistant hiểu tiếng Việt, trả lời tức thì"
    },
    screener: {
      title: "Smart Screener",
      desc: "Lọc cổ phiếu theo 50+ chỉ tiêu kỹ thuật & cơ bản"
    },
    optimize: {
      title: "Auto Optimization",
      desc: "Tự động tìm thông số tối ưu cho chiến lược"
    },
    results: {
      title: "Visual Results",
      desc: "Equity curve, drawdown chart, trade log chi tiết"
    },
  };
  const activeNodeDescription = activeNode ? nodeDescriptions[activeNode] : undefined;

  return (
    <section className="relative min-h-screen bg-neutral-950 overflow-hidden font-sans">
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(to right, #1f2937 1px, transparent 1px),
            linear-gradient(to bottom, #1f2937 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Radial gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at 50% 50%, transparent 0%, #0a0a0a 70%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="w-12 h-px bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />
            <span className="text-xs font-mono uppercase tracking-[0.2em] text-emerald-400">
              Neural Finance Platform
            </span>
            <div className="w-12 h-px bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />
          </div>

          <h1
            className="text-5xl md:text-7xl font-bold tracking-tight mb-6"
            style={{
              fontFamily: "'Playfair Display', serif",
              color: "#fff",
              textShadow: "0 0 60px rgba(16, 185, 129, 0.3)",
            }}
          >
            Quant<span className="text-emerald-400">VN</span>
          </h1>

          <p className="text-lg md:text-xl text-neutral-400 max-w-2xl mx-auto leading-relaxed">
            Nền tảng phân tích định lượng cho thị trường chứng khoán Việt Nam.
            <br />
            <span className="text-emerald-400">Click vào các node</span> để khám phá workflow.
          </p>
        </div>

        {/* Interactive Tree Visualization */}
        <div
          ref={containerRef}
          className="relative mx-auto"
          style={{ maxWidth: "600px", aspectRatio: "4/3" }}
        >
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Connections */}
            {treeConnections.map(([startId, endId], idx) => {
              const start = getNodeById(startId);
              const end = getNodeById(endId);
              if (!start || !end) return null;

              const isConnectedToActive =
                activeNode === startId ||
                activeNode === endId ||
                (activeNode === null && isAnimated);

              return (
                <TreeConnection
                  key={`${startId}-${endId}`}
                  start={start}
                  end={end}
                  isActive={isConnectedToActive}
                  delay={idx * 100}
                />
              );
            })}

            {/* Nodes */}
            {treeNodes.map((node, idx) => (
              <TreeNode
                key={node.id}
                node={node}
                isActive={activeNode === node.id || (activeNode === null && isAnimated)}
                delay={idx * 150}
                onClick={() => setActiveNode(activeNode === node.id ? null : node.id)}
              />
            ))}
          </svg>
        </div>

        {/* Active Node Info Panel */}
        <div
          className={`
            mx-auto mt-8 max-w-md transition-all duration-500
            ${activeNode ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
          `}
        >
          {activeNodeData && activeNodeDescription && (
            <div className="border border-neutral-800 bg-neutral-900/80 backdrop-blur p-6">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-8 h-8 flex items-center justify-center"
                  style={{ backgroundColor: activeNodeData.color }}
                >
                  <activeNodeData.icon className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white">
                  {activeNodeDescription.title}
                </h3>
              </div>
              <p className="text-sm text-neutral-400 leading-relaxed">
                {activeNodeDescription.desc}
              </p>
            </div>
          )}
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row justify-center gap-4 mt-12">
          <Link
            href="/dashboard"
            className="group inline-flex items-center justify-center gap-3 px-8 py-4 bg-emerald-600 text-white font-semibold text-sm uppercase tracking-wider hover:bg-emerald-500 transition-all"
            style={{
              boxShadow: "0 0 30px rgba(16, 185, 129, 0.3)",
            }}
          >
            Bắt đầu phân tích
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="#features"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 border border-neutral-700 text-neutral-300 font-semibold text-sm uppercase tracking-wider hover:border-emerald-500 hover:text-emerald-400 transition-all"
          >
            Xem tính năng
          </Link>
        </div>

        {/* Stats bar */}
        <div className="mt-16 pt-8 border-t border-neutral-800">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: "400+", label: "Cổ phiếu" },
              { value: "7 năm", label: "Dữ liệu" },
              { value: "50+", label: "Chỉ báo" },
              { value: "5", label: "Chiến lược" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl font-bold text-emerald-400 mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
                  {stat.value}
                </div>
                <div className="text-xs font-mono uppercase tracking-wider text-neutral-500">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-neutral-950 to-transparent" />
    </section>
  );
}
