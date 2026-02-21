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
    cardClassName: "bg-gradient-to-br from-green-50 to-green-100 border-green-200",
    iconClassName: "bg-green-500",
    topicCountClassName: "text-green-700",
    sectionIconClassName: "text-green-600",
    levelBadgeVariant: "success",
  },
  {
    level: "intermediate",
    icon: BookOpen,
    cardClassName: "bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200",
    iconClassName: "bg-blue-500",
    topicCountClassName: "text-blue-700",
    sectionIconClassName: "text-blue-600",
    levelBadgeVariant: "default",
  },
  {
    level: "advanced",
    icon: Award,
    cardClassName: "bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200",
    iconClassName: "bg-purple-500",
    topicCountClassName: "text-purple-700",
    sectionIconClassName: "text-purple-600",
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
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold mb-4">Education Intelligence</h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          A structured learning track for quantitative finance, oriented toward Vietnamese equities: from data and
          statistics to strategy research, portfolios, and advanced modeling.
        </p>
      </div>

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
                    className={`w-12 h-12 ${levelConfig.iconClassName} rounded-full flex items-center justify-center`}
                  >
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{levelMeta.label}</h3>
                    <p className={`text-sm ${levelConfig.topicCountClassName}`}>{topicCount} topics</p>
                  </div>
                </div>
                <p className="text-gray-600 mb-4">{levelMeta.cardSummary}</p>
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
              <p className="text-gray-600 mb-4">{levelMeta.summary}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {levelTopics.map((topic) => (
                  <Link key={topic.slug} href={`/learn/${topic.slug}`}>
                    <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer group">
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold text-lg mb-2 group-hover:text-blue-600">
                              {topic.title}
                            </h3>
                            <p className="text-gray-600 text-sm">{topic.description}</p>
                          </div>
                          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-transform" />
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

