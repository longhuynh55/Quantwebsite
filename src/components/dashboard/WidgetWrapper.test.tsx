import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WidgetWrapper } from './WidgetWrapper';

describe('WidgetWrapper', () => {
  const defaultProps = {
    id: 'test-widget',
    title: 'Test Widget',
    children: <div data-testid="child-content">Widget Content</div>,
  };

  it('should render with title', () => {
    render(<WidgetWrapper {...defaultProps} />);

    expect(screen.getByText('Test Widget')).toBeInTheDocument();
  });

  it('should render children', () => {
    render(<WidgetWrapper {...defaultProps} />);

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.getByText('Widget Content')).toBeInTheDocument();
  });

  it('should have data-widget-id attribute', () => {
    render(<WidgetWrapper {...defaultProps} />);

    const wrapper = screen.getByTestId('child-content').parentElement?.parentElement;
    expect(wrapper).toHaveAttribute('data-widget-id', 'test-widget');
  });

  describe('remove button', () => {
    it('should not show remove button when onRemove is not provided', () => {
      render(<WidgetWrapper {...defaultProps} />);

      expect(screen.queryByLabelText('Xóa widget')).not.toBeInTheDocument();
    });

    it('should show remove button when onRemove is provided', async () => {
      const onRemove = jest.fn();
      render(<WidgetWrapper {...defaultProps} onRemove={onRemove} />);

      // Hover to show buttons
      const wrapper = screen.getByTestId('child-content').parentElement?.parentElement;
      if (wrapper) {
        fireEvent.mouseEnter(wrapper);
      }

      expect(screen.getByLabelText('Xóa widget')).toBeInTheDocument();
    });

    it('should have aria-label for remove button', async () => {
      const onRemove = jest.fn();
      render(<WidgetWrapper {...defaultProps} onRemove={onRemove} />);

      // Hover to show buttons
      const wrapper = screen.getByTestId('child-content').parentElement?.parentElement;
      if (wrapper) {
        fireEvent.mouseEnter(wrapper);
      }

      const removeButton = screen.getByLabelText('Xóa widget');
      expect(removeButton).toBeInTheDocument();
    });

    it('should call onRemove when remove button is clicked', async () => {
      const user = userEvent.setup();
      const onRemove = jest.fn();
      render(<WidgetWrapper {...defaultProps} onRemove={onRemove} />);

      // Hover to show buttons
      const wrapper = screen.getByTestId('child-content').parentElement?.parentElement;
      if (wrapper) {
        fireEvent.mouseEnter(wrapper);
      }

      const removeButton = screen.getByLabelText('Xóa widget');
      await user.click(removeButton);

      expect(onRemove).toHaveBeenCalledTimes(1);
    });
  });

  describe('settings button', () => {
    it('should not show settings button when onSettings is not provided', () => {
      render(<WidgetWrapper {...defaultProps} />);

      expect(screen.queryByLabelText('Cài đặt')).not.toBeInTheDocument();
    });

    it('should show settings button when onSettings is provided', async () => {
      const onSettings = jest.fn();
      render(<WidgetWrapper {...defaultProps} onSettings={onSettings} />);

      // Hover to show buttons
      const wrapper = screen.getByTestId('child-content').parentElement?.parentElement;
      if (wrapper) {
        fireEvent.mouseEnter(wrapper);
      }

      expect(screen.getByLabelText('Cài đặt')).toBeInTheDocument();
    });

    it('should call onSettings when settings button is clicked', async () => {
      const user = userEvent.setup();
      const onSettings = jest.fn();
      render(<WidgetWrapper {...defaultProps} onSettings={onSettings} />);

      // Hover to show buttons
      const wrapper = screen.getByTestId('child-content').parentElement?.parentElement;
      if (wrapper) {
        fireEvent.mouseEnter(wrapper);
      }

      const settingsButton = screen.getByLabelText('Cài đặt');
      await user.click(settingsButton);

      expect(onSettings).toHaveBeenCalledTimes(1);
    });
  });

  describe('hover behavior', () => {
    it('should show action buttons on hover', async () => {
      const onRemove = jest.fn();
      const onSettings = jest.fn();
      render(
        <WidgetWrapper
          {...defaultProps}
          onRemove={onRemove}
          onSettings={onSettings}
        />
      );

      const wrapper = screen.getByTestId('child-content').parentElement?.parentElement;
      const actions = screen.getByLabelText('Xóa widget').parentElement;

      // Initially, actions container should use hidden opacity class
      expect(actions).toHaveClass('opacity-0');

      // On hover, actions container should become visible
      if (wrapper) {
        fireEvent.mouseEnter(wrapper);
      }

      expect(actions).toHaveClass('opacity-100');
      expect(screen.getByLabelText('Xóa widget')).toBeInTheDocument();
      expect(screen.getByLabelText('Cài đặt')).toBeInTheDocument();
    });

    it('should hide action buttons when not hovered', async () => {
      const onRemove = jest.fn();
      const onSettings = jest.fn();
      render(
        <WidgetWrapper
          {...defaultProps}
          onRemove={onRemove}
          onSettings={onSettings}
        />
      );

      const wrapper = screen.getByTestId('child-content').parentElement?.parentElement;
      const actions = screen.getByLabelText('Xóa widget').parentElement;

      if (wrapper) {
        // Hover
        fireEvent.mouseEnter(wrapper);
        expect(actions).toHaveClass('opacity-100');

        // Leave
        fireEvent.mouseLeave(wrapper);
        expect(actions).toHaveClass('opacity-0');
      }
    });
  });

  describe('className prop', () => {
    it('should apply custom className', () => {
      render(<WidgetWrapper {...defaultProps} className="custom-class" />);

      const wrapper = screen.getByTestId('child-content').parentElement?.parentElement;
      expect(wrapper).toHaveClass('custom-class');
    });
  });

  describe('accessibility', () => {
    it('should have accessible remove button label', async () => {
      const onRemove = jest.fn();
      render(<WidgetWrapper {...defaultProps} onRemove={onRemove} />);

      const wrapper = screen.getByTestId('child-content').parentElement?.parentElement;
      if (wrapper) {
        fireEvent.mouseEnter(wrapper);
      }

      const removeButton = screen.getByRole('button', { name: 'Xóa widget' });
      expect(removeButton).toBeInTheDocument();
    });

    it('should have accessible settings button label', async () => {
      const onSettings = jest.fn();
      render(<WidgetWrapper {...defaultProps} onSettings={onSettings} />);

      const wrapper = screen.getByTestId('child-content').parentElement?.parentElement;
      if (wrapper) {
        fireEvent.mouseEnter(wrapper);
      }

      const settingsButton = screen.getByRole('button', { name: 'Cài đặt' });
      expect(settingsButton).toBeInTheDocument();
    });
  });
});
