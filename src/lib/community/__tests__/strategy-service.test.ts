/**
 * Unit tests for strategy-service.ts
 * Tests for community API service, mock data generation, and constants
 */

import {
  generateMockStrategies,
  STRATEGY_TAGS,
  SORT_OPTIONS,
  fetchStrategies,
  fetchStrategyById,
  createStrategy,
  updateStrategy,
  deleteStrategy,
  rateStrategy,
  importStrategy,
  type SharedStrategy,
  type CreateStrategyPayload,
  type StrategiesQueryParams,
} from '../strategy-service';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('strategy-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('STRATEGY_TAGS', () => {
    it('should have correct structure for all tags', () => {
      expect(STRATEGY_TAGS).toBeDefined();
      expect(Array.isArray(STRATEGY_TAGS)).toBe(true);
      expect(STRATEGY_TAGS.length).toBeGreaterThan(0);

      STRATEGY_TAGS.forEach((tag) => {
        expect(tag).toHaveProperty('value');
        expect(tag).toHaveProperty('label');
        expect(tag).toHaveProperty('labelVi');
        expect(typeof tag.value).toBe('string');
        expect(typeof tag.label).toBe('string');
        expect(typeof tag.labelVi).toBe('string');
      });
    });

    it('should contain expected strategy tag types', () => {
      const tagValues = STRATEGY_TAGS.map((t) => t.value);

      expect(tagValues).toContain('momentum');
      expect(tagValues).toContain('mean-reversion');
      expect(tagValues).toContain('trend-following');
      expect(tagValues).toContain('breakout');
      expect(tagValues).toContain('rsi');
      expect(tagValues).toContain('macd');
      expect(tagValues).toContain('bollinger');
    });

    it('should have unique values', () => {
      const values = STRATEGY_TAGS.map((t) => t.value);
      const uniqueValues = [...new Set(values)];
      expect(values.length).toBe(uniqueValues.length);
    });
  });

  describe('SORT_OPTIONS', () => {
    it('should have correct structure for all options', () => {
      expect(SORT_OPTIONS).toBeDefined();
      expect(Array.isArray(SORT_OPTIONS)).toBe(true);
      expect(SORT_OPTIONS.length).toBeGreaterThan(0);

      SORT_OPTIONS.forEach((option) => {
        expect(option).toHaveProperty('value');
        expect(option).toHaveProperty('label');
        expect(option).toHaveProperty('labelEn');
        expect(typeof option.value).toBe('string');
        expect(typeof option.label).toBe('string');
        expect(typeof option.labelEn).toBe('string');
      });
    });

    it('should contain expected sort options', () => {
      const values = SORT_OPTIONS.map((o) => o.value);

      expect(values).toContain('rating');
      expect(values).toContain('return');
      expect(values).toContain('date');
      expect(values).toContain('downloads');
    });

    it('should have unique values', () => {
      const values = SORT_OPTIONS.map((o) => o.value);
      const uniqueValues = [...new Set(values)];
      expect(values.length).toBe(uniqueValues.length);
    });
  });

  describe('generateMockStrategies', () => {
    it('should generate the requested number of strategies', () => {
      const strategies = generateMockStrategies(5);
      expect(strategies).toHaveLength(5);
    });

    it('should generate default 12 strategies when count not specified', () => {
      const strategies = generateMockStrategies();
      expect(strategies).toHaveLength(12);
    });

    it('should generate strategies with valid structure', () => {
      const strategies = generateMockStrategies(1);
      const strategy = strategies[0];

      expect(strategy).toHaveProperty('id');
      expect(strategy).toHaveProperty('name');
      expect(strategy).toHaveProperty('description');
      expect(strategy).toHaveProperty('author');
      expect(strategy).toHaveProperty('nodes');
      expect(strategy).toHaveProperty('edges');
      expect(strategy).toHaveProperty('performance');
      expect(strategy).toHaveProperty('rating');
      expect(strategy).toHaveProperty('ratingCount');
      expect(strategy).toHaveProperty('tags');
      expect(strategy).toHaveProperty('downloads');
      expect(strategy).toHaveProperty('createdAt');
      expect(strategy).toHaveProperty('updatedAt');
    });

    it('should generate valid performance metrics', () => {
      const strategies = generateMockStrategies(1);
      const { performance } = strategies[0];

      expect(performance).toHaveProperty('totalReturn');
      expect(performance).toHaveProperty('sharpeRatio');
      expect(performance).toHaveProperty('maxDrawdown');
      expect(performance).toHaveProperty('winRate');

      expect(typeof performance.totalReturn).toBe('number');
      expect(typeof performance.sharpeRatio).toBe('number');
      expect(typeof performance.maxDrawdown).toBe('number');
      expect(typeof performance.winRate).toBe('number');
    });

    it('should generate valid rating values', () => {
      const strategies = generateMockStrategies(10);

      strategies.forEach((strategy) => {
        expect(strategy.rating).toBeGreaterThanOrEqual(3);
        expect(strategy.rating).toBeLessThanOrEqual(5);
        expect(strategy.ratingCount).toBeGreaterThanOrEqual(1);
      });
    });

    it('should generate valid ISO date strings', () => {
      const strategies = generateMockStrategies(1);
      const strategy = strategies[0];

      const createdAt = new Date(strategy.createdAt);
      const updatedAt = new Date(strategy.updatedAt);

      expect(createdAt.toISOString()).toBe(strategy.createdAt);
      expect(updatedAt.toISOString()).toBe(strategy.updatedAt);
    });

    it('should generate tags from STRATEGY_TAGS', () => {
      const strategies = generateMockStrategies(10);
      const validTagValues = STRATEGY_TAGS.map((t) => t.value);

      strategies.forEach((strategy) => {
        strategy.tags.forEach((tag) => {
          expect(validTagValues).toContain(tag);
        });
      });
    });

    it('should generate unique IDs', () => {
      const strategies = generateMockStrategies(50);
      const ids = strategies.map((s) => s.id);
      const uniqueIds = [...new Set(ids)];
      expect(ids.length).toBe(uniqueIds.length);
    });

    it('should generate empty arrays for nodes and edges', () => {
      const strategies = generateMockStrategies(1);
      const strategy = strategies[0];

      expect(Array.isArray(strategy.nodes)).toBe(true);
      expect(Array.isArray(strategy.edges)).toBe(true);
    });

    it('should generate valid author names', () => {
      const strategies = generateMockStrategies(10);
      const validAuthors = ['NguyenVanA', 'TraderPro', 'QuantMaster', 'StockGuru', 'InvestorVN'];

      strategies.forEach((strategy) => {
        expect(validAuthors).toContain(strategy.author);
      });
    });

    it('should handle zero count', () => {
      const strategies = generateMockStrategies(0);
      expect(strategies).toHaveLength(0);
    });
  });

  describe('API Functions', () => {
    describe('fetchStrategies', () => {
      it('should call fetch with correct URL and params', async () => {
        const mockResponse = {
          strategies: [],
          total: 0,
          page: 1,
          pageSize: 10,
          totalPages: 0,
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        });

        const params: StrategiesQueryParams = {
          search: 'test',
          tags: ['momentum', 'rsi'],
          sortBy: 'rating',
          sortOrder: 'desc',
          page: 1,
          pageSize: 10,
        };

        await fetchStrategies(params);

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const calledUrl = mockFetch.mock.calls[0][0];
        expect(calledUrl).toContain('/api/strategies?');
        expect(calledUrl).toContain('search=test');
        expect(calledUrl).toContain('tags=momentum%2Crsi');
        expect(calledUrl).toContain('sortBy=rating');
        expect(calledUrl).toContain('sortOrder=desc');
        expect(calledUrl).toContain('page=1');
        expect(calledUrl).toContain('pageSize=10');
      });

      it('should handle empty params', async () => {
        const mockResponse = {
          strategies: [],
          total: 0,
          page: 1,
          pageSize: 10,
          totalPages: 0,
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        });

        await fetchStrategies();

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const calledUrl = mockFetch.mock.calls[0][0];
        expect(calledUrl).toContain('/api/strategies?');
      });

      it('should throw error on non-ok response', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          statusText: 'Internal Server Error',
        });

        await expect(fetchStrategies()).rejects.toThrow('Failed to fetch strategies');
      });
    });

    describe('fetchStrategyById', () => {
      it('should fetch strategy by ID', async () => {
        const mockStrategy: SharedStrategy = {
          id: 'strategy-1',
          name: 'Test Strategy',
          description: 'Test description',
          author: 'Test Author',
          nodes: [],
          edges: [],
          performance: {
            totalReturn: 10,
            sharpeRatio: 1.5,
            maxDrawdown: 5,
            winRate: 60,
          },
          rating: 4.5,
          ratingCount: 10,
          tags: ['momentum'],
          downloads: 100,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockStrategy),
        });

        const result = await fetchStrategyById('strategy-1');

        expect(mockFetch).toHaveBeenCalledWith('/api/strategies/strategy-1');
        expect(result).toEqual(mockStrategy);
      });

      it('should throw 404 error when not found', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        });

        await expect(fetchStrategyById('non-existent')).rejects.toThrow('Strategy not found');
      });

      it('should throw generic error on other failures', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        });

        await expect(fetchStrategyById('strategy-1')).rejects.toThrow('Failed to fetch strategy');
      });
    });

    describe('createStrategy', () => {
      it('should create strategy with POST request', async () => {
        const payload: CreateStrategyPayload = {
          name: 'New Strategy',
          description: 'Test',
          nodes: [],
          edges: [],
          performance: {
            totalReturn: 10,
            sharpeRatio: 1.5,
            maxDrawdown: 5,
            winRate: 60,
          },
          tags: ['momentum'],
        };

        const mockResponse: SharedStrategy = {
          id: 'new-id',
          ...payload,
          author: 'System',
          rating: 0,
          ratingCount: 0,
          downloads: 0,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        });

        const result = await createStrategy(payload);

        expect(mockFetch).toHaveBeenCalledWith(
          '/api/strategies',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
        );
        expect(result).toEqual(mockResponse);
      });

      it('should throw error on failure', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          statusText: 'Bad Request',
        });

        await expect(
          createStrategy({
            name: 'Test',
            description: '',
            nodes: [],
            edges: [],
            performance: { totalReturn: 0, sharpeRatio: 0, maxDrawdown: 0, winRate: 0 },
            tags: [],
          })
        ).rejects.toThrow('Failed to create strategy');
      });
    });

    describe('updateStrategy', () => {
      it('should update strategy with PUT request', async () => {
        const mockResponse: SharedStrategy = {
          id: 'strategy-1',
          name: 'Updated Strategy',
          description: 'Updated',
          author: 'Test',
          nodes: [],
          edges: [],
          performance: { totalReturn: 10, sharpeRatio: 1.5, maxDrawdown: 5, winRate: 60 },
          rating: 4,
          ratingCount: 10,
          tags: ['momentum'],
          downloads: 100,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        });

        const result = await updateStrategy({ id: 'strategy-1', name: 'Updated Strategy' });

        expect(mockFetch).toHaveBeenCalledWith(
          '/api/strategies/strategy-1',
          expect.objectContaining({
            method: 'PUT',
          })
        );
        expect(result.name).toBe('Updated Strategy');
      });

      it('should throw error on failure', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          statusText: 'Not Found',
        });

        await expect(updateStrategy({ id: 'non-existent' })).rejects.toThrow(
          'Failed to update strategy'
        );
      });
    });

    describe('deleteStrategy', () => {
      it('should delete strategy with DELETE request', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
        });

        await deleteStrategy('strategy-1');

        expect(mockFetch).toHaveBeenCalledWith('/api/strategies/strategy-1', {
          method: 'DELETE',
        });
      });

      it('should throw error on failure', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          statusText: 'Not Found',
        });

        await expect(deleteStrategy('non-existent')).rejects.toThrow('Failed to delete strategy');
      });
    });

    describe('rateStrategy', () => {
      it('should rate strategy with POST request', async () => {
        const mockResponse: SharedStrategy = {
          id: 'strategy-1',
          name: 'Test',
          description: '',
          author: 'Test',
          nodes: [],
          edges: [],
          performance: { totalReturn: 10, sharpeRatio: 1.5, maxDrawdown: 5, winRate: 60 },
          rating: 4.5,
          ratingCount: 11,
          tags: [],
          downloads: 100,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        });

        const result = await rateStrategy('strategy-1', 5);

        expect(mockFetch).toHaveBeenCalledWith(
          '/api/strategies/strategy-1/rate',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ rating: 5 }),
          })
        );
        expect(result.ratingCount).toBe(11);
      });

      it('should throw error on failure', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          statusText: 'Bad Request',
        });

        await expect(rateStrategy('strategy-1', 6)).rejects.toThrow('Failed to rate strategy');
      });
    });

    describe('importStrategy', () => {
      it('should import strategy with POST request', async () => {
        const mockResponse: SharedStrategy = {
          id: 'imported-strategy',
          name: 'Imported Strategy',
          description: '',
          author: 'Original Author',
          nodes: [],
          edges: [],
          performance: { totalReturn: 10, sharpeRatio: 1.5, maxDrawdown: 5, winRate: 60 },
          rating: 4,
          ratingCount: 10,
          tags: [],
          downloads: 100,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        });

        const result = await importStrategy('strategy-1');

        expect(mockFetch).toHaveBeenCalledWith('/api/strategies/strategy-1/import', {
          method: 'POST',
        });
        expect(result.id).toBe('imported-strategy');
      });

      it('should throw error on failure', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          statusText: 'Not Found',
        });

        await expect(importStrategy('non-existent')).rejects.toThrow('Failed to import strategy');
      });
    });
  });
});
