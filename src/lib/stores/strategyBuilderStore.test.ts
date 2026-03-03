import { act, renderHook } from '@testing-library/react';
import type { NodeChange } from '@xyflow/react';
import {
  useStrategyBuilderStore,
  useCurrentStrategy,
  useSelectedNode,
  useIsDirty,
  type StrategyNode,
  type StrategyEdge,
} from './strategyBuilderStore';

// Helper to create a test node
const createTestNode = (id: string): StrategyNode => ({
  id,
  type: 'dataSource',
  position: { x: 0, y: 0 },
  data: {
    type: 'dataSource',
    label: 'Test Node',
    config: {
      label: 'Test Node',
      stocks: ['VNM'],
      timeframe: '1d',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
    },
  },
});

const createIndicatorNode = (id: string): StrategyNode => ({
  id,
  type: 'indicator',
  position: { x: 0, y: 0 },
  data: {
    type: 'indicator',
    label: 'RSI',
    config: {
      label: 'RSI',
      indicatorType: 'rsi',
      period: 14,
    },
  },
});

// Helper to create a test edge
const createTestEdge = (id: string, source: string, target: string): StrategyEdge => ({
  id,
  source,
  target,
});

// Reset store before each test
beforeEach(() => {
  act(() => {
    useStrategyBuilderStore.getState().reset();
  });
});

describe('strategyBuilderStore', () => {
  describe('initial state', () => {
    it('should have null currentStrategy initially', () => {
      const { currentStrategy } = useStrategyBuilderStore.getState();
      expect(currentStrategy).toBeNull();
    });

    it('should have null selectedNodeId initially', () => {
      const { selectedNodeId } = useStrategyBuilderStore.getState();
      expect(selectedNodeId).toBeNull();
    });

    it('should have isDirty false initially', () => {
      const { isDirty } = useStrategyBuilderStore.getState();
      expect(isDirty).toBe(false);
    });

    it('should have isSaving false initially', () => {
      const { isSaving } = useStrategyBuilderStore.getState();
      expect(isSaving).toBe(false);
    });
  });

  describe('createNewStrategy', () => {
    it('should create a new strategy with given name', () => {
      act(() => {
        useStrategyBuilderStore.getState().createNewStrategy('Test Strategy');
      });

      const { currentStrategy } = useStrategyBuilderStore.getState();
      expect(currentStrategy).not.toBeNull();
      expect(currentStrategy?.name).toBe('Test Strategy');
    });

    it('should create a new strategy with description', () => {
      act(() => {
        useStrategyBuilderStore.getState().createNewStrategy('Test Strategy', 'Test Description');
      });

      const { currentStrategy } = useStrategyBuilderStore.getState();
      expect(currentStrategy?.description).toBe('Test Description');
    });

    it('should initialize with empty nodes and edges', () => {
      act(() => {
        useStrategyBuilderStore.getState().createNewStrategy('Test Strategy');
      });

      const { currentStrategy } = useStrategyBuilderStore.getState();
      expect(currentStrategy?.nodes).toEqual([]);
      expect(currentStrategy?.edges).toEqual([]);
    });

    it('should reset selectedNodeId when creating new strategy', () => {
      // First create and select a node
      act(() => {
        useStrategyBuilderStore.getState().createNewStrategy('Test');
        useStrategyBuilderStore.getState().setSelectedNode('some-id');
      });

      expect(useStrategyBuilderStore.getState().selectedNodeId).toBe('some-id');

      act(() => {
        useStrategyBuilderStore.getState().createNewStrategy('New Strategy');
      });

      expect(useStrategyBuilderStore.getState().selectedNodeId).toBeNull();
    });

    it('should reset isDirty when creating new strategy', () => {
      act(() => {
        useStrategyBuilderStore.getState().createNewStrategy('Test');
        useStrategyBuilderStore.getState().addNode(createTestNode('node-1'));
      });

      expect(useStrategyBuilderStore.getState().isDirty).toBe(true);

      act(() => {
        useStrategyBuilderStore.getState().createNewStrategy('New Strategy');
      });

      expect(useStrategyBuilderStore.getState().isDirty).toBe(false);
    });
  });

  describe('loadStrategy', () => {
    it('should load an existing strategy', () => {
      const strategy = {
        id: 'strategy-1',
        name: 'Loaded Strategy',
        nodes: [createTestNode('node-1')],
        edges: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      act(() => {
        useStrategyBuilderStore.getState().loadStrategy(strategy);
      });

      const { currentStrategy } = useStrategyBuilderStore.getState();
      expect(currentStrategy?.id).toBe('strategy-1');
      expect(currentStrategy?.name).toBe('Loaded Strategy');
      expect(currentStrategy?.nodes.length).toBe(1);
    });
  });

  describe('addNode', () => {
    it('should add a node to current strategy', () => {
      act(() => {
        useStrategyBuilderStore.getState().createNewStrategy('Test');
        useStrategyBuilderStore.getState().addNode(createTestNode('node-1'));
      });

      const { currentStrategy } = useStrategyBuilderStore.getState();
      expect(currentStrategy?.nodes.length).toBe(1);
      expect(currentStrategy?.nodes[0].id).toBe('node-1');
    });

    it('should set isDirty to true when adding node', () => {
      act(() => {
        useStrategyBuilderStore.getState().createNewStrategy('Test');
      });

      expect(useStrategyBuilderStore.getState().isDirty).toBe(false);

      act(() => {
        useStrategyBuilderStore.getState().addNode(createTestNode('node-1'));
      });

      expect(useStrategyBuilderStore.getState().isDirty).toBe(true);
    });

    it('should not add node if no current strategy', () => {
      act(() => {
        useStrategyBuilderStore.getState().addNode(createTestNode('node-1'));
      });

      const { currentStrategy } = useStrategyBuilderStore.getState();
      expect(currentStrategy).toBeNull();
    });
  });

  describe('deleteNode', () => {
    it('should remove a node from current strategy', () => {
      act(() => {
        useStrategyBuilderStore.getState().createNewStrategy('Test');
        useStrategyBuilderStore.getState().addNode(createTestNode('node-1'));
        useStrategyBuilderStore.getState().addNode(createTestNode('node-2'));
      });

      expect(useStrategyBuilderStore.getState().currentStrategy?.nodes.length).toBe(2);

      act(() => {
        useStrategyBuilderStore.getState().deleteNode('node-1');
      });

      const { currentStrategy } = useStrategyBuilderStore.getState();
      expect(currentStrategy?.nodes.length).toBe(1);
      expect(currentStrategy?.nodes[0].id).toBe('node-2');
    });

    it('should remove edges connected to deleted node', () => {
      act(() => {
        useStrategyBuilderStore.getState().createNewStrategy('Test');
        useStrategyBuilderStore.getState().addNode(createTestNode('node-1'));
        useStrategyBuilderStore.getState().addNode(createIndicatorNode('node-2'));
        useStrategyBuilderStore.getState().addEdge(createTestEdge('edge-1', 'node-1', 'node-2'));
      });

      expect(useStrategyBuilderStore.getState().currentStrategy?.edges.length).toBe(1);

      act(() => {
        useStrategyBuilderStore.getState().deleteNode('node-1');
      });

      const { currentStrategy } = useStrategyBuilderStore.getState();
      expect(currentStrategy?.edges.length).toBe(0);
    });

    it('should clear selectedNodeId if deleted node was selected', () => {
      act(() => {
        useStrategyBuilderStore.getState().createNewStrategy('Test');
        useStrategyBuilderStore.getState().addNode(createTestNode('node-1'));
        useStrategyBuilderStore.getState().setSelectedNode('node-1');
      });

      expect(useStrategyBuilderStore.getState().selectedNodeId).toBe('node-1');

      act(() => {
        useStrategyBuilderStore.getState().deleteNode('node-1');
      });

      expect(useStrategyBuilderStore.getState().selectedNodeId).toBeNull();
    });

    it('should set isDirty to true when deleting node', async () => {
      act(() => {
        useStrategyBuilderStore.getState().createNewStrategy('Test');
        useStrategyBuilderStore.getState().addNode(createTestNode('node-1'));
      });

      // Wait for save to complete
      await act(async () => {
        await useStrategyBuilderStore.getState().saveStrategy();
      });

      // isDirty should be false after save
      expect(useStrategyBuilderStore.getState().isDirty).toBe(false);

      act(() => {
        useStrategyBuilderStore.getState().deleteNode('node-1');
      });

      expect(useStrategyBuilderStore.getState().isDirty).toBe(true);
    });
  });

  describe('onNodesChange', () => {
    it('should handle position changes', () => {
      act(() => {
        useStrategyBuilderStore.getState().createNewStrategy('Test');
        useStrategyBuilderStore.getState().addNode(createTestNode('node-1'));
      });

      act(() => {
        useStrategyBuilderStore.getState().onNodesChange([
          {
            type: 'position',
            id: 'node-1',
            position: { x: 100, y: 200 },
          } as NodeChange<StrategyNode>,
        ]);
      });

      const node = useStrategyBuilderStore.getState().currentStrategy?.nodes[0];
      expect(node?.position).toEqual({ x: 100, y: 200 });
    });

    it('should set isDirty to true on position change', async () => {
      act(() => {
        useStrategyBuilderStore.getState().createNewStrategy('Test');
        useStrategyBuilderStore.getState().addNode(createTestNode('node-1'));
      });

      // Wait for save to complete
      await act(async () => {
        await useStrategyBuilderStore.getState().saveStrategy();
      });

      expect(useStrategyBuilderStore.getState().isDirty).toBe(false);

      act(() => {
        useStrategyBuilderStore.getState().onNodesChange([
          {
            type: 'position',
            id: 'node-1',
            position: { x: 100, y: 200 },
          } as NodeChange<StrategyNode>,
        ]);
      });

      expect(useStrategyBuilderStore.getState().isDirty).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      act(() => {
        useStrategyBuilderStore.getState().createNewStrategy('Test');
        useStrategyBuilderStore.getState().addNode(createTestNode('node-1'));
        useStrategyBuilderStore.getState().setSelectedNode('node-1');
      });

      act(() => {
        useStrategyBuilderStore.getState().reset();
      });

      const state = useStrategyBuilderStore.getState();
      expect(state.currentStrategy).toBeNull();
      expect(state.selectedNodeId).toBeNull();
      expect(state.isDirty).toBe(false);
      expect(state.isSaving).toBe(false);
    });
  });

  describe('setSelectedNode', () => {
    it('should set selected node id', () => {
      act(() => {
        useStrategyBuilderStore.getState().setSelectedNode('node-1');
      });

      expect(useStrategyBuilderStore.getState().selectedNodeId).toBe('node-1');
    });

    it('should clear selected node id when set to null', () => {
      act(() => {
        useStrategyBuilderStore.getState().setSelectedNode('node-1');
      });

      expect(useStrategyBuilderStore.getState().selectedNodeId).toBe('node-1');

      act(() => {
        useStrategyBuilderStore.getState().setSelectedNode(null);
      });

      expect(useStrategyBuilderStore.getState().selectedNodeId).toBeNull();
    });
  });

  describe('addEdge', () => {
    it('should add an edge to current strategy', () => {
      act(() => {
        useStrategyBuilderStore.getState().createNewStrategy('Test');
        useStrategyBuilderStore.getState().addNode(createTestNode('node-1'));
        useStrategyBuilderStore.getState().addNode(createIndicatorNode('node-2'));
        useStrategyBuilderStore.getState().addEdge(createTestEdge('edge-1', 'node-1', 'node-2'));
      });

      const { currentStrategy } = useStrategyBuilderStore.getState();
      expect(currentStrategy?.edges.length).toBe(1);
      expect(currentStrategy?.edges[0].source).toBe('node-1');
      expect(currentStrategy?.edges[0].target).toBe('node-2');
    });

    it('should not add duplicate edges', () => {
      act(() => {
        useStrategyBuilderStore.getState().createNewStrategy('Test');
        useStrategyBuilderStore.getState().addNode(createTestNode('node-1'));
        useStrategyBuilderStore.getState().addNode(createIndicatorNode('node-2'));
        useStrategyBuilderStore.getState().addEdge(createTestEdge('edge-1', 'node-1', 'node-2'));
        useStrategyBuilderStore.getState().addEdge(createTestEdge('edge-2', 'node-1', 'node-2'));
      });

      const { currentStrategy } = useStrategyBuilderStore.getState();
      expect(currentStrategy?.edges.length).toBe(1);
    });
  });

  describe('saveStrategy', () => {
    it('should set isSaving to true during save', async () => {
      act(() => {
        useStrategyBuilderStore.getState().createNewStrategy('Test');
      });

      const savePromise = act(async () => {
        return useStrategyBuilderStore.getState().saveStrategy();
      });

      // Check isSaving right after starting
      expect(useStrategyBuilderStore.getState().isSaving).toBe(true);

      await savePromise;
    });

    it('should set isSaving to false after save completes', async () => {
      act(() => {
        useStrategyBuilderStore.getState().createNewStrategy('Test');
      });

      await act(async () => {
        await useStrategyBuilderStore.getState().saveStrategy();
      });

      expect(useStrategyBuilderStore.getState().isSaving).toBe(false);
    });

    it('should set isDirty to false after save', async () => {
      act(() => {
        useStrategyBuilderStore.getState().createNewStrategy('Test');
        useStrategyBuilderStore.getState().addNode(createTestNode('node-1'));
      });

      expect(useStrategyBuilderStore.getState().isDirty).toBe(true);

      await act(async () => {
        await useStrategyBuilderStore.getState().saveStrategy();
      });

      expect(useStrategyBuilderStore.getState().isDirty).toBe(false);
    });
  });

  describe('helper hooks', () => {
    describe('useCurrentStrategy', () => {
      it('should return current strategy', () => {
        act(() => {
          useStrategyBuilderStore.getState().createNewStrategy('Test Strategy');
        });

        const { result } = renderHook(() => useCurrentStrategy());
        expect(result.current?.name).toBe('Test Strategy');
      });
    });

    describe('useSelectedNode', () => {
      it('should return null when no node is selected', () => {
        const { result } = renderHook(() => useSelectedNode());
        expect(result.current).toBeNull();
      });

      it('should return selected node', () => {
        act(() => {
          useStrategyBuilderStore.getState().createNewStrategy('Test');
          useStrategyBuilderStore.getState().addNode(createTestNode('node-1'));
          useStrategyBuilderStore.getState().setSelectedNode('node-1');
        });

        const { result } = renderHook(() => useSelectedNode());
        expect(result.current?.id).toBe('node-1');
      });
    });

    describe('useIsDirty', () => {
      it('should return isDirty value', () => {
        const { result } = renderHook(() => useIsDirty());
        expect(result.current).toBe(false);

        act(() => {
          useStrategyBuilderStore.getState().createNewStrategy('Test');
          useStrategyBuilderStore.getState().addNode(createTestNode('node-1'));
        });

        const { result: newResult } = renderHook(() => useIsDirty());
        expect(newResult.current).toBe(true);
      });
    });
  });
});
