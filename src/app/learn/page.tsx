import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { BookOpen, GraduationCap, Award, ArrowRight } from "lucide-react";
import { Badge, Card, CardContent } from "@/components/ui";
import { formatLearnDuration, getLearnIndex, type LearnLevel } from "@/lib/learnMdx";

export const dynamic = "force-static";

type LevelVisualConfig = {
  level: LearnLevel;
  icon: LucideIcon;
  cardClassName: string;
  iconClassName: string;
  topicCountClassName: string;
  sectionIconClassName: string;
  levelBadgeVariant: "success" | "default" | "secondary";
};

const LEARNING_LEVEL_META: Record<
  LearnLevel,
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

const LEVEL_VISUALS: LevelVisualConfig[] = [
  {
    level: "beginner",
    icon: GraduationCap,
    cardClassName: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800",
    iconClassName: "bg-emerald-600 dark:bg-emerald-500",
    topicCountClassName: "text-emerald-700 dark:text-emerald-400",
    sectionIconClassName: "text-emerald-600 dark:text-emerald-400",
    levelBadgeVariant: "success",
  },
  {
    level: "intermediate",
    icon: BookOpen,
    cardClassName: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
    iconClassName: "bg-amber-600 dark:bg-amber-500",
    topicCountClassName: "text-amber-700 dark:text-amber-400",
    sectionIconClassName: "text-amber-600 dark:text-amber-400",
    levelBadgeVariant: "default",
  },
  {
    level: "advanced",
    icon: Award,
    cardClassName: "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800",
    iconClassName: "bg-purple-500",
    topicCountClassName: "text-purple-700 dark:text-purple-400",
    sectionIconClassName: "text-purple-600 dark:text-purple-400",
    levelBadgeVariant: "secondary",
  },
];

function getTotalMinutes(topics: { durationMinutes: number }[]): number {
  return topics.reduce((acc, topic) => acc + topic.durationMinutes, 0);
}

export default async function LearnPage() {
  const topics = await getLearnIndex();
  const topicsByLevel: Record<LearnLevel, typeof topics> = {
    beginner: topics.filter((topic) => topic.level === "beginner"),
    intermediate: topics.filter((topic) => topic.level === "intermediate"),
    advanced: topics.filter((topic) => topic.level === "advanced"),
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <header className="mb-12 pb-8 border-b border-stone-200 dark:border-neutral-800 text-center">
        {/* Kicker */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <span className="w-8 h-px bg-emerald-700 dark:bg-emerald-500" />
          <span className="text-xs font-sans uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500">
            Learning Center
          </span>
          <span className="w-8 h-px bg-emerald-700 dark:bg-emerald-500" />
        </div>

        <h1 className="font-serif text-4xl md:text-5xl font-bold text-stone-900 dark:text-white leading-tight mb-4">
          Education Intelligence
        </h1>
        <p className="text-lg text-stone-600 dark:text-neutral-400 max-w-3xl mx-auto">
          A structured learning track for quantitative finance, oriented toward Vietnamese equities: from data and
          statistics to strategy research, portfolios, and advanced modeling.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {LEVEL_VISUALS.map((levelConfig) => {
          const levelMeta = LEARNING_LEVEL_META[levelConfig.level];
          const levelTopics = topicsByLevel[levelConfig.level];
          const topicCount = levelTopics.length;
          const totalMinutes = getTotalMinutes(levelTopics);
          const Icon = levelConfig.icon;

          return (
            <Card key={levelConfig.level} className={levelConfig.cardClassName}>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`w-12 h-12 ${levelConfig.iconClassName} flex items-center justify-center`}
                  >
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{levelMeta.label}</h3>
                    <p className={`text-sm ${levelConfig.topicCountClassName}`}>{topicCount} topics</p>
                  </div>
                </div>
                <p className="text-stone-600 dark:text-neutral-400 mb-4">{levelMeta.cardSummary}</p>
                <Badge variant={levelConfig.levelBadgeVariant}>
                  ~{formatLearnDuration(totalMinutes)} total
                </Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="space-y-8">
        {LEVEL_VISUALS.map((levelConfig) => {
          const Icon = levelConfig.icon;
          const levelMeta = LEARNING_LEVEL_META[levelConfig.level];
          const levelTopics = topicsByLevel[levelConfig.level];

          return (
            <section key={levelConfig.level}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-6 h-6 ${levelConfig.sectionIconClassName}`} />
                <h2 className="text-2xl font-bold">{levelMeta.sectionTitle}</h2>
              </div>
              <p className="text-stone-600 dark:text-neutral-400 mb-4">{levelMeta.summary}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {levelTopics.map((topic) => (
                  <Link key={topic.slug} href={`/learn/${topic.slug}`}>
                    <Card className="h-full hover:border-stone-400 dark:hover:border-neutral-600 transition-colors cursor-pointer group border border-stone-200 dark:border-neutral-800">
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold text-lg mb-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                              {topic.title}
                            </h3>
                            <p className="text-stone-600 dark:text-neutral-400 text-sm">{topic.description}</p>
                          </div>
                          <ArrowRight className="w-5 h-5 text-stone-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:translate-x-1 transition-transform" />
                        </div>
                        <div className="mt-4 flex items-center gap-2">
                          <Badge variant="outline">
                            {formatLearnDuration(topic.durationMinutes)}
                          </Badge>
                          <Badge variant={levelConfig.levelBadgeVariant}>{levelMeta.label}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
