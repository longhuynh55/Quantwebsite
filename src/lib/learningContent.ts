import fsPromises from "fs/promises";
import path from "path";

export type LearningLevel = "beginner" | "intermediate" | "advanced";

export interface LearningTopic {
  slug: string;
  title: string;
  description: string;
  level: LearningLevel;
  durationMinutes: number;
}

export function formatLearningDuration(minutes: number): string {
  return `${minutes} min`;
}

export const LEARNING_TOPICS: LearningTopic[] = [
  {
    slug: "what-is-quant",
    title: "What Is Quantitative Finance?",
    description: "A rigorous overview of how data, models, and risk controls translate ideas into testable investment decisions.",
    level: "beginner",
    durationMinutes: 18,
  },
  {
    slug: "reading-ohlcv",
    title: "Reading OHLCV Data",
    description: "Learn to interpret candles and volume correctly, and avoid common data-quality traps before building indicators.",
    level: "beginner",
    durationMinutes: 20,
  },
  {
    slug: "basic-statistics",
    title: "Basic Statistics for Traders",
    description: "Returns, volatility, correlation, and distributions: the minimum statistical toolkit for evaluating strategies.",
    level: "beginner",
    durationMinutes: 24,
  },
  {
    slug: "market-indices",
    title: "Understanding Market Indices",
    description: "How benchmarks are constructed, why concentration matters, and how to interpret relative performance.",
    level: "beginner",
    durationMinutes: 18,
  },
  {
    slug: "technical-indicators",
    title: "Technical Indicators: A Practical Deep Dive",
    description: "A disciplined view of moving averages, RSI, MACD, and volatility bands, with implementation pitfalls.",
    level: "intermediate",
    durationMinutes: 32,
  },
  {
    slug: "simple-strategies",
    title: "Building Simple Trading Strategies",
    description: "Turn a hypothesis into executable rules, then validate with costs, constraints, and robustness checks.",
    level: "intermediate",
    durationMinutes: 34,
  },
  {
    slug: "risk-basics",
    title: "Risk Management Fundamentals",
    description: "Position sizing, drawdowns, tail risk, and portfolio guardrails: risk-first thinking for systematic trading.",
    level: "intermediate",
    durationMinutes: 28,
  },
  {
    slug: "backtesting-intro",
    title: "Introduction to Backtesting",
    description: "What a backtest can and cannot tell you, and how to avoid the most common sources of bias.",
    level: "intermediate",
    durationMinutes: 36,
  },
  {
    slug: "factor-models",
    title: "Factor Models Explained",
    description: "A research workflow for building, validating, and combining equity factors such as value and momentum.",
    level: "advanced",
    durationMinutes: 40,
  },
  {
    slug: "portfolio-theory",
    title: "Modern Portfolio Theory",
    description: "Mean-variance optimization, estimation risk, and practical constraints for implementable portfolios.",
    level: "advanced",
    durationMinutes: 42,
  },
  {
    slug: "ml-in-finance",
    title: "Machine Learning in Finance",
    description: "Applying ML to market data with strict leakage control, time-aware validation, and economic evaluation.",
    level: "advanced",
    durationMinutes: 46,
  },
  {
    slug: "hose-market",
    title: "HOSE Market Specifics",
    description: "How liquidity, trading constraints, and local microstructure affect realistic modeling and execution on HOSE.",
    level: "advanced",
    durationMinutes: 30,
  },
];

export const LEARNING_TOPICS_BY_LEVEL: Record<LearningLevel, LearningTopic[]> = {
  beginner: LEARNING_TOPICS.filter((topic) => topic.level === "beginner"),
  intermediate: LEARNING_TOPICS.filter((topic) => topic.level === "intermediate"),
  advanced: LEARNING_TOPICS.filter((topic) => topic.level === "advanced"),
};

export const LEARNING_TOPIC_BY_SLUG: Record<string, LearningTopic> = Object.fromEntries(
  LEARNING_TOPICS.map((topic) => [topic.slug, topic]),
) as Record<string, LearningTopic>;

export const LEARNING_LEVEL_META: Record<
  LearningLevel,
  {
    label: string;
    sectionTitle: string;
    summary: string;
    cardSummary: string;
  }
> = {
  beginner: {
    label: "Beginner",
    sectionTitle: "Beginner Topics",
    summary: "Build fundamentals in market data, basic statistics, and benchmark-aware thinking.",
    cardSummary: "Start here to build a solid foundation before writing strategies.",
  },
  intermediate: {
    label: "Intermediate",
    sectionTitle: "Intermediate Topics",
    summary: "Turn indicators into testable strategies with realistic assumptions and practical risk controls.",
    cardSummary: "Move from concepts to repeatable strategy design and backtesting.",
  },
  advanced: {
    label: "Advanced",
    sectionTitle: "Advanced Topics",
    summary: "Scale into factors, portfolio optimization, and ML with robust validation practices.",
    cardSummary: "Adopt research workflows used for alpha research and portfolio construction.",
  },
};

const LEARN_CONTENT_DIR = path.join(process.cwd(), "content", "learn");

export async function getLearningTopicContent(slug: string): Promise<string> {
  const filePath = path.join(LEARN_CONTENT_DIR, `${slug}.md`);
  return fsPromises.readFile(filePath, "utf8");
}
