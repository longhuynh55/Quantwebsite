import { notFound } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardContent, Badge, Button } from "@/components/ui";
import { ArrowLeft, Clock, BookOpen } from "lucide-react";

const TOPIC_CONTENT: Record<string, { title: string; level: "beginner" | "intermediate" | "advanced"; duration: string; content: string }> = {
  "what-is-quant": {
    title: "What is Quantitative Finance?",
    level: "beginner",
    duration: "10 min",
    content: `## Introduction to Quantitative Finance

Quantitative finance, or "quant finance," is the use of mathematical models, statistical analysis, and computer algorithms to analyze financial markets and make investment decisions.

### Key Concepts

**1. Data-Driven Approach**
- Quants rely on historical data to identify patterns
- Decisions are based on statistical evidence, not intuition
- Backtesting validates strategies before deployment

**2. Mathematical Models**
- Probability theory for risk assessment
- Statistical models for price prediction
- Optimization techniques for portfolio construction

**3. Algorithmic Implementation**
- Strategies are coded into executable algorithms
- Automated execution removes emotional bias
- High-frequency trading operates in milliseconds

### Applications in Vietnamese Market

- **Stock Screening:** Filter 500+ HOSE stocks by technical criteria
- **Portfolio Optimization:** Build efficient portfolios using Markowitz theory
- **Risk Management:** Calculate VaR and other risk metrics
- **Factor Investing:** Identify momentum and value opportunities`,
  },
  "reading-ohlcv": {
    title: "Reading OHLCV Data",
    level: "beginner",
    duration: "15 min",
    content: `## Understanding OHLCV Data

OHLCV stands for Open, High, Low, Close, Volume - the five key data points for any trading period.

### Components Explained

**Open:** The price at which trading began for the period
**High:** The highest price reached during the period
**Low:** The lowest price reached during the period
**Close:** The price at which trading ended for the period
**Volume:** The number of shares traded during the period

### Example from HOSE Data

\`\`\`
Symbol: AAA
Date: 2020-01-02
Open: 9.89
High: 10.01
Low: 9.81
Close: 9.89
Volume: 1,112,410
\`\`\`

### Interpreting the Data

**Candlestick Basics:**
- **Bullish candle:** Close > Open (price went up)
- **Bearish candle:** Close < Open (price went down)
- **Wicks/Shadows:** High and Low points

**Volume Analysis:**
- High volume confirms price movements
- Low volume suggests weak conviction
- Volume spikes often signal reversals`,
  },
  "technical-indicators": {
    title: "Technical Indicators Deep Dive",
    level: "intermediate",
    duration: "30 min",
    content: `## Technical Indicators Explained

Technical indicators are mathematical calculations based on price and volume data.

### Moving Averages

**Simple Moving Average (SMA):**
- Average of last N prices
- Common periods: 20, 50, 200 days
- Smooths out price noise

**Exponential Moving Average (EMA):**
- Weighted toward recent prices
- Reacts faster to price changes

### RSI (Relative Strength Index)

**Calculation:**
\`\`\`
RSI = 100 - 100 / (1 + RS)
RS = Average Gain / Average Loss
\`\`\`

**Interpretation:**
- RSI > 70: Overbought (potential sell)
- RSI < 30: Oversold (potential buy)

### Bollinger Bands

**Components:**
- Middle Band = SMA(20)
- Upper Band = SMA(20) + 2 x StdDev
- Lower Band = SMA(20) - 2 x StdDev

**Usage:**
- Price at Upper: Potentially overbought
- Price at Lower: Potentially oversold`,
  },
};

const TOPIC_FALLBACKS: Record<string, { title: string; level: "beginner" | "intermediate" | "advanced"; duration: string }> = {
  "basic-statistics": { title: "Basic Statistics for Traders", level: "beginner", duration: "20 min" },
  "market-indices": { title: "Understanding Market Indices", level: "beginner", duration: "10 min" },
  "simple-strategies": { title: "Building Simple Trading Strategies", level: "intermediate", duration: "25 min" },
  "risk-basics": { title: "Risk Management Basics", level: "intermediate", duration: "20 min" },
  "backtesting-intro": { title: "Introduction to Backtesting", level: "intermediate", duration: "25 min" },
  "factor-models": { title: "Factor Models Explained", level: "advanced", duration: "35 min" },
  "portfolio-theory": { title: "Modern Portfolio Theory", level: "advanced", duration: "40 min" },
  "ml-in-finance": { title: "Machine Learning in Finance", level: "advanced", duration: "45 min" },
  "hose-market": { title: "HOSE Market Specifics", level: "advanced", duration: "20 min" },
};

type TopicContentBlock =
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "code"; code: string };

function renderInlineBold(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let remaining = text;
  let idx = 0;

  while (true) {
    const start = remaining.indexOf("**");
    if (start === -1) {
      if (remaining) out.push(remaining);
      break;
    }

    const end = remaining.indexOf("**", start + 2);
    if (end === -1) {
      out.push(remaining);
      break;
    }

    if (start > 0) out.push(remaining.slice(0, start));
    const boldText = remaining.slice(start + 2, end);
    out.push(<strong key={`b-${idx}`}>{boldText}</strong>);
    idx += 1;

    remaining = remaining.slice(end + 2);
    if (!remaining) break;
  }

  return out;
}

function parseTopicContent(content: string): TopicContentBlock[] {
  const blocks: TopicContentBlock[] = [];
  const lines = content.split("\n");

  let inCode = false;
  let codeLines: string[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push({ kind: "ul", items: listItems });
    listItems = [];
  };

  const flushCode = () => {
    blocks.push({ kind: "code", code: codeLines.join("\n") });
    codeLines = [];
  };

  for (const line of lines) {
    const trimmed = line.trimEnd();

    if (trimmed.startsWith("```")) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        flushList();
        inCode = true;
        codeLines = [];
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (trimmed === "") {
      flushList();
      continue;
    }

    if (trimmed.startsWith("- ")) {
      listItems.push(trimmed.slice(2));
      continue;
    }

    flushList();

    if (trimmed.startsWith("## ")) {
      blocks.push({ kind: "h2", text: trimmed.slice(3) });
      continue;
    }
    if (trimmed.startsWith("### ")) {
      blocks.push({ kind: "h3", text: trimmed.slice(4) });
      continue;
    }

    blocks.push({ kind: "p", text: trimmed });
  }

  if (inCode) flushCode();
  flushList();

  return blocks;
}

function renderTopicContent(content: string): ReactNode[] {
  const blocks = parseTopicContent(content);
  return blocks.map((block, index) => {
    switch (block.kind) {
      case "h2":
        return <h2 key={index}>{block.text}</h2>;
      case "h3":
        return <h3 key={index}>{block.text}</h3>;
      case "ul":
        return (
          <ul key={index} className="list-disc pl-5">
            {block.items.map((item, idx) => (
              <li key={idx}>{renderInlineBold(item)}</li>
            ))}
          </ul>
        );
      case "code":
        return (
          <pre
            key={index}
            className="rounded-lg bg-slate-950 text-slate-100 p-4 overflow-x-auto text-xs leading-relaxed"
          >
            <code>{block.code}</code>
          </pre>
        );
      default:
        return <p key={index}>{renderInlineBold(block.text)}</p>;
    }
  });
}

// Next.js 15+ requires params to be a Promise
type TopicParams = {
  params: Promise<{ topic: string }>;
};

export default async function TopicPage({ params }: TopicParams) {
  const { topic: topicParam } = await params;
  const topic =
    TOPIC_CONTENT[topicParam] ??
    (TOPIC_FALLBACKS[topicParam]
      ? {
          ...TOPIC_FALLBACKS[topicParam],
          content: `## ${TOPIC_FALLBACKS[topicParam].title}

This lesson is being finalized and will be published soon.

### In the meantime

- Use the platform modules (Screener, Charts, Backtesting, Portfolio, Factors, Risk) to practice.
- Start with the available lessons in this Learning Hub.
- Revisit this page for full content updates.`,
        }
      : undefined);

  if (!topic) {
    notFound();
  }

  const levelColors = { beginner: "success", intermediate: "default", advanced: "secondary" } as const;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/learn" className="inline-flex items-center text-blue-600 hover:underline mb-6">
        <ArrowLeft className="w-4 h-4 mr-1" />Back to Learning Hub
      </Link>

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant={levelColors[topic.level]}>{topic.level}</Badge>
          <Badge variant="outline" className="flex items-center gap-1"><Clock className="w-3 h-3" />{topic.duration}</Badge>
        </div>
        <h1 className="text-3xl font-bold">{topic.title}</h1>
      </div>

      <Card>
        <CardContent className="p-8">
          <div className="prose prose-sm max-w-none dark:prose-invert">
            {renderTopicContent(topic.content)}
          </div>
        </CardContent>
      </Card>

      <div className="mt-8 flex justify-between">
        <Link href="/learn"><Button variant="outline"><BookOpen className="w-4 h-4 mr-2" />All Topics</Button></Link>
        <Link href="/screener"><Button>Try the Screener</Button></Link>
      </div>
    </div>
  );
}
