/**
 * Unit tests for strategy-generator.ts
 * Tests for AI strategy generation, parsing, validation, and format conversion
 */

import {
  generateStrategyFromPrompt,
  convertToStrategyBuilderFormat,
  type GeneratedStrategy,
} from '../strategy-generator';

// Mock the providers module
jest.mock('@/lib/assistant/providers', () => ({
  generateWithProviderFallback: jest.fn(),
}));

// Mock the prompts module
jest.mock('../prompts/strategy-prompts', () => ({
  buildStrategyPrompt: jest.fn(() => 'Mocked system prompt'),
  buildStrategyRepairPrompt: jest.fn(() => 'Mocked repair system prompt'),
}));

// Import the mocked functions
import { generateWithProviderFallback } from '@/lib/assistant/providers';

const mockGenerateWithProviderFallback = generateWithProviderFallback as jest.MockedFunction<
  typeof generateWithProviderFallback
>;

describe('strategy-generator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateStrategyFromPrompt', () => {
    it('should return success when provider returns valid JSON strategy', async () => {
      const validStrategy: GeneratedStrategy = {
        nodes: [
          {
            id: 'node-1',
            type: 'dataSource',
            position: { x: 50, y: 50 },
            data: {
              type: 'dataSource',
              label: 'Data Source',
              config: { stocks: ['VNM'], timeframe: '1d' },
            },
          },
        ],
        edges: [],
        explanation: 'Test strategy explanation',
      };

      mockGenerateWithProviderFallback.mockResolvedValueOnce({
        success: true,
        text: JSON.stringify(validStrategy),
        providerUsed: 'test-provider',
        fallbackUsed: false,
        latencyMs: 100,
      });

      const result = await generateStrategyFromPrompt('Test prompt');

      expect(result.success).toBe(true);
      expect(result.strategy).toBeDefined();
      expect(result.strategy?.nodes).toHaveLength(1);
      expect(result.strategy?.explanation).toBe('Test strategy explanation');
      expect(result.providerUsed).toBe('test-provider');
    });

    it('should return failure when provider call fails', async () => {
      mockGenerateWithProviderFallback.mockResolvedValueOnce({
        success: false,
        kind: 'network',
        statusCode: 502,
        message: 'Network error',
        latencyMs: 100,
        providerErrors: [],
      });

      const result = await generateStrategyFromPrompt('Test prompt');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return failure when response cannot be parsed as JSON', async () => {
      mockGenerateWithProviderFallback.mockResolvedValueOnce({
        success: true,
        text: 'This is not valid JSON',
        providerUsed: 'test-provider',
        fallbackUsed: false,
        latencyMs: 100,
      });

      const result = await generateStrategyFromPrompt('Test prompt');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to parse strategy');
      expect(result.rawResponse).toBe('This is not valid JSON');
    });

    it('should retry once with repair prompt when parse fails', async () => {
      const repaired: GeneratedStrategy = {
        nodes: [
          {
            id: 'node-1',
            type: 'dataSource',
            position: { x: 50, y: 50 },
            data: {
              type: 'dataSource',
              label: 'Data Source',
              config: { stocks: ['VNM'], timeframe: '1d' },
            },
          },
        ],
        edges: [],
        explanation: 'Recovered strategy',
      };

      mockGenerateWithProviderFallback
        .mockResolvedValueOnce({
          success: true,
          text: 'not valid json',
          providerUsed: 'test-provider',
          fallbackUsed: false,
          latencyMs: 50,
        })
        .mockResolvedValueOnce({
          success: true,
          text: JSON.stringify(repaired),
          providerUsed: 'test-provider',
          fallbackUsed: false,
          latencyMs: 55,
        });

      const result = await generateStrategyFromPrompt('Test prompt', { parseRepairRetries: 1 });

      expect(result.success).toBe(true);
      expect(result.strategy?.nodes).toHaveLength(1);
      expect(mockGenerateWithProviderFallback).toHaveBeenCalledTimes(2);
    });

    it('should return failure when response has invalid nodes/edges structure', async () => {
      mockGenerateWithProviderFallback.mockResolvedValueOnce({
        success: true,
        text: JSON.stringify({ foo: 'bar' }),
        providerUsed: 'test-provider',
        fallbackUsed: false,
        latencyMs: 100,
      });

      const result = await generateStrategyFromPrompt('Test prompt');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to parse strategy');
    });

    it('should parse JSON embedded in markdown code blocks', async () => {
      const validStrategy: GeneratedStrategy = {
        nodes: [],
        edges: [],
        explanation: 'Test',
      };

      const markdownResponse = `
Here's the strategy:

\`\`\`json
${JSON.stringify(validStrategy)}
\`\`\`
`;

      mockGenerateWithProviderFallback.mockResolvedValueOnce({
        success: true,
        text: markdownResponse,
        providerUsed: 'test-provider',
        fallbackUsed: false,
        latencyMs: 100,
      });

      const result = await generateStrategyFromPrompt('Test prompt');

      expect(result.success).toBe(true);
    });

    it('should handle exceptions gracefully', async () => {
      mockGenerateWithProviderFallback.mockRejectedValueOnce(new Error('Unexpected error'));

      const result = await generateStrategyFromPrompt('Test prompt');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unexpected error');
    });
  });

  describe('convertToStrategyBuilderFormat', () => {
    it('should convert generated strategy to builder format correctly', () => {
      const generatedStrategy: GeneratedStrategy = {
        nodes: [
          {
            id: 'node-1',
            type: 'dataSource',
            position: { x: 50, y: 50 },
            data: {
              type: 'dataSource',
              label: 'Data Source',
              config: { stocks: ['VNM', 'VCB'], timeframe: '1d' },
            },
          },
          {
            id: 'node-2',
            type: 'indicator',
            position: { x: 300, y: 50 },
            data: {
              type: 'indicator',
              label: 'RSI',
              config: { indicatorType: 'rsi', period: 14 },
            },
          },
        ],
        edges: [
          { id: 'edge-1', source: 'node-1', target: 'node-2' },
        ],
        explanation: 'Test strategy',
      };

      const result = convertToStrategyBuilderFormat(generatedStrategy);

      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);

      // Check node format
      expect(result.nodes[0]).toEqual({
        id: 'node-1',
        type: 'dataSource',
        position: { x: 50, y: 50 },
        data: {
          label: 'Data Source',
          stocks: ['VNM', 'VCB'],
          timeframe: '1d',
        },
      });

      // Check edge format
      expect(result.edges[0]).toEqual({
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
      });
    });

    it('should handle empty nodes and edges', () => {
      const generatedStrategy: GeneratedStrategy = {
        nodes: [],
        edges: [],
        explanation: 'Empty strategy',
      };

      const result = convertToStrategyBuilderFormat(generatedStrategy);

      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
    });

    it('should preserve all config properties in node data', () => {
      const generatedStrategy: GeneratedStrategy = {
        nodes: [
          {
            id: 'node-1',
            type: 'signal',
            position: { x: 800, y: 100 },
            data: {
              type: 'signal',
              label: 'Buy Signal',
              config: {
                signalType: 'buy',
                condition: 'RSI < 30',
                quantity: 100,
                stopLoss: 5,
                takeProfit: 10,
              },
            },
          },
        ],
        edges: [],
        explanation: 'Signal test',
      };

      const result = convertToStrategyBuilderFormat(generatedStrategy);

      expect(result.nodes[0].data).toEqual({
        label: 'Buy Signal',
        signalType: 'buy',
        condition: 'RSI < 30',
        quantity: 100,
        stopLoss: 5,
        takeProfit: 10,
      });
    });
  });
});

describe('parseStrategyResponse (via generateStrategyFromPrompt)', () => {
  it('should parse valid JSON with nodes and edges', async () => {
    const validStrategy: GeneratedStrategy = {
      nodes: [
        {
          id: 'node-1',
          type: 'dataSource',
          position: { x: 0, y: 0 },
          data: { type: 'dataSource', label: 'Test', config: {} },
        },
      ],
      edges: [],
      explanation: 'Test',
    };

    mockGenerateWithProviderFallback.mockResolvedValueOnce({
      success: true,
      text: JSON.stringify(validStrategy),
      providerUsed: 'test',
      fallbackUsed: false,
      latencyMs: 100,
    });

    const result = await generateStrategyFromPrompt('Test');

    expect(result.success).toBe(true);
    expect(result.strategy?.nodes).toHaveLength(1);
  });

  it('should handle invalid JSON', async () => {
    mockGenerateWithProviderFallback.mockResolvedValueOnce({
      success: true,
      text: 'not json at all',
      providerUsed: 'test',
      fallbackUsed: false,
      latencyMs: 100,
    });

    const result = await generateStrategyFromPrompt('Test');

    expect(result.success).toBe(false);
  });

  it('should handle JSON with nodes but no edges array', async () => {
    mockGenerateWithProviderFallback.mockResolvedValueOnce({
      success: true,
      text: JSON.stringify({ nodes: [], foo: 'bar' }),
      providerUsed: 'test',
      fallbackUsed: false,
      latencyMs: 100,
    });

    const result = await generateStrategyFromPrompt('Test');

    expect(result.success).toBe(false);
  });
});

describe('validateAndFixStrategy (via generateStrategyFromPrompt)', () => {
  it('should fix missing node ids', async () => {
    const strategyWithMissingIds = {
      nodes: [
        {
          type: 'dataSource',
          position: { x: 0, y: 0 },
          data: { type: 'dataSource', label: 'Test', config: {} },
        },
      ],
      edges: [],
      explanation: 'Test',
    };

    mockGenerateWithProviderFallback.mockResolvedValueOnce({
      success: true,
      text: JSON.stringify(strategyWithMissingIds),
      providerUsed: 'test',
      fallbackUsed: false,
      latencyMs: 100,
    });

    const result = await generateStrategyFromPrompt('Test');

    expect(result.success).toBe(true);
    expect(result.strategy?.nodes[0].id).toBeDefined();
    expect(result.strategy?.nodes[0].id).toMatch(/^node-/);
  });

  it('should fix invalid node types to indicator', async () => {
    const strategyWithInvalidType = {
      nodes: [
        {
          id: 'node-1',
          type: 'invalidType',
          position: { x: 0, y: 0 },
          data: { type: 'invalidType', label: 'Test', config: {} },
        },
      ],
      edges: [],
      explanation: 'Test',
    };

    mockGenerateWithProviderFallback.mockResolvedValueOnce({
      success: true,
      text: JSON.stringify(strategyWithInvalidType),
      providerUsed: 'test',
      fallbackUsed: false,
      latencyMs: 100,
    });

    const result = await generateStrategyFromPrompt('Test');

    expect(result.success).toBe(true);
    expect(result.strategy?.nodes[0].type).toBe('indicator');
  });

  it('should remove edges referencing non-existent nodes', async () => {
    const strategyWithInvalidEdges = {
      nodes: [
        {
          id: 'node-1',
          type: 'dataSource',
          position: { x: 0, y: 0 },
          data: { type: 'dataSource', label: 'Test', config: {} },
        },
      ],
      edges: [
        { id: 'edge-1', source: 'node-1', target: 'non-existent' },
        { id: 'edge-2', source: 'non-existent', target: 'node-1' },
      ],
      explanation: 'Test',
    };

    mockGenerateWithProviderFallback.mockResolvedValueOnce({
      success: true,
      text: JSON.stringify(strategyWithInvalidEdges),
      providerUsed: 'test',
      fallbackUsed: false,
      latencyMs: 100,
    });

    const result = await generateStrategyFromPrompt('Test');

    expect(result.success).toBe(true);
    expect(result.strategy?.edges).toHaveLength(0);
  });

  it('should add default explanation when missing', async () => {
    const strategyWithoutExplanation = {
      nodes: [
        {
          id: 'node-1',
          type: 'dataSource',
          position: { x: 0, y: 0 },
          data: { type: 'dataSource', label: 'Test', config: {} },
        },
      ],
      edges: [],
    };

    mockGenerateWithProviderFallback.mockResolvedValueOnce({
      success: true,
      text: JSON.stringify(strategyWithoutExplanation),
      providerUsed: 'test',
      fallbackUsed: false,
      latencyMs: 100,
    });

    const result = await generateStrategyFromPrompt('Test');

    expect(result.success).toBe(true);
    expect(result.strategy?.explanation).toBeDefined();
    expect(result.strategy?.explanation.length).toBeGreaterThan(0);
  });

  it('should generate default position when missing', async () => {
    const strategyWithoutPosition = {
      nodes: [
        {
          id: 'node-1',
          type: 'dataSource',
          data: { type: 'dataSource', label: 'Test', config: {} },
        },
      ],
      edges: [],
      explanation: 'Test',
    };

    mockGenerateWithProviderFallback.mockResolvedValueOnce({
      success: true,
      text: JSON.stringify(strategyWithoutPosition),
      providerUsed: 'test',
      fallbackUsed: false,
      latencyMs: 100,
    });

    const result = await generateStrategyFromPrompt('Test');

    expect(result.success).toBe(true);
    expect(result.strategy?.nodes[0].position).toBeDefined();
    expect(result.strategy?.nodes[0].position.x).toBeDefined();
    expect(result.strategy?.nodes[0].position.y).toBeDefined();
  });

  it('should generate edge ids when missing', async () => {
    const strategyWithEdgeWithoutId = {
      nodes: [
        {
          id: 'node-1',
          type: 'dataSource',
          position: { x: 0, y: 0 },
          data: { type: 'dataSource', label: 'Source', config: {} },
        },
        {
          id: 'node-2',
          type: 'indicator',
          position: { x: 300, y: 0 },
          data: { type: 'indicator', label: 'RSI', config: {} },
        },
      ],
      edges: [{ source: 'node-1', target: 'node-2' }],
      explanation: 'Test',
    };

    mockGenerateWithProviderFallback.mockResolvedValueOnce({
      success: true,
      text: JSON.stringify(strategyWithEdgeWithoutId),
      providerUsed: 'test',
      fallbackUsed: false,
      latencyMs: 100,
    });

    const result = await generateStrategyFromPrompt('Test');

    expect(result.success).toBe(true);
    expect(result.strategy?.edges[0].id).toBeDefined();
    expect(result.strategy?.edges[0].id).toMatch(/^edge-/);
  });
});
