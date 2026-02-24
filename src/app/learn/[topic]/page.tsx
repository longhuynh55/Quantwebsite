import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock, BookOpen } from "lucide-react";
import { Badge, Button, Card, CardContent } from "@/components/ui";
import { formatLearnDuration, getLearnArticle, getLearnSlugs } from "@/lib/learnMdx";

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams(): Promise<Array<{ topic: string }>> {
  const slugs = await getLearnSlugs();
  return slugs.map((topic) => ({ topic }));
}

// Next.js 15+ requires params to be a Promise
type TopicParams = {
  params: Promise<{ topic: string }>;
};

export default async function TopicPage({ params }: TopicParams) {
  const { topic: topicParam } = await params;

  let article: Awaited<ReturnType<typeof getLearnArticle>>;
  try {
    article = await getLearnArticle(topicParam);
  } catch {
    notFound();
  }

  const { frontmatter, content } = article;
  const levelColors = { beginner: "success", intermediate: "default", advanced: "secondary" } as const;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <header className="mb-12 pb-8 border-b border-stone-200 dark:border-neutral-800">
        {/* Kicker */}
        <div className="flex items-center gap-3 mb-4">
          <span className="w-8 h-px bg-emerald-700 dark:bg-emerald-500" />
          <span className="text-xs font-sans uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500">
            Education Intelligence
          </span>
        </div>

        <Link href="/learn" className="inline-flex items-center text-emerald-600 dark:text-emerald-400 hover:underline mb-6">
          <ArrowLeft className="w-4 h-4 mr-1" />Back to Topics
        </Link>

        <div className="flex items-center gap-2 mb-4">
          <Badge variant={levelColors[frontmatter.level]}>{frontmatter.level}</Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatLearnDuration(frontmatter.durationMinutes)}
          </Badge>
        </div>
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-stone-900 dark:text-white leading-tight">
          {frontmatter.title}
        </h1>
      </header>

      <Card className="border border-stone-200 dark:border-neutral-800">
        <CardContent className="p-8">
          <div className="prose prose-sm max-w-none dark:prose-invert">{content}</div>
        </CardContent>
      </Card>

      <div className="mt-8 flex justify-between">
        <Link href="/learn">
          <Button variant="outline" className="border-2 border-stone-900 dark:border-white text-stone-900 dark:text-white font-sans font-semibold text-sm uppercase tracking-wider">
            <BookOpen className="w-4 h-4 mr-2" />All Topics
          </Button>
        </Link>
        <Link href="/screener">
          <Button className="bg-emerald-700 dark:bg-emerald-600 text-white font-sans font-semibold text-sm uppercase tracking-wider hover:bg-emerald-800 dark:hover:bg-emerald-500 transition-colors">
            Try the Screener
          </Button>
        </Link>
      </div>
    </div>
  );
}
