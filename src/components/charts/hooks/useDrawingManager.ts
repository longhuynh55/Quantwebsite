"use client";

import { useState, useCallback, useEffect } from "react";
import { useLocalStorage } from "@/lib/hooks";

// Drawing types
export type DrawingTool =
  | "select"
  | "trendLine"
  | "horizontalLine"
  | "fibonacci"
  | "supportResistance"
  | "text";

export interface Point {
  x: number;
  y: number;
  time?: string; // For time-based charts
  value?: number; // For price-based charts
}

export interface BaseDrawing {
  id: string;
  type: DrawingTool;
  color: string;
  lineWidth: number;
  opacity: number;
  createdAt: number;
  updatedAt: number;
}

export interface TrendLineDrawing extends BaseDrawing {
  type: "trendLine";
  startPoint: Point;
  endPoint: Point;
  extendLeft: boolean;
  extendRight: boolean;
}

export interface HorizontalLineDrawing extends BaseDrawing {
  type: "horizontalLine";
  price: number;
  label?: string;
  lineStyle: "solid" | "dashed" | "dotted";
}

export interface FibonacciDrawing extends BaseDrawing {
  type: "fibonacci";
  startPoint: Point;
  endPoint: Point;
  levels: number[]; // e.g., [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
  showLabels: boolean;
}

export interface SupportResistanceDrawing extends BaseDrawing {
  type: "supportResistance";
  startPoint: Point;
  endPoint: Point;
  zoneType: "support" | "resistance";
  fillColor: string;
}

export interface TextDrawing extends BaseDrawing {
  type: "text";
  point: Point;
  text: string;
  fontSize: number;
  fontWeight: "normal" | "bold";
}

export type Drawing =
  | TrendLineDrawing
  | HorizontalLineDrawing
  | FibonacciDrawing
  | SupportResistanceDrawing
  | TextDrawing;

export interface DrawingState {
  drawings: Drawing[];
  selectedDrawingId: string | null;
  activeTool: DrawingTool;
  isDrawing: boolean;
  currentDrawing: Partial<Drawing> | null;
  zoom: number;
  pan: { x: number; y: number };
}

export interface DrawingHistory {
  past: Drawing[][];
  future: Drawing[][];
}

const DEFAULT_FIBONACCI_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

const DEFAULT_COLORS = {
  trendLine: "#3b82f6",
  horizontalLine: "#ef4444",
  fibonacci: "#8b5cf6",
  supportResistance: "#10b981",
  text: "#f59e0b",
};

const generateId = () => `drawing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export function useDrawingManager(chartId: string = "default") {
  const storageKey = `chart_drawings_${chartId}`;

  // Persist drawings to localStorage
  const [savedDrawings, setSavedDrawings] = useLocalStorage<Drawing[]>(storageKey, []);

  const [state, setState] = useState<DrawingState>({
    drawings: savedDrawings,
    selectedDrawingId: null,
    activeTool: "select",
    isDrawing: false,
    currentDrawing: null,
    zoom: 1,
    pan: { x: 0, y: 0 },
  });

  // History for undo/redo
  const [history, setHistory] = useState<DrawingHistory>({
    past: [],
    future: [],
  });

  // Save drawings to localStorage when they change
  useEffect(() => {
    if (state.drawings.length > 0 || savedDrawings.length > 0) {
      setSavedDrawings(state.drawings);
    }
  }, [state.drawings, savedDrawings.length, setSavedDrawings]);

  // Set active tool
  const setActiveTool = useCallback((tool: DrawingTool) => {
    setState((prev) => ({
      ...prev,
      activeTool: tool,
      selectedDrawingId: tool === "select" ? prev.selectedDrawingId : null,
      isDrawing: false,
      currentDrawing: null,
    }));
  }, []);

  // Start drawing
  const startDrawing = useCallback(
    (point: Point) => {
      if (state.activeTool === "select") return;

      setState((prev) => {
        const baseDrawing = {
          id: generateId(),
          color: DEFAULT_COLORS[state.activeTool as keyof typeof DEFAULT_COLORS] || "#3b82f6",
          lineWidth: 2,
          opacity: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        let currentDrawing: Partial<Drawing>;

        switch (state.activeTool) {
          case "trendLine":
            currentDrawing = {
              ...baseDrawing,
              type: "trendLine",
              startPoint: point,
              endPoint: point,
              extendLeft: false,
              extendRight: false,
            };
            break;

          case "horizontalLine":
            currentDrawing = {
              ...baseDrawing,
              type: "horizontalLine",
              price: point.y,
              lineStyle: "solid",
            };
            break;

          case "fibonacci":
            currentDrawing = {
              ...baseDrawing,
              type: "fibonacci",
              startPoint: point,
              endPoint: point,
              levels: DEFAULT_FIBONACCI_LEVELS,
              showLabels: true,
            };
            break;

          case "supportResistance":
            currentDrawing = {
              ...baseDrawing,
              type: "supportResistance",
              startPoint: point,
              endPoint: point,
              zoneType: "support",
              fillColor: "rgba(16, 185, 129, 0.2)",
            };
            break;

          case "text":
            currentDrawing = {
              ...baseDrawing,
              type: "text",
              point,
              text: "Text",
              fontSize: 14,
              fontWeight: "normal",
            };
            break;

          default:
            return prev;
        }

        // Push current state to history
        setHistory((h) => ({
          past: [...h.past, prev.drawings],
          future: [],
        }));

        return {
          ...prev,
          isDrawing: true,
          currentDrawing,
        };
      });
    },
    [state.activeTool]
  );

  // Update drawing while dragging
  const updateDrawing = useCallback(
    (point: Point) => {
      if (!state.isDrawing || !state.currentDrawing) return;

      setState((prev) => {
        const current = prev.currentDrawing;
        if (!current) return prev;

        let updated: Partial<Drawing>;

        switch (current.type) {
          case "trendLine":
            updated = {
              ...current,
              endPoint: point,
            };
            break;

          case "fibonacci":
            updated = {
              ...current,
              endPoint: point,
            };
            break;

          case "supportResistance":
            updated = {
              ...current,
              endPoint: point,
            };
            break;

          default:
            return prev;
        }

        return {
          ...prev,
          currentDrawing: updated,
        };
      });
    },
    [state.isDrawing, state.currentDrawing]
  );

  // Complete drawing
  const completeDrawing = useCallback(() => {
    if (!state.isDrawing || !state.currentDrawing) return;

    setState((prev) => {
      if (!prev.currentDrawing || !prev.currentDrawing.type) return prev;

      const newDrawing = prev.currentDrawing as Drawing;

      return {
        ...prev,
        drawings: [...prev.drawings, newDrawing],
        isDrawing: false,
        currentDrawing: null,
        activeTool: "select",
      };
    });
  }, [state.isDrawing, state.currentDrawing]);

  // Cancel current drawing
  const cancelDrawing = useCallback(() => {
    // Restore from history
    setHistory((h) => {
      if (h.past.length === 0) return h;
      return {
        past: h.past.slice(0, -1),
        future: [state.drawings, ...h.future],
      };
    });

    setState((prev) => ({
      ...prev,
      isDrawing: false,
      currentDrawing: null,
    }));
  }, [state.drawings]);

  // Select drawing
  const selectDrawing = useCallback((drawingId: string | null) => {
    setState((prev) => ({
      ...prev,
      selectedDrawingId: drawingId,
    }));
  }, []);

  // Update drawing properties
  const updateDrawingProperties = useCallback(
    (drawingId: string, updates: Partial<Drawing>) => {
      setState((prev) => {
        // Push to history before modifying
        setHistory((h) => ({
          past: [...h.past, prev.drawings],
          future: [],
        }));

        return {
          ...prev,
          drawings: prev.drawings.map((d) =>
            d.id === drawingId
              ? ({ ...d, ...updates, updatedAt: Date.now() } as Drawing)
              : d
          ),
        };
      });
    },
    []
  );

  // Delete drawing
  const deleteDrawing = useCallback(
    (drawingId: string) => {
      setState((prev) => {
        // Push to history before deleting
        setHistory((h) => ({
          past: [...h.past, prev.drawings],
          future: [],
        }));

        return {
          ...prev,
          drawings: prev.drawings.filter((d) => d.id !== drawingId),
          selectedDrawingId:
            prev.selectedDrawingId === drawingId ? null : prev.selectedDrawingId,
        };
      });
    },
    []
  );

  // Delete selected drawing
  const deleteSelectedDrawing = useCallback(() => {
    if (!state.selectedDrawingId) return;
    deleteDrawing(state.selectedDrawingId);
  }, [state.selectedDrawingId, deleteDrawing]);

  // Undo
  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.past.length === 0) return h;

      const previous = h.past[h.past.length - 1];
      const newPast = h.past.slice(0, -1);

      setState((prev) => ({
        ...prev,
        drawings: previous,
        selectedDrawingId: null,
      }));

      return {
        past: newPast,
        future: [state.drawings, ...h.future],
      };
    });
  }, [state.drawings]);

  // Redo
  const redo = useCallback(() => {
    setHistory((h) => {
      if (h.future.length === 0) return h;

      const next = h.future[0];
      const newFuture = h.future.slice(1);

      setState((prev) => ({
        ...prev,
        drawings: next,
        selectedDrawingId: null,
      }));

      return {
        past: [...h.past, state.drawings],
        future: newFuture,
      };
    });
  }, [state.drawings]);

  // Clear all drawings
  const clearAllDrawings = useCallback(() => {
    setHistory((h) => ({
      past: [...h.past, state.drawings],
      future: [],
    }));

    setState((prev) => ({
      ...prev,
      drawings: [],
      selectedDrawingId: null,
    }));
  }, [state.drawings]);

  // Export drawings as JSON
  const exportDrawings = useCallback(() => {
    const data = JSON.stringify(state.drawings, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chart_drawings_${chartId}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state.drawings, chartId]);

  // Import drawings from JSON
  const importDrawings = useCallback(
    (jsonData: string) => {
      try {
        const drawings = JSON.parse(jsonData) as Drawing[];
        setHistory((h) => ({
          past: [...h.past, state.drawings],
          future: [],
        }));
        setState((prev) => ({
          ...prev,
          drawings,
          selectedDrawingId: null,
        }));
        return true;
      } catch (error) {
        console.error("Failed to import drawings:", error);
        return false;
      }
    },
    [state.drawings]
  );

  // Zoom controls
  const setZoom = useCallback((zoom: number) => {
    setState((prev) => ({
      ...prev,
      zoom: Math.max(0.5, Math.min(5, zoom)),
    }));
  }, []);

  const zoomIn = useCallback(() => {
    setState((prev) => ({
      ...prev,
      zoom: Math.min(5, prev.zoom * 1.2),
    }));
  }, []);

  const zoomOut = useCallback(() => {
    setState((prev) => ({
      ...prev,
      zoom: Math.max(0.5, prev.zoom / 1.2),
    }));
  }, []);

  const resetZoom = useCallback(() => {
    setState((prev) => ({
      ...prev,
      zoom: 1,
      pan: { x: 0, y: 0 },
    }));
  }, []);

  // Pan controls
  const setPan = useCallback((pan: { x: number; y: number }) => {
    setState((prev) => ({
      ...prev,
      pan,
    }));
  }, []);

  return {
    // State
    drawings: state.drawings,
    selectedDrawingId: state.selectedDrawingId,
    activeTool: state.activeTool,
    isDrawing: state.isDrawing,
    currentDrawing: state.currentDrawing,
    zoom: state.zoom,
    pan: state.pan,

    // Tool selection
    setActiveTool,

    // Drawing actions
    startDrawing,
    updateDrawing,
    completeDrawing,
    cancelDrawing,

    // Selection
    selectDrawing,

    // Modification
    updateDrawingProperties,
    deleteDrawing,
    deleteSelectedDrawing,

    // History
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,

    // Bulk actions
    clearAllDrawings,

    // Import/Export
    exportDrawings,
    importDrawings,

    // Zoom/Pan
    setZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    setPan,
  };
}

export default useDrawingManager;
