/**
 * Unit tests for useChartSync.ts
 * Tests for chart synchronization hook
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useChartSync } from '../useChartSync';
import {
  ChartSyncProvider,
  type CrosshairPosition,
  type TimeRange,
} from '@/components/charts/sync/ChartSyncProvider';

// Test component that uses the hook
interface TestChartComponentProps {
  chartId: string;
  onCrosshairMove?: (position: CrosshairPosition) => void;
  onTimeRangeChange?: (range: TimeRange) => void;
  onCrosshairLeave?: () => void;
}

const TestChartComponent = ({
  chartId,
  onCrosshairMove,
  onTimeRangeChange,
  onCrosshairLeave,
}: TestChartComponentProps) => {
  const {
    isSyncEnabled,
    isActiveChart,
    crosshairPosition,
    timeRange,
    handleCrosshairMove,
    handleTimeRangeChange,
    handleCrosshairLeave,
  } = useChartSync({
    chartId,
    onCrosshairMove,
    onTimeRangeChange,
    onCrosshairLeave,
  });

  return (
    <div>
      <span data-testid={`sync-enabled-${chartId}`}>{isSyncEnabled.toString()}</span>
      <span data-testid={`active-chart-${chartId}`}>{isActiveChart.toString()}</span>
      <span data-testid={`crosshair-x-${chartId}`}>{crosshairPosition.x ?? 'null'}</span>
      <span data-testid={`crosshair-y-${chartId}`}>{crosshairPosition.y ?? 'null'}</span>
      <span data-testid={`crosshair-time-${chartId}`}>{crosshairPosition.time ?? 'null'}</span>
      <span data-testid={`time-range-${chartId}`}>
        {timeRange ? `${timeRange.from}-${timeRange.to}` : 'null'}
      </span>
      <button
        data-testid={`move-crosshair-${chartId}`}
        onClick={() =>
          handleCrosshairMove({
            x: 100,
            y: 200,
            time: '2024-01-01',
            value: 50.5,
          })
        }
      >
        Move Crosshair
      </button>
      <button
        data-testid={`change-time-range-${chartId}`}
        onClick={() =>
          handleTimeRangeChange({
            from: '2024-01-01',
            to: '2024-12-31',
          })
        }
      >
        Change Time Range
      </button>
      <button
        data-testid={`leave-crosshair-${chartId}`}
        onClick={() => handleCrosshairLeave()}
      >
        Leave Crosshair
      </button>
    </div>
  );
};

describe('useChartSync', () => {
  describe('Hook return values', () => {
    it('should return correct initial values when inside provider', () => {
      render(
        <ChartSyncProvider>
          <TestChartComponent chartId="chart-1" />
        </ChartSyncProvider>
      );

      expect(screen.getByTestId('sync-enabled-chart-1')).toHaveTextContent('true');
      expect(screen.getByTestId('active-chart-chart-1')).toHaveTextContent('false');
      expect(screen.getByTestId('crosshair-x-chart-1')).toHaveTextContent('null');
      expect(screen.getByTestId('time-range-chart-1')).toHaveTextContent('null');
    });

    it('should return default values when outside provider', () => {
      render(<TestChartComponent chartId="chart-1" />);

      expect(screen.getByTestId('sync-enabled-chart-1')).toHaveTextContent('false');
      expect(screen.getByTestId('active-chart-chart-1')).toHaveTextContent('false');
      expect(screen.getByTestId('crosshair-x-chart-1')).toHaveTextContent('null');
      expect(screen.getByTestId('time-range-chart-1')).toHaveTextContent('null');
    });

    it('should return isSyncEnabled based on provider state', () => {
      render(
        <ChartSyncProvider defaultEnabled={false}>
          <TestChartComponent chartId="chart-1" />
        </ChartSyncProvider>
      );

      expect(screen.getByTestId('sync-enabled-chart-1')).toHaveTextContent('false');
    });
  });

  describe('handleCrosshairMove', () => {
    it('should update context crosshair position', () => {
      render(
        <ChartSyncProvider defaultEnabled={true}>
          <TestChartComponent chartId="chart-1" />
        </ChartSyncProvider>
      );

      fireEvent.click(screen.getByTestId('move-crosshair-chart-1'));

      expect(screen.getByTestId('crosshair-x-chart-1')).toHaveTextContent('100');
      expect(screen.getByTestId('crosshair-y-chart-1')).toHaveTextContent('200');
      expect(screen.getByTestId('crosshair-time-chart-1')).toHaveTextContent('2024-01-01');
    });

    it('should call onCrosshairMove callback', () => {
      const onCrosshairMove = jest.fn();

      render(
        <ChartSyncProvider>
          <TestChartComponent chartId="chart-1" onCrosshairMove={onCrosshairMove} />
        </ChartSyncProvider>
      );

      fireEvent.click(screen.getByTestId('move-crosshair-chart-1'));

      expect(onCrosshairMove).toHaveBeenCalledWith({
        x: 100,
        y: 200,
        time: '2024-01-01',
        value: 50.5,
      });
    });

    it('should set isActiveChart to true when moving crosshair', () => {
      render(
        <ChartSyncProvider defaultEnabled={true}>
          <TestChartComponent chartId="chart-1" />
        </ChartSyncProvider>
      );

      expect(screen.getByTestId('active-chart-chart-1')).toHaveTextContent('false');

      fireEvent.click(screen.getByTestId('move-crosshair-chart-1'));

      expect(screen.getByTestId('active-chart-chart-1')).toHaveTextContent('true');
    });

    it('should not crash when used outside provider', () => {
      render(<TestChartComponent chartId="chart-1" />);

      // Should not throw
      expect(() => {
        fireEvent.click(screen.getByTestId('move-crosshair-chart-1'));
      }).not.toThrow();
    });
  });

  describe('handleTimeRangeChange', () => {
    it('should update context time range', () => {
      render(
        <ChartSyncProvider defaultEnabled={true}>
          <TestChartComponent chartId="chart-1" />
        </ChartSyncProvider>
      );

      fireEvent.click(screen.getByTestId('change-time-range-chart-1'));

      expect(screen.getByTestId('time-range-chart-1')).toHaveTextContent(
        '2024-01-01-2024-12-31'
      );
    });

    it('should call onTimeRangeChange callback', () => {
      const onTimeRangeChange = jest.fn();

      render(
        <ChartSyncProvider>
          <TestChartComponent chartId="chart-1" onTimeRangeChange={onTimeRangeChange} />
        </ChartSyncProvider>
      );

      fireEvent.click(screen.getByTestId('change-time-range-chart-1'));

      expect(onTimeRangeChange).toHaveBeenCalledWith({
        from: '2024-01-01',
        to: '2024-12-31',
      });
    });

    it('should set isActiveChart to true when changing time range', () => {
      render(
        <ChartSyncProvider defaultEnabled={true}>
          <TestChartComponent chartId="chart-1" />
        </ChartSyncProvider>
      );

      fireEvent.click(screen.getByTestId('change-time-range-chart-1'));

      expect(screen.getByTestId('active-chart-chart-1')).toHaveTextContent('true');
    });
  });

  describe('handleCrosshairLeave', () => {
    it('should clear crosshair when active chart leaves', () => {
      render(
        <ChartSyncProvider defaultEnabled={true}>
          <TestChartComponent chartId="chart-1" />
        </ChartSyncProvider>
      );

      // First move crosshair
      fireEvent.click(screen.getByTestId('move-crosshair-chart-1'));
      expect(screen.getByTestId('crosshair-x-chart-1')).toHaveTextContent('100');

      // Then leave
      fireEvent.click(screen.getByTestId('leave-crosshair-chart-1'));

      expect(screen.getByTestId('crosshair-x-chart-1')).toHaveTextContent('null');
    });

    it('should call onCrosshairLeave callback', () => {
      const onCrosshairLeave = jest.fn();

      render(
        <ChartSyncProvider>
          <TestChartComponent chartId="chart-1" onCrosshairLeave={onCrosshairLeave} />
        </ChartSyncProvider>
      );

      fireEvent.click(screen.getByTestId('leave-crosshair-chart-1'));

      expect(onCrosshairLeave).toHaveBeenCalled();
    });
  });

  describe('Multi-chart synchronization', () => {
    it('should sync crosshair between multiple charts', async () => {
      const onCrosshairMove1 = jest.fn();
      const onCrosshairMove2 = jest.fn();

      render(
        <ChartSyncProvider defaultEnabled={true}>
          <TestChartComponent chartId="chart-1" onCrosshairMove={onCrosshairMove1} />
          <TestChartComponent chartId="chart-2" onCrosshairMove={onCrosshairMove2} />
        </ChartSyncProvider>
      );

      // Move crosshair on chart-1
      fireEvent.click(screen.getByTestId('move-crosshair-chart-1'));

      // Chart-1 should be active
      expect(screen.getByTestId('active-chart-chart-1')).toHaveTextContent('true');
      expect(screen.getByTestId('active-chart-chart-2')).toHaveTextContent('false');

      // Chart-2 should receive the crosshair update via callback
      await waitFor(() => {
        expect(onCrosshairMove2).toHaveBeenCalledWith({
          x: 100,
          y: 200,
          time: '2024-01-01',
          value: 50.5,
        });
      });
    });

    it('should sync time range between multiple charts', async () => {
      const onTimeRangeChange1 = jest.fn();
      const onTimeRangeChange2 = jest.fn();

      render(
        <ChartSyncProvider defaultEnabled={true}>
          <TestChartComponent chartId="chart-1" onTimeRangeChange={onTimeRangeChange1} />
          <TestChartComponent chartId="chart-2" onTimeRangeChange={onTimeRangeChange2} />
        </ChartSyncProvider>
      );

      // Change time range on chart-1
      fireEvent.click(screen.getByTestId('change-time-range-chart-1'));

      // Chart-2 should receive the time range update via callback
      await waitFor(() => {
        expect(onTimeRangeChange2).toHaveBeenCalledWith({
          from: '2024-01-01',
          to: '2024-12-31',
        });
      });
    });

    it('should not sync when sync is disabled', async () => {
      const onCrosshairMove2 = jest.fn();

      render(
        <ChartSyncProvider defaultEnabled={false}>
          <TestChartComponent chartId="chart-1" />
          <TestChartComponent chartId="chart-2" onCrosshairMove={onCrosshairMove2} />
        </ChartSyncProvider>
      );

      // Move crosshair on chart-1
      fireEvent.click(screen.getByTestId('move-crosshair-chart-1'));

      // Chart-2 should NOT receive the update
      expect(onCrosshairMove2).not.toHaveBeenCalled();
    });
  });

  describe('Chart registration', () => {
    it('should register chart on mount', () => {
      // Since registerChart is internal, we test via behavior
      // The hook should work without errors
      const { unmount } = render(
        <ChartSyncProvider defaultEnabled={true}>
          <TestChartComponent chartId="chart-1" />
        </ChartSyncProvider>
      );

      // Should not throw on unmount either
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('isActiveChart behavior', () => {
    it('should correctly identify active chart', async () => {
      render(
        <ChartSyncProvider defaultEnabled={true}>
          <TestChartComponent chartId="chart-1" />
          <TestChartComponent chartId="chart-2" />
        </ChartSyncProvider>
      );

      // Initially neither is active
      expect(screen.getByTestId('active-chart-chart-1')).toHaveTextContent('false');
      expect(screen.getByTestId('active-chart-chart-2')).toHaveTextContent('false');

      // Move crosshair on chart-1
      fireEvent.click(screen.getByTestId('move-crosshair-chart-1'));

      // chart-1 should be active, chart-2 should not
      expect(screen.getByTestId('active-chart-chart-1')).toHaveTextContent('true');
      expect(screen.getByTestId('active-chart-chart-2')).toHaveTextContent('false');

      // Move crosshair on chart-2
      fireEvent.click(screen.getByTestId('move-crosshair-chart-2'));

      // chart-2 should be active now
      await waitFor(() => {
        expect(screen.getByTestId('active-chart-chart-1')).toHaveTextContent('false');
        expect(screen.getByTestId('active-chart-chart-2')).toHaveTextContent('true');
      });
    });
  });

  describe('Crosshair position state', () => {
    it('should provide crosshair position from context', () => {
      render(
        <ChartSyncProvider defaultEnabled={true}>
          <TestChartComponent chartId="chart-1" />
        </ChartSyncProvider>
      );

      // Move crosshair
      fireEvent.click(screen.getByTestId('move-crosshair-chart-1'));

      // Crosshair position should be reflected in hook return value
      expect(screen.getByTestId('crosshair-x-chart-1')).toHaveTextContent('100');
      expect(screen.getByTestId('crosshair-y-chart-1')).toHaveTextContent('200');
      expect(screen.getByTestId('crosshair-time-chart-1')).toHaveTextContent('2024-01-01');
    });
  });

  describe('Time range state', () => {
    it('should provide time range from context', () => {
      render(
        <ChartSyncProvider defaultEnabled={true}>
          <TestChartComponent chartId="chart-1" />
        </ChartSyncProvider>
      );

      // Change time range
      fireEvent.click(screen.getByTestId('change-time-range-chart-1'));

      // Time range should be reflected in hook return value
      expect(screen.getByTestId('time-range-chart-1')).toHaveTextContent(
        '2024-01-01-2024-12-31'
      );
    });
  });
});
