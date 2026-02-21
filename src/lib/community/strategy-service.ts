import type { StrategyNode, StrategyEdge } from "@/lib/stores/strategyBuilderStore";

// Strategy performance metrics
export interface StrategyPerformance {
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
}

// Shared strategy data model
export interface SharedStrategy {
  id: string;
  name: string;
  description: string;
  author: string;
  authorId?: string;
  nodes: StrategyNode[];
  edges: StrategyEdge[];
  performance: StrategyPerformance;
  rating: number;
  ratingCount: number;
  tags: string[];
  downloads: number;
  createdAt: string;
  updatedAt: string;
}

// API response types
export interface StrategiesListResponse {
  strategies: SharedStrategy[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface StrategiesQueryParams {
  search?: string;
  tags?: string[];
  sortBy?: "rating" | "return" | "date" | "downloads";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface CreateStrategyPayload {
  name: string;
  description: string;
  nodes: StrategyNode[];
  edges: StrategyEdge[];
  performance: StrategyPerformance;
  tags: string[];
}

export interface UpdateStrategyPayload extends Partial<CreateStrategyPayload> {
  id: string;
}

// Available tags for strategies
export const STRATEGY_TAGS = [
  { value: "momentum", label: "Momentum", labelVi: "Xung luong" },
  { value: "mean-reversion", label: "Mean Reversion", labelVi: "Hoan ngu trung binh" },
  { value: "trend-following", label: "Trend Following", labelVi: "Di theo xu huong" },
  { value: "breakout", label: "Breakout", labelVi: "Dot pha" },
  { value: "scalping", label: "Scalping", labelVi: "Scalping" },
  { value: "swing-trading", label: "Swing Trading", labelVi: "Dau tu ngan han" },
  { value: "long-term", label: "Long Term", labelVi: "Dai han" },
  { value: "technical", label: "Technical Analysis", labelVi: "Phan tich ky thuat" },
  { value: "fundamental", label: "Fundamental Analysis", labelVi: "Phan tich co ban" },
  { value: "rsi", label: "RSI Based", labelVi: "Dung RSI" },
  { value: "macd", label: "MACD Based", labelVi: "Dung MACD" },
  { value: "bollinger", label: "Bollinger Bands", labelVi: "Bollinger Bands" },
  { value: "volume", label: "Volume Based", labelVi: "Dung Khoi luong" },
] as const;

export type StrategyTag = typeof STRATEGY_TAGS[number]["value"];

// Sort options
export const SORT_OPTIONS = [
  { value: "rating", label: "Rating cao nhat", labelEn: "Highest Rating" },
  { value: "return", label: "Loi nhuan cao nhat", labelEn: "Highest Return" },
  { value: "date", label: "Moi nhat", labelEn: "Most Recent" },
  { value: "downloads", label: "Tai nhieu nhat", labelEn: "Most Downloaded" },
] as const;

// API base URL
const API_BASE = "/api/strategies";

// Generate unique ID
const generateId = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `strategy-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

// Fetch strategies list
export async function fetchStrategies(
  params: StrategiesQueryParams = {}
): Promise<StrategiesListResponse> {
  const searchParams = new URLSearchParams();

  if (params.search) {
    searchParams.set("search", params.search);
  }
  if (params.tags && params.tags.length > 0) {
    searchParams.set("tags", params.tags.join(","));
  }
  if (params.sortBy) {
    searchParams.set("sortBy", params.sortBy);
  }
  if (params.sortOrder) {
    searchParams.set("sortOrder", params.sortOrder);
  }
  if (params.page) {
    searchParams.set("page", String(params.page));
  }
  if (params.pageSize) {
    searchParams.set("pageSize", String(params.pageSize));
  }

  const response = await fetch(`${API_BASE}?${searchParams.toString()}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch strategies: ${response.statusText}`);
  }

  return response.json();
}

// Fetch single strategy by ID
export async function fetchStrategyById(id: string): Promise<SharedStrategy> {
  const response = await fetch(`${API_BASE}/${id}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Strategy not found");
    }
    throw new Error(`Failed to fetch strategy: ${response.statusText}`);
  }

  return response.json();
}

// Create new strategy
export async function createStrategy(
  payload: CreateStrategyPayload
): Promise<SharedStrategy> {
  const response = await fetch(API_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...payload,
      id: generateId(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create strategy: ${response.statusText}`);
  }

  return response.json();
}

// Update existing strategy
export async function updateStrategy(
  payload: UpdateStrategyPayload
): Promise<SharedStrategy> {
  const response = await fetch(`${API_BASE}/${payload.id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to update strategy: ${response.statusText}`);
  }

  return response.json();
}

// Delete strategy
export async function deleteStrategy(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`Failed to delete strategy: ${response.statusText}`);
  }
}

// Rate strategy
export async function rateStrategy(
  id: string,
  rating: number
): Promise<SharedStrategy> {
  const response = await fetch(`${API_BASE}/${id}/rate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ rating }),
  });

  if (!response.ok) {
    throw new Error(`Failed to rate strategy: ${response.statusText}`);
  }

  return response.json();
}

// Copy/Import strategy to user's collection
export async function importStrategy(id: string): Promise<SharedStrategy> {
  const response = await fetch(`${API_BASE}/${id}/import`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Failed to import strategy: ${response.statusText}`);
  }

  return response.json();
}

// Mock data generator for development
export function generateMockStrategies(count: number = 12): SharedStrategy[] {
  const mockStrategies: SharedStrategy[] = [];
  const tagOptions = STRATEGY_TAGS.map(t => t.value);
  const authors = ["NguyenVanA", "TraderPro", "QuantMaster", "StockGuru", "InvestorVN"];

  for (let i = 0; i < count; i++) {
    const numTags = Math.floor(Math.random() * 3) + 1;
    const selectedTags: string[] = [];
    for (let j = 0; j < numTags; j++) {
      const tag = tagOptions[Math.floor(Math.random() * tagOptions.length)];
      if (!selectedTags.includes(tag)) {
        selectedTags.push(tag);
      }
    }

    mockStrategies.push({
      id: `strategy-${i + 1}`,
      name: `Strategy ${i + 1}`,
      description: `Detailed overview for strategy #${i + 1}. This setup combines multiple technical indicators to generate entry and exit signals.`,
      author: authors[Math.floor(Math.random() * authors.length)],
      nodes: [],
      edges: [],
      performance: {
        totalReturn: Math.random() * 100 - 20, // -20% to 80%
        sharpeRatio: Math.random() * 2 + 0.5, // 0.5 to 2.5
        maxDrawdown: Math.random() * 30, // 0% to 30%
        winRate: Math.random() * 40 + 40, // 40% to 80%
      },
      rating: Math.random() * 2 + 3, // 3 to 5
      ratingCount: Math.floor(Math.random() * 100) + 1,
      tags: selectedTags,
      downloads: Math.floor(Math.random() * 500),
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  return mockStrategies;
}
