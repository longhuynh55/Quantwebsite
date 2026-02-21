import fsPromises from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode from "rehype-pretty-code";
import type { ComponentType, ReactNode } from "react";

export type LearnLevel = "beginner" | "intermediate" | "advanced";

export interface LearnFrontmatter {
  slug: string;
  title: string;
  description: string;
  level: LearnLevel;
  durationMinutes: number;
  order?: number;
}

export function formatLearnDuration(minutes: number): string {
  return `${minutes} min`;
}

const LEARN_CONTENT_DIR = path.join(process.cwd(), "content", "learn");
const LEVEL_ORDER: Record<LearnLevel, number> = { beginner: 0, intermediate: 1, advanced: 2 };

function isLearnLevel(value: unknown): value is LearnLevel {
  return value === "beginner" || value === "intermediate" || value === "advanced";
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function asNonNegativeInt(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 0) return parsed;
  }
  return undefined;
}

export async function getLearnSlugs(): Promise<string[]> {
  const entries = await fsPromises.readdir(LEARN_CONTENT_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mdx"))
    .map((entry) => entry.name.replace(/\.mdx$/, ""))
    .sort((a, b) => a.localeCompare(b));
}

export async function getLearnIndex(): Promise<LearnFrontmatter[]> {
  const slugs = await getLearnSlugs();
  const items: LearnFrontmatter[] = [];

  for (const slug of slugs) {
    const filePath = path.join(LEARN_CONTENT_DIR, `${slug}.mdx`);
    const raw = await fsPromises.readFile(filePath, "utf8");
    const parsed = matter(raw);
    const data = parsed.data as Record<string, unknown>;

    const fmSlug = asNonEmptyString(data.slug) ?? slug;
    const title = asNonEmptyString(data.title);
    const description = asNonEmptyString(data.description);
    const level = data.level;
    const durationMinutes = asNonNegativeInt(data.durationMinutes);
    const order = asNonNegativeInt(data.order);

    if (!title || !description || !isLearnLevel(level) || durationMinutes === undefined) {
      throw new Error(
        `Invalid Learn frontmatter in content/learn/${slug}.mdx (requires title, description, level, durationMinutes).`,
      );
    }

    items.push({
      slug: fmSlug,
      title,
      description,
      level,
      durationMinutes,
      order,
    });
  }

  items.sort((a, b) => {
    const levelCmp = LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level];
    if (levelCmp !== 0) return levelCmp;
    const orderA = a.order ?? Number.POSITIVE_INFINITY;
    const orderB = b.order ?? Number.POSITIVE_INFINITY;
    if (orderA !== orderB) return orderA - orderB;
    return a.title.localeCompare(b.title);
  });

  return items;
}

export async function getLearnArticle(
  slug: string,
  components?: Record<string, ComponentType<Record<string, unknown>>>,
): Promise<{ frontmatter: LearnFrontmatter; content: ReactNode }> {
  const filePath = path.join(LEARN_CONTENT_DIR, `${slug}.mdx`);
  const source = await fsPromises.readFile(filePath, "utf8");

  const { content, frontmatter } = await compileMDX<Record<string, unknown>>({
    source,
    options: {
      parseFrontmatter: true,
      mdxOptions: {
        remarkPlugins: [remarkGfm, remarkMath],
        rehypePlugins: [
          rehypeSlug,
          [
            rehypeAutolinkHeadings,
            {
              behavior: "wrap",
              properties: {
                className: ["mdx-heading-anchor"],
              },
            },
          ],
          rehypeKatex,
          [
            rehypePrettyCode,
            {
              theme: {
                light: "github-light",
                dark: "github-dark",
              },
              keepBackground: false,
            },
          ],
        ],
      },
    },
    components,
  });

  const fm = frontmatter as Record<string, unknown>;
  const title = asNonEmptyString(fm.title);
  const description = asNonEmptyString(fm.description);
  const level = fm.level;
  const durationMinutes = asNonNegativeInt(fm.durationMinutes);
  const order = asNonNegativeInt(fm.order);

  if (!title || !description || !isLearnLevel(level) || durationMinutes === undefined) {
    throw new Error(
      `Invalid Learn frontmatter in content/learn/${slug}.mdx (requires title, description, level, durationMinutes).`,
    );
  }

  return {
    frontmatter: {
      slug,
      title,
      description,
      level,
      durationMinutes,
      order,
    },
    content,
  };
}
