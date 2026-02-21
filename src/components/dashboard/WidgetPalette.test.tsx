import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WidgetPalette } from './WidgetPalette';
import { WIDGET_DEFINITIONS, type WidgetType } from '@/lib/stores/dashboardStore';

describe('WidgetPalette', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onAddWidget: jest.fn(),
    existingWidgets: [] as WidgetType[],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render nothing when isOpen is false', () => {
      render(<WidgetPalette {...defaultProps} isOpen={false} />);

      expect(screen.queryByText('Thêm Widget')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(<WidgetPalette {...defaultProps} />);

      expect(screen.getByText('Thêm Widget')).toBeInTheDocument();
    });

    it('should render all widget definitions', () => {
      render(<WidgetPalette {...defaultProps} />);

      WIDGET_DEFINITIONS.forEach((definition) => {
        expect(screen.getByText(definition.title)).toBeInTheDocument();
        expect(screen.getByText(definition.description)).toBeInTheDocument();
      });
    });

    it('should render description text', () => {
      render(<WidgetPalette {...defaultProps} />);

      expect(
        screen.getByText('Chọn widget để thêm vào dashboard của bạn')
      ).toBeInTheDocument();
    });
  });

  describe('close button', () => {
    it('should render close button', () => {
      render(<WidgetPalette {...defaultProps} />);

      expect(screen.getByLabelText('Đóng')).toBeInTheDocument();
    });

    it('should call onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = jest.fn();
      render(<WidgetPalette {...defaultProps} onClose={onClose} />);

      const closeButton = screen.getByLabelText('Đóng');
      await user.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when backdrop is clicked', async () => {
      const user = userEvent.setup();
      const onClose = jest.fn();
      render(<WidgetPalette {...defaultProps} onClose={onClose} />);

      // The backdrop has a class that makes it cover the screen
      const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/50');
      expect(backdrop).toBeInTheDocument();

      if (backdrop) {
        await user.click(backdrop);
      }

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('widget buttons', () => {
    it('should call onAddWidget when a widget is clicked', async () => {
      const user = userEvent.setup();
      const onAddWidget = jest.fn();
      render(<WidgetPalette {...defaultProps} onAddWidget={onAddWidget} />);

      const portfolioButton = screen.getByText('Giá trị danh mục').closest('button');
      expect(portfolioButton).toBeInTheDocument();

      if (portfolioButton) {
        await user.click(portfolioButton);
      }

      expect(onAddWidget).toHaveBeenCalledWith('portfolio-value');
    });

    it('should not call onAddWidget for already added widgets', async () => {
      const user = userEvent.setup();
      const onAddWidget = jest.fn();
      render(
        <WidgetPalette
          {...defaultProps}
          onAddWidget={onAddWidget}
          existingWidgets={['portfolio-value']}
        />
      );

      const portfolioButton = screen.getByText('Giá trị danh mục').closest('button');
      expect(portfolioButton).toBeDisabled();

      if (portfolioButton) {
        await user.click(portfolioButton);
      }

      expect(onAddWidget).not.toHaveBeenCalled();
    });
  });

  describe('existing widgets indication', () => {
    it('should show "Đã thêm" for existing widgets', () => {
      render(
        <WidgetPalette
          {...defaultProps}
          existingWidgets={['portfolio-value', 'watchlist']}
        />
      );

      // Should show "Đã thêm" for portfolio-value
      const portfolioSection = screen.getByText('Giá trị danh mục').parentElement;
      expect(portfolioSection).toHaveTextContent('Đã thêm');

      // Should show "Đã thêm" for watchlist
      const watchlistSection = screen.getByText('Danh sách theo dõi').parentElement;
      expect(watchlistSection).toHaveTextContent('Đã thêm');
    });

    it('should not show "Đã thêm" for widgets not in existingWidgets', () => {
      render(
        <WidgetPalette
          {...defaultProps}
          existingWidgets={['portfolio-value']}
        />
      );

      // Should not show "Đã thêm" for watchlist
      const watchlistCard = screen.getByText('Danh sách theo dõi').closest('button');
      expect(watchlistCard).not.toHaveTextContent('Đã thêm');
    });

    it('should disable buttons for existing widgets', () => {
      render(
        <WidgetPalette
          {...defaultProps}
          existingWidgets={['portfolio-value']}
        />
      );

      const portfolioButton = screen.getByText('Giá trị danh mục').closest('button');
      expect(portfolioButton).toBeDisabled();
    });
  });

  describe('accessibility', () => {
    it('should have accessible close button label', () => {
      render(<WidgetPalette {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Đóng' })).toBeInTheDocument();
    });

    it('should have buttons for each widget type', () => {
      render(<WidgetPalette {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      // One for close + one for each widget definition
      expect(buttons.length).toBe(WIDGET_DEFINITIONS.length + 1);
    });
  });

  describe('all widget types', () => {
    it('should render all expected widget types', () => {
      render(<WidgetPalette {...defaultProps} />);

      const expectedTypes = [
        'Giá trị danh mục',
        'Danh sách theo dõi',
        'Biểu đồ hiệu suất',
        'Cổ phiếu biến động',
        'Tổng quan thị trường',
        'Tin tức',
      ];

      expectedTypes.forEach((title) => {
        expect(screen.getByText(title)).toBeInTheDocument();
      });
    });

    it('should call onAddWidget with correct type for each widget', async () => {
      const user = userEvent.setup();
      const onAddWidget = jest.fn();
      render(<WidgetPalette {...defaultProps} onAddWidget={onAddWidget} />);

      const widgetTypes: WidgetType[] = [
        'portfolio-value',
        'watchlist',
        'performance-chart',
        'top-movers',
        'market-overview',
        'news',
      ];

      for (const type of widgetTypes) {
        const definition = WIDGET_DEFINITIONS.find((d) => d.type === type);
        const button = screen.getByText(definition!.title).closest('button');
        if (button) {
          await user.click(button);
        }
      }

      expect(onAddWidget).toHaveBeenCalledTimes(6);
      widgetTypes.forEach((type) => {
        expect(onAddWidget).toHaveBeenCalledWith(type);
      });
    });
  });
});
