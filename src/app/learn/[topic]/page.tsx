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
      <Link href="/learn" className="inline-flex items-center text-blue-600 hover:underline mb-6">
        <ArrowLeft className="w-4 h-4 mr-1" />Back to Education Intelligence
      </Link>

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant={levelColors[frontmatter.level]}>{frontmatter.level}</Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatLearnDuration(frontmatter.durationMinutes)}
          </Badge>
        </div>
        <h1 className="text-3xl font-bold">{frontmatter.title}</h1>
      </div>

      <Card>
        <CardContent className="p-8">
          <div className="prose prose-sm max-w-none dark:prose-invert">{content}</div>
        </CardContent>
      </Card>

      <div className="mt-8 flex justify-between">
        <Link href="/learn">
          <Button variant="outline">
            <BookOpen className="w-4 h-4 mr-2" />All Topics
          </Button>
        </Link>
        <Link href="/screener">
          <Button>Try the Screener</Button>
        </Link>
      </div>
    </div>
  );
}

