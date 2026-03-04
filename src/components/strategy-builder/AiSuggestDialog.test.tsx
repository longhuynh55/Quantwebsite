import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AiSuggestDialog } from './AiSuggestDialog';

const mockTrackUiKpiEvent = jest.fn();
const mockToast = {
  success: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
};

jest.mock('@/lib/uiKpi', () => ({
  trackUiKpiEvent: (...args: unknown[]) => mockTrackUiKpiEvent(...args),
}));

jest.mock('@/components/ai-assistant', () => ({
  StrategyGenerator: ({ onApplyToBuilder }: { onApplyToBuilder: (strategy: unknown) => void }) => (
    <div>
      <div data-testid="mock-strategy-generator" />
      <button
        data-testid="mock-apply-generated"
        onClick={() =>
          onApplyToBuilder({
            name: 'AI Strategy',
            nodes: [
              {
                id: 'node-1',
                type: 'dataSource',
                position: { x: 80, y: 100 },
                data: {
                  type: 'dataSource',
                  label: 'Data Source',
                  config: {
                    label: 'Data Source',
                    stocks: ['VNM'],
                    timeframe: '1d',
                    startDate: '',
                    endDate: '',
                  },
                },
              },
            ],
            edges: [],
            explanation: 'Generated for testing',
          })
        }
      >
        Apply Mock Strategy
      </button>
    </div>
  ),
}));

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToast.success(...args),
    warning: (...args: unknown[]) => mockToast.warning(...args),
    error: (...args: unknown[]) => mockToast.error(...args),
  },
}));

describe('AiSuggestDialog tracking', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('tracks generate_apply_cancelled when apply callback returns false', async () => {
    const onApplyStrategy = jest.fn().mockReturnValue(false);

    render(<AiSuggestDialog onApplyStrategy={onApplyStrategy} />);

    fireEvent.click(screen.getByRole('button', { name: 'AI Suggest' }));
    fireEvent.click(screen.getByTestId('mock-apply-generated'));

    await waitFor(() => {
      expect(onApplyStrategy).toHaveBeenCalledTimes(1);
    });
    expect(mockTrackUiKpiEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        metric: 'strategy_builder_ai_assist',
        event: 'generate_apply_cancelled',
      })
    );
  });

  it('tracks generate_apply_success when apply callback returns true', async () => {
    const onApplyStrategy = jest.fn().mockReturnValue(true);

    render(<AiSuggestDialog onApplyStrategy={onApplyStrategy} />);

    fireEvent.click(screen.getByRole('button', { name: 'AI Suggest' }));
    fireEvent.click(screen.getByTestId('mock-apply-generated'));

    await waitFor(() => {
      expect(onApplyStrategy).toHaveBeenCalledTimes(1);
    });

    expect(mockTrackUiKpiEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        metric: 'strategy_builder_ai_assist',
        event: 'generate_apply_success',
      })
    );
  });

  it('tracks generate_apply_failed when apply callback throws', async () => {
    const onApplyStrategy = jest.fn().mockRejectedValue(new Error('apply failed'));

    render(<AiSuggestDialog onApplyStrategy={onApplyStrategy} />);

    fireEvent.click(screen.getByRole('button', { name: 'AI Suggest' }));
    fireEvent.click(screen.getByTestId('mock-apply-generated'));

    await waitFor(() => {
      expect(onApplyStrategy).toHaveBeenCalledTimes(1);
    });

    expect(mockToast.error).toHaveBeenCalled();
    expect(mockTrackUiKpiEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        metric: 'strategy_builder_ai_assist',
        event: 'generate_apply_failed',
      })
    );
  });
});
