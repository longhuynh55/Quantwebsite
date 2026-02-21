/**
 * Unit tests for ChartSyncProvider.tsx
 * Tests for chart synchronization context provider
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  ChartSyncProvider,
  useChartSyncContext,
  useChartSyncContextOptional,
  ChartSyncContext,
  type ChartSyncContextValue,
} from '../ChartSyncProvider';

// Test component to access context
const TestConsumer = ({
  onContextChange,
}: {
  onContextChange?: (context: ChartSyncContextValue) => void;
}) => {
  const context = useChartSyncContext();
  React.useEffect(() => {
    onContextChange?.(context);
  }, [context, onContextChange]);
  return (
    <div>
      <span data-testid="sync-enabled">{context.isSyncEnabled.toString()}</span>
      <span data-testid="active-chart">{context.activeChartId ?? 'null'}</span>
      <span data-testid="crosshair-x">{context.crosshairPosition.x ?? 'null'}</span>
      <span data-testid="crosshair-y">{context.crosshairPosition.y ?? 'null'}</span>
      <span data-testid="crosshair-time">{context.crosshairPosition.time ?? 'null'}</span>
      <button data-testid="toggle-sync" onClick={context.toggleSync}>
        Toggle Sync
      </button>
      <button
        data-testid="update-crosshair"
        onClick={() =>
          context.updateCrosshair('chart-1', {
            x: 100,
            y: 200,
            time: '2024-01-01',
            value: 50.5,
          })
        }
      >
        Update Crosshair
      </button>
      <button
        data-testid="update-time-range"
        onClick={() =>
          context.updateTimeRange('chart-1', {
            from: '2024-01-01',
            to: '2024-12-31',
          })
        }
      >
        Update Time Range
      </button>
      <button data-testid="clear-crosshair" onClick={() => context.clearCrosshair('chart-1')}>
        Clear Crosshair
      </button>
      <button data-testid="register-chart" onClick={() => context.registerChart('chart-1')}>
        Register Chart
      </button>
      <button data-testid="unregister-chart" onClick={() => context.unregisterChart('chart-1')}>
        Unregister Chart
      </button>
      <button data-testid="enable-sync" onClick={context.enableSync}>
        Enable Sync
      </button>
      <button data-testid="disable-sync" onClick={context.disableSync}>
        Disable Sync
      </button>
    </div>
  );
};

describe('ChartSyncProvider', () => {
  describe('Provider rendering', () => {
    it('should render children', () => {
      render(
        <ChartSyncProvider>
          <div data-testid="child">Child Content</div>
        </ChartSyncProvider>
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
      expect(screen.getByText('Child Content')).toBeInTheDocument();
    });

    it('should provide default sync enabled state', () => {
      render(
        <ChartSyncProvider>
          <TestConsumer />
        </ChartSyncProvider>
      );

      expect(screen.getByTestId('sync-enabled')).toHaveTextContent('true');
    });

    it('should respect defaultEnabled prop', () => {
      render(
        <ChartSyncProvider defaultEnabled={false}>
          <TestConsumer />
        </ChartSyncProvider>
      );

      expect(screen.getByTestId('sync-enabled')).toHaveTextContent('false');
    });
  });

  describe('Context default state', () => {
    it('should provide null crosshair position by default', () => {
      render(
        <ChartSyncProvider>
          <TestConsumer />
        </ChartSyncProvider>
      );

      expect(screen.getByTestId('crosshair-x')).toHaveTextContent('null');
      expect(screen.getByTestId('crosshair-y')).toHaveTextContent('null');
      expect(screen.getByTestId('crosshair-time')).toHaveTextContent('null');
    });

    it('should provide null active chart by default', () => {
      render(
        <ChartSyncProvider>
          <TestConsumer />
        </ChartSyncProvider>
      );

      expect(screen.getByTestId('active-chart')).toHaveTextContent('null');
    });
  });

  describe('toggleSync', () => {
    it('should toggle isSyncEnabled from true to false', () => {
      render(
        <ChartSyncProvider defaultEnabled={true}>
          <TestConsumer />
        </ChartSyncProvider>
      );

      expect(screen.getByTestId('sync-enabled')).toHaveTextContent('true');

      fireEvent.click(screen.getByTestId('toggle-sync'));

      expect(screen.getByTestId('sync-enabled')).toHaveTextContent('false');
    });

    it('should toggle isSyncEnabled from false to true', () => {
      render(
        <ChartSyncProvider defaultEnabled={false}>
          <TestConsumer />
        </ChartSyncProvider>
      );

      expect(screen.getByTestId('sync-enabled')).toHaveTextContent('false');

      fireEvent.click(screen.getByTestId('toggle-sync'));

      expect(screen.getByTestId('sync-enabled')).toHaveTextContent('true');
    });

    it('should clear state when disabling sync', () => {
      render(
        <ChartSyncProvider defaultEnabled={true}>
          <TestConsumer />
        </ChartSyncProvider>
      );

      // First update crosshair
      fireEvent.click(screen.getByTestId('update-crosshair'));
      expect(screen.getByTestId('crosshair-x')).toHaveTextContent('100');

      // Toggle sync off
      fireEvent.click(screen.getByTestId('toggle-sync'));

      expect(screen.getByTestId('sync-enabled')).toHaveTextContent('false');
      expect(screen.getByTestId('crosshair-x')).toHaveTextContent('null');
      expect(screen.getByTestId('active-chart')).toHaveTextContent('null');
    });
  });

  describe('enableSync', () => {
    it('should enable sync', () => {
      render(
        <ChartSyncProvider defaultEnabled={false}>
          <TestConsumer />
        </ChartSyncProvider>
      );

      expect(screen.getByTestId('sync-enabled')).toHaveTextContent('false');

      fireEvent.click(screen.getByTestId('enable-sync'));

      expect(screen.getByTestId('sync-enabled')).toHaveTextContent('true');
    });
  });

  describe('disableSync', () => {
    it('should disable sync and clear state', () => {
      render(
        <ChartSyncProvider defaultEnabled={true}>
          <TestConsumer />
        </ChartSyncProvider>
      );

      // Update crosshair first
      fireEvent.click(screen.getByTestId('update-crosshair'));
      expect(screen.getByTestId('crosshair-x')).toHaveTextContent('100');

      // Disable sync
      fireEvent.click(screen.getByTestId('disable-sync'));

      expect(screen.getByTestId('sync-enabled')).toHaveTextContent('false');
      expect(screen.getByTestId('crosshair-x')).toHaveTextContent('null');
      expect(screen.getByTestId('active-chart')).toHaveTextContent('null');
    });
  });

  describe('updateCrosshair', () => {
    it('should update crosshair position when sync is enabled', () => {
      render(
        <ChartSyncProvider defaultEnabled={true}>
          <TestConsumer />
        </ChartSyncProvider>
      );

      fireEvent.click(screen.getByTestId('update-crosshair'));

      expect(screen.getByTestId('crosshair-x')).toHaveTextContent('100');
      expect(screen.getByTestId('crosshair-y')).toHaveTextContent('200');
      expect(screen.getByTestId('crosshair-time')).toHaveTextContent('2024-01-01');
      expect(screen.getByTestId('active-chart')).toHaveTextContent('chart-1');
    });

    it('should not update crosshair position when sync is disabled', () => {
      render(
        <ChartSyncProvider defaultEnabled={false}>
          <TestConsumer />
        </ChartSyncProvider>
      );

      fireEvent.click(screen.getByTestId('update-crosshair'));

      expect(screen.getByTestId('crosshair-x')).toHaveTextContent('null');
      expect(screen.getByTestId('active-chart')).toHaveTextContent('null');
    });
  });

  describe('updateTimeRange', () => {
    it('should update time range when sync is enabled', () => {
      const TimeRangeConsumer = () => {
        const context = useChartSyncContext();
        return (
          <div>
            <span data-testid="time-range-from">{context.timeRange?.from ?? 'null'}</span>
            <span data-testid="time-range-to">{context.timeRange?.to ?? 'null'}</span>
            <button
              data-testid="update-time-range"
              onClick={() =>
                context.updateTimeRange('chart-1', {
                  from: '2024-01-01',
                  to: '2024-12-31',
                })
              }
            >
              Update
            </button>
          </div>
        );
      };

      render(
        <ChartSyncProvider defaultEnabled={true}>
          <TimeRangeConsumer />
        </ChartSyncProvider>
      );

      fireEvent.click(screen.getByTestId('update-time-range'));

      expect(screen.getByTestId('time-range-from')).toHaveTextContent('2024-01-01');
      expect(screen.getByTestId('time-range-to')).toHaveTextContent('2024-12-31');
    });

    it('should not update time range when sync is disabled', () => {
      const TimeRangeConsumer = () => {
        const context = useChartSyncContext();
        return (
          <div>
            <span data-testid="time-range">{context.timeRange ? 'has-value' : 'null'}</span>
            <button
              data-testid="update-time-range"
              onClick={() =>
                context.updateTimeRange('chart-1', {
                  from: '2024-01-01',
                  to: '2024-12-31',
                })
              }
            >
              Update
            </button>
          </div>
        );
      };

      render(
        <ChartSyncProvider defaultEnabled={false}>
          <TimeRangeConsumer />
        </ChartSyncProvider>
      );

      fireEvent.click(screen.getByTestId('update-time-range'));

      expect(screen.getByTestId('time-range')).toHaveTextContent('null');
    });
  });

  describe('clearCrosshair', () => {
    it('should clear crosshair when called by active chart', () => {
      render(
        <ChartSyncProvider defaultEnabled={true}>
          <TestConsumer />
        </ChartSyncProvider>
      );

      // First update crosshair
      fireEvent.click(screen.getByTestId('update-crosshair'));
      expect(screen.getByTestId('crosshair-x')).toHaveTextContent('100');

      // Clear crosshair from same chart
      fireEvent.click(screen.getByTestId('clear-crosshair'));

      expect(screen.getByTestId('crosshair-x')).toHaveTextContent('null');
      expect(screen.getByTestId('active-chart')).toHaveTextContent('null');
    });

    it('should not clear crosshair when called by non-active chart', () => {
      const MultiChartConsumer = () => {
        const context = useChartSyncContext();
        return (
          <div>
            <span data-testid="crosshair-x">{context.crosshairPosition.x ?? 'null'}</span>
            <button
              data-testid="update-from-chart1"
              onClick={() =>
                context.updateCrosshair('chart-1', {
                  x: 100,
                  y: 200,
                  time: '2024-01-01',
                  value: 50,
                })
              }
            >
              Update from Chart 1
            </button>
            <button
              data-testid="clear-from-chart2"
              onClick={() => context.clearCrosshair('chart-2')}
            >
              Clear from Chart 2
            </button>
          </div>
        );
      };

      render(
        <ChartSyncProvider defaultEnabled={true}>
          <MultiChartConsumer />
        </ChartSyncProvider>
      );

      // Update from chart-1
      fireEvent.click(screen.getByTestId('update-from-chart1'));
      expect(screen.getByTestId('crosshair-x')).toHaveTextContent('100');

      // Try to clear from chart-2 (not the active chart)
      fireEvent.click(screen.getByTestId('clear-from-chart2'));

      // Crosshair should still be there
      expect(screen.getByTestId('crosshair-x')).toHaveTextContent('100');
    });
  });

  describe('registerChart / unregisterChart', () => {
    it('should register and unregister charts', () => {
      // This is mostly for internal tracking, but we can test the behavior
      render(
        <ChartSyncProvider defaultEnabled={true}>
          <TestConsumer />
        </ChartSyncProvider>
      );

      // Register a chart
      fireEvent.click(screen.getByTestId('register-chart'));

      // Update crosshair
      fireEvent.click(screen.getByTestId('update-crosshair'));
      expect(screen.getByTestId('active-chart')).toHaveTextContent('chart-1');

      // Unregister the chart - should clear crosshair
      fireEvent.click(screen.getByTestId('unregister-chart'));

      expect(screen.getByTestId('crosshair-x')).toHaveTextContent('null');
      expect(screen.getByTestId('active-chart')).toHaveTextContent('null');
    });
  });
});

describe('useChartSyncContext', () => {
  it('should throw error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const TestComponentWithoutProvider = () => {
      useChartSyncContext();
      return null;
    };

    expect(() => render(<TestComponentWithoutProvider />)).toThrow(
      'useChartSyncContext must be used within a ChartSyncProvider'
    );

    consoleSpy.mockRestore();
  });
});

describe('useChartSyncContextOptional', () => {
  it('should return null when used outside provider', () => {
    const TestOptionalConsumer = () => {
      const context = useChartSyncContextOptional();
      return <span data-testid="context-value">{context === null ? 'null' : 'has-value'}</span>;
    };

    render(<TestOptionalConsumer />);

    expect(screen.getByTestId('context-value')).toHaveTextContent('null');
  });

  it('should return context value when used inside provider', () => {
    const TestOptionalConsumer = () => {
      const context = useChartSyncContextOptional();
      return (
        <span data-testid="context-value">
          {context === null ? 'null' : context.isSyncEnabled.toString()}
        </span>
      );
    };

    render(
      <ChartSyncProvider>
        <TestOptionalConsumer />
      </ChartSyncProvider>
    );

    expect(screen.getByTestId('context-value')).toHaveTextContent('true');
  });
});

describe('ChartSyncContext', () => {
  it('should be exported for direct use if needed', () => {
    expect(ChartSyncContext).toBeDefined();
    expect(ChartSyncContext.Provider).toBeDefined();
    expect(ChartSyncContext.Consumer).toBeDefined();
  });
});
