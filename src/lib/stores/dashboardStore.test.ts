import { act } from '@testing-library/react';
import {
  useDashboardStore,
  WIDGET_DEFINITIONS,
  type WidgetType,
  type DashboardLayouts,
} from './dashboardStore';

// Reset store before each test
beforeEach(() => {
  // Reset to default state by calling resetToDefault
  act(() => {
    useDashboardStore.getState().resetToDefault();
  });
});

describe('dashboardStore', () => {
  describe('initial state', () => {
    it('should have correct initial layouts', () => {
      const { layouts } = useDashboardStore.getState();

      expect(layouts).toBeDefined();
      expect(layouts.lg).toBeDefined();
      expect(layouts.md).toBeDefined();
      expect(layouts.sm).toBeDefined();
      expect(layouts.xs).toBeDefined();
      expect(layouts.xxs).toBeDefined();
    });

    it('should have correct initial widgets', () => {
      const { widgets } = useDashboardStore.getState();

      expect(widgets).toBeDefined();
      expect(widgets.length).toBe(6);
      expect(widgets[0]).toHaveProperty('id');
      expect(widgets[0]).toHaveProperty('type');
      expect(widgets[0]).toHaveProperty('title');
    });

    it('should have palette closed initially', () => {
      const { isPaletteOpen } = useDashboardStore.getState();
      expect(isPaletteOpen).toBe(false);
    });
  });

  describe('addWidget', () => {
    it('should add a new widget to the store', () => {
      const initialWidgets = useDashboardStore.getState().widgets;
      const initialCount = initialWidgets.length;

      act(() => {
        useDashboardStore.getState().addWidget('portfolio-value');
      });

      const newWidgets = useDashboardStore.getState().widgets;
      expect(newWidgets.length).toBe(initialCount + 1);

      const addedWidget = newWidgets[newWidgets.length - 1];
      expect(addedWidget.type).toBe('portfolio-value');
      expect(addedWidget.title).toBe('Giá trị danh mục');
    });

    it('should add layout for new widget in lg breakpoint', () => {
      const initialLayouts = useDashboardStore.getState().layouts;
      const initialLgCount = initialLayouts.lg.length;

      act(() => {
        useDashboardStore.getState().addWidget('watchlist');
      });

      const newLayouts = useDashboardStore.getState().layouts;
      expect(newLayouts.lg.length).toBe(initialLgCount + 1);
    });

    it('should close palette after adding widget', () => {
      act(() => {
        useDashboardStore.setState({ isPaletteOpen: true });
      });

      expect(useDashboardStore.getState().isPaletteOpen).toBe(true);

      act(() => {
        useDashboardStore.getState().addWidget('news');
      });

      expect(useDashboardStore.getState().isPaletteOpen).toBe(false);
    });

    it('should not add widget for unknown type', () => {
      const initialWidgets = useDashboardStore.getState().widgets;

      act(() => {
        useDashboardStore.getState().addWidget('unknown-type' as WidgetType);
      });

      expect(useDashboardStore.getState().widgets.length).toBe(initialWidgets.length);
    });

    it('should use default dimensions from widget definition', () => {
      act(() => {
        useDashboardStore.getState().addWidget('performance-chart');
      });

      const layouts = useDashboardStore.getState().layouts;
      const addedLayout = layouts.lg[layouts.lg.length - 1];
      const definition = WIDGET_DEFINITIONS.find(d => d.type === 'performance-chart');

      expect(addedLayout.w).toBe(definition?.defaultW);
      expect(addedLayout.h).toBe(definition?.defaultH);
    });
  });

  describe('removeWidget', () => {
    it('should remove a widget from the store', () => {
      const initialWidgets = useDashboardStore.getState().widgets;
      const widgetToRemove = initialWidgets[0];

      act(() => {
        useDashboardStore.getState().removeWidget(widgetToRemove.id);
      });

      const newWidgets = useDashboardStore.getState().widgets;
      expect(newWidgets.find(w => w.id === widgetToRemove.id)).toBeUndefined();
      expect(newWidgets.length).toBe(initialWidgets.length - 1);
    });

    it('should remove layout from all breakpoints', () => {
      const initialLayouts = useDashboardStore.getState().layouts;
      const layoutId = initialLayouts.lg[0].i;

      act(() => {
        useDashboardStore.getState().removeWidget(layoutId);
      });

      const newLayouts = useDashboardStore.getState().layouts;
      expect(newLayouts.lg.find(l => l.i === layoutId)).toBeUndefined();
      expect(newLayouts.md.find(l => l.i === layoutId)).toBeUndefined();
      expect(newLayouts.sm.find(l => l.i === layoutId)).toBeUndefined();
      expect(newLayouts.xs.find(l => l.i === layoutId)).toBeUndefined();
      expect(newLayouts.xxs.find(l => l.i === layoutId)).toBeUndefined();
    });
  });

  describe('updateLayout', () => {
    it('should update layouts', () => {
      const newLayouts: DashboardLayouts = {
        lg: [{ i: 'test-widget', x: 0, y: 0, w: 4, h: 2 }],
        md: [{ i: 'test-widget', x: 0, y: 0, w: 4, h: 2 }],
        sm: [{ i: 'test-widget', x: 0, y: 0, w: 2, h: 2 }],
        xs: [{ i: 'test-widget', x: 0, y: 0, w: 2, h: 2 }],
        xxs: [{ i: 'test-widget', x: 0, y: 0, w: 1, h: 2 }],
      };

      act(() => {
        useDashboardStore.getState().updateLayout(newLayouts);
      });

      const state = useDashboardStore.getState();
      expect(state.layouts.lg.length).toBe(1);
      expect(state.layouts.lg[0].i).toBe('test-widget');
    });
  });

  describe('updateWidgetConfig', () => {
    it('should update widget config', () => {
      const { widgets } = useDashboardStore.getState();
      const widgetId = widgets[0].id;

      act(() => {
        useDashboardStore.getState().updateWidgetConfig(widgetId, { stocks: ['VNM', 'FPT'] });
      });

      const updatedWidget = useDashboardStore.getState().widgets.find(w => w.id === widgetId);
      expect(updatedWidget?.config).toEqual({ stocks: ['VNM', 'FPT'] });
    });

    it('should merge config with existing config', () => {
      const { widgets } = useDashboardStore.getState();
      const widgetId = widgets[0].id;

      act(() => {
        useDashboardStore.getState().updateWidgetConfig(widgetId, { stocks: ['VNM'] });
      });

      act(() => {
        useDashboardStore.getState().updateWidgetConfig(widgetId, { period: '1M' });
      });

      const updatedWidget = useDashboardStore.getState().widgets.find(w => w.id === widgetId);
      expect(updatedWidget?.config).toEqual({ stocks: ['VNM'], period: '1M' });
    });
  });

  describe('togglePalette', () => {
    it('should toggle palette open/close', () => {
      expect(useDashboardStore.getState().isPaletteOpen).toBe(false);

      act(() => {
        useDashboardStore.getState().togglePalette();
      });

      expect(useDashboardStore.getState().isPaletteOpen).toBe(true);

      act(() => {
        useDashboardStore.getState().togglePalette();
      });

      expect(useDashboardStore.getState().isPaletteOpen).toBe(false);
    });
  });

  describe('resetToDefault', () => {
    it('should reset to default state', () => {
      // Modify state first
      act(() => {
        useDashboardStore.getState().addWidget('news');
        useDashboardStore.getState().togglePalette();
      });

      // Reset
      act(() => {
        useDashboardStore.getState().resetToDefault();
      });

      const state = useDashboardStore.getState();
      expect(state.widgets.length).toBe(6); // Default count
      expect(state.layouts.lg.length).toBe(6); // Default count
    });
  });

  describe('WIDGET_DEFINITIONS', () => {
    it('should have 6 widget definitions', () => {
      expect(WIDGET_DEFINITIONS.length).toBe(6);
    });

    it('should have required properties for each definition', () => {
      WIDGET_DEFINITIONS.forEach(def => {
        expect(def).toHaveProperty('type');
        expect(def).toHaveProperty('title');
        expect(def).toHaveProperty('description');
        expect(def).toHaveProperty('defaultW');
        expect(def).toHaveProperty('defaultH');
        expect(def).toHaveProperty('icon');
      });
    });
  });
});
