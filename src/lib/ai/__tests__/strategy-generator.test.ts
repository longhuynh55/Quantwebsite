/**
 * Unit tests for strategy-generator.ts
 */

import {
  generateStrategyFromPrompt,
  convertToStrategyBuilderFormat,
  type GeneratedStrategy,
} from "../strategy-generator";
import { buildStrategyPrompt, buildStrategyRepairPrompt } from "../prompts/strategy-prompts";

jest.mock("@/lib/assistant/providers", () => ({
  generateWithProviderFallback: jest.fn(),
}));

jest.mock("../prompts/strategy-prompts", () => ({
  STRATEGY_GENERATION_SYSTEM_PROMPT: "Mocked system prompt",
  STRATEGY_GENERATION_REPAIR_PROMPT: "Mocked repair instruction",
  buildStrategyPrompt: jest.fn(() => "Mocked user prompt"),
  buildStrategyRepairPrompt: jest.fn(() => "Mocked repair user prompt"),
}));

import { generateWithProviderFallback } from "@/lib/assistant/providers";
const mockBuildStrategyPrompt = buildStrategyPrompt as jest.MockedFunction<typeof buildStrategyPrompt>;
const mockBuildStrategyRepairPrompt =
  buildStrategyRepairPrompt as jest.MockedFunction<typeof buildStrategyRepairPrompt>;

type ProviderResult = Awaited<ReturnType<typeof generateWithProviderFallback>>;
const mockGenerateWithProviderFallback = generateWithProviderFallback as jest.MockedFunction<
  typeof generateWithProviderFallback
>;

function buildValidStrategy(overrides: Partial<GeneratedStrategy> = {}): GeneratedStrategy {
  return {
    nodes: [
      {
        id: "node-1",
        type: "dataSource",
        position: { x: 50, y: 50 },
        data: {
          type: "dataSource",
          label: "Data Source",
          config: { stocks: ["VNM"], timeframe: "1d" },
        },
      },
      {
        id: "node-2",
        type: "output",
        position: { x: 320, y: 50 },
        data: {
          type: "output",
          label: "Output",
          config: { metrics: ["returns", "sharpe"] },
        },
      },
    ],
    edges: [{ id: "edge-1", source: "node-1", target: "node-2" }],
    explanation: "Test strategy explanation",
    ...overrides,
  };
}

function providerSuccess(text: string, overrides: Partial<ProviderResult> = {}): ProviderResult {
  return {
    success: true,
    text,
    providerUsed: "test-provider",
    fallbackUsed: false,
    latencyMs: 100,
    responseFormatApplied: true,
    responseFormatFallbackUsed: false,
    ...overrides,
  } as ProviderResult;
}

describe("strategy-generator", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockBuildStrategyPrompt.mockImplementation(() => "Mocked user prompt");
    mockBuildStrategyRepairPrompt.mockImplementation(() => "Mocked repair user prompt");
  });

  describe("generateStrategyFromPrompt", () => {
    it("returns success when provider returns valid strategy JSON", async () => {
      mockGenerateWithProviderFallback.mockResolvedValueOnce(
        providerSuccess(JSON.stringify(buildValidStrategy()))
      );

      const result = await generateStrategyFromPrompt("Test prompt");

      expect(result.success).toBe(true);
      expect(result.strategy?.nodes).toHaveLength(2);
      expect(result.strategy?.edges).toHaveLength(1);
      expect(result.providerUsed).toBe("test-provider");

      const callArgs = mockGenerateWithProviderFallback.mock.calls[0];
      expect(callArgs[1]).toMatchObject({
        responseFormat: { type: "json_schema" },
        responseFormatMode: "force",
        requireResponseFormatApplied: true,
      });
      expect(callArgs[1]).toEqual(
        expect.objectContaining({
          abortSignal: expect.any(Object),
        })
      );
      expect(callArgs[0]).toEqual([
        { role: "system", content: "Mocked system prompt" },
        { role: "user", content: "Mocked user prompt" },
      ]);
    });

    it("returns provider failure when provider call fails", async () => {
      mockGenerateWithProviderFallback.mockResolvedValueOnce({
        success: false,
        kind: "network",
        statusCode: 502,
        message: "Network error",
        latencyMs: 100,
        providerErrors: [],
      });

      const result = await generateStrategyFromPrompt("Test prompt");

      expect(result.success).toBe(false);
      expect(result.failureKind).toBe("network");
      expect(result.statusCode).toBe(502);
    });

    it("returns parse failure when response is not JSON", async () => {
      mockGenerateWithProviderFallback.mockResolvedValueOnce(
        providerSuccess("This is not valid JSON")
      );

      const result = await generateStrategyFromPrompt("Test prompt");

      expect(result.success).toBe(false);
      expect(result.failureKind).toBe("parse");
      expect(result.statusCode).toBe(422);
    });

    it("retries once with repair prompt when first parse fails", async () => {
      mockGenerateWithProviderFallback
        .mockResolvedValueOnce(providerSuccess("not valid json", { latencyMs: 50 }))
        .mockResolvedValueOnce(
          providerSuccess(JSON.stringify(buildValidStrategy({ explanation: "Recovered" })), { latencyMs: 60 })
        );

      const result = await generateStrategyFromPrompt("Test prompt", { parseRepairRetries: 1 });

      expect(result.success).toBe(true);
      expect(result.strategy?.explanation).toBe("Recovered");
      expect(mockGenerateWithProviderFallback).toHaveBeenCalledTimes(2);
      const secondCallMessages = mockGenerateWithProviderFallback.mock.calls[1][0];
      expect(secondCallMessages[0]).toEqual({
        role: "system",
        content: "Mocked system prompt\n\nMocked repair instruction",
      });
      expect(secondCallMessages[1]).toEqual({
        role: "assistant",
        content: "not valid json",
      });
      expect(secondCallMessages[2]).toEqual({
        role: "user",
        content: "Mocked repair user prompt",
      });
    });

    it("parses JSON embedded in markdown code fences", async () => {
      const markdownResponse = `\nHere is the strategy:\n\n\`\`\`json\n${JSON.stringify(buildValidStrategy())}\n\`\`\``;
      mockGenerateWithProviderFallback.mockResolvedValueOnce(providerSuccess(markdownResponse));

      const result = await generateStrategyFromPrompt("Test prompt");

      expect(result.success).toBe(true);
      expect(result.strategy?.nodes).toHaveLength(2);
    });

    it("returns timeout failure when deadline is exceeded", async () => {
      jest.useFakeTimers();
      let capturedAbortSignal: AbortSignal | undefined;
      mockGenerateWithProviderFallback.mockImplementationOnce((_: unknown, options?: { abortSignal?: AbortSignal }) => {
        capturedAbortSignal = options?.abortSignal;
        return new Promise(() => undefined);
      });

      try {
        const resultPromise = generateStrategyFromPrompt("Test prompt", { timeoutMs: 5 });
        await jest.advanceTimersByTimeAsync(10);
        const result = await resultPromise;

        expect(result.success).toBe(false);
        expect(result.failureKind).toBe("timeout");
        expect(result.statusCode).toBe(504);
        expect(capturedAbortSignal?.aborted).toBe(true);
      } finally {
        jest.useRealTimers();
      }
    });

    it("returns configuration failure when schema is required but provider does not apply response format", async () => {
      mockGenerateWithProviderFallback.mockResolvedValueOnce(
        providerSuccess(JSON.stringify(buildValidStrategy()), { responseFormatApplied: false })
      );

      const result = await generateStrategyFromPrompt("Test prompt");

      expect(result.success).toBe(false);
      expect(result.failureKind).toBe("configuration");
      expect(result.statusCode).toBe(502);
    });

    it("rejects unsupported node types as parse failure", async () => {
      const malformed = {
        nodes: [
          {
            id: "node-1",
            type: "dataSource",
            position: { x: 0, y: 0 },
            data: { type: "dataSource", label: "Source", config: {} },
          },
          {
            id: "node-1",
            type: "invalidType",
            position: { x: 100, y: 0 },
            data: { type: "invalidType", label: "Invalid", config: {} },
          },
          {
            id: "node-3",
            type: "output",
            position: { x: 200, y: 0 },
            data: { type: "output", label: "Output", config: {} },
          },
        ],
        edges: [{ source: "node-1", target: "node-3" }],
        explanation: "Malformed",
      };

      mockGenerateWithProviderFallback.mockResolvedValueOnce(providerSuccess(JSON.stringify(malformed)));

      const result = await generateStrategyFromPrompt("Test prompt");

      expect(result.success).toBe(false);
      expect(result.failureKind).toBe("parse");
      expect(result.statusCode).toBe(422);
    });

    it("removes invalid edges but keeps valid path", async () => {
      const malformed = {
        nodes: buildValidStrategy().nodes,
        edges: [
          { source: "node-1", target: "node-2" },
          { source: "node-1", target: "non-existent" },
          { source: "node-1", target: "node-1" },
        ],
        explanation: "Edge cleanup",
      };

      mockGenerateWithProviderFallback.mockResolvedValueOnce(providerSuccess(JSON.stringify(malformed)));

      const result = await generateStrategyFromPrompt("Test prompt");

      expect(result.success).toBe(true);
      expect(result.strategy?.edges).toHaveLength(1);
      expect(result.strategy?.edges[0]).toMatchObject({ source: "node-1", target: "node-2" });
    });

    it("returns parse failure when output is unreachable from data source", async () => {
      const unreachable = {
        nodes: [
          {
            id: "node-1",
            type: "dataSource",
            position: { x: 0, y: 0 },
            data: { type: "dataSource", label: "Source", config: {} },
          },
          {
            id: "node-2",
            type: "indicator",
            position: { x: 100, y: 0 },
            data: { type: "indicator", label: "Indicator", config: {} },
          },
          {
            id: "node-3",
            type: "output",
            position: { x: 200, y: 0 },
            data: { type: "output", label: "Output", config: {} },
          },
        ],
        edges: [{ source: "node-1", target: "node-2" }],
        explanation: "No path to output",
      };

      mockGenerateWithProviderFallback.mockResolvedValueOnce(providerSuccess(JSON.stringify(unreachable)));

      const result = await generateStrategyFromPrompt("Test prompt");

      expect(result.success).toBe(false);
      expect(result.failureKind).toBe("parse");
      expect(result.statusCode).toBe(422);
    });
  });

  describe("convertToStrategyBuilderFormat", () => {
    it("converts generated strategy to builder format", () => {
      const generatedStrategy: GeneratedStrategy = {
        nodes: [
          {
            id: "node-1",
            type: "dataSource",
            position: { x: 50, y: 50 },
            data: {
              type: "dataSource",
              label: "Data Source",
              config: { stocks: ["VNM", "VCB"], timeframe: "1d" },
            },
          },
          {
            id: "node-2",
            type: "indicator",
            position: { x: 300, y: 50 },
            data: {
              type: "indicator",
              label: "RSI",
              config: { indicatorType: "rsi", period: 14 },
            },
          },
        ],
        edges: [{ id: "edge-1", source: "node-1", target: "node-2" }],
        explanation: "Test strategy",
      };

      const result = convertToStrategyBuilderFormat(generatedStrategy);

      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
      expect(result.nodes[0]).toEqual({
        id: "node-1",
        type: "dataSource",
        position: { x: 50, y: 50 },
        data: {
          label: "Data Source",
          stocks: ["VNM", "VCB"],
          timeframe: "1d",
        },
      });
    });

    it("preserves all config properties in node data", () => {
      const generatedStrategy: GeneratedStrategy = {
        nodes: [
          {
            id: "node-1",
            type: "signal",
            position: { x: 800, y: 100 },
            data: {
              type: "signal",
              label: "Buy Signal",
              config: {
                signalType: "buy",
                condition: "RSI < 30",
                quantity: 100,
                stopLoss: 5,
                takeProfit: 10,
              },
            },
          },
        ],
        edges: [],
        explanation: "Signal test",
      };

      const result = convertToStrategyBuilderFormat(generatedStrategy);

      expect(result.nodes[0].data).toEqual({
        label: "Buy Signal",
        signalType: "buy",
        condition: "RSI < 30",
        quantity: 100,
        stopLoss: 5,
        takeProfit: 10,
      });
    });
  });
});
