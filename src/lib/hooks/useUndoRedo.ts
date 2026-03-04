"use client";

import { useCallback, useRef, useState } from "react";
import { useStrategyBuilderStore } from "@/lib/stores/strategyBuilderStore";
import type { StrategyNode, StrategyEdge } from "@/lib/stores/strategyBuilderStore";

interface Snapshot {
  nodes: StrategyNode[];
  edges: StrategyEdge[];
}

const MAX_HISTORY = 50;

function cloneValue<T>(value: T): T {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Undo/Redo hook for the Strategy Builder.
 *
 * Captures snapshots of nodes+edges into an in-memory stack.
 * Call `captureSnapshot()` BEFORE making a mutation so the previous
 * state is stored.  Then use `undo()` / `redo()` to navigate.
 */
export function useUndoRedo() {
  const pastRef = useRef<Snapshot[]>([]);
  const futureRef = useRef<Snapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const { currentStrategy, setNodes, setEdges } = useStrategyBuilderStore();

  const getCurrentSnapshot = useCallback((): Snapshot | null => {
    if (!currentStrategy) return null;
    return {
      nodes: cloneValue(currentStrategy.nodes),
      edges: cloneValue(currentStrategy.edges),
    };
  }, [currentStrategy]);

  const syncHistoryAvailability = useCallback(() => {
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(futureRef.current.length > 0);
  }, []);

  const clearHistory = useCallback(() => {
    pastRef.current = [];
    futureRef.current = [];
    syncHistoryAvailability();
  }, [syncHistoryAvailability]);

  /** Call this BEFORE every user-initiated mutation. */
  const captureSnapshot = useCallback(() => {
    const snap = getCurrentSnapshot();
    if (!snap) return;

    pastRef.current = [...pastRef.current.slice(-MAX_HISTORY + 1), snap];
    // Clear the redo stack whenever a new action is performed
    futureRef.current = [];
    syncHistoryAvailability();
  }, [getCurrentSnapshot, syncHistoryAvailability]);

  /** Undo: restore previous snapshot, push current to future. */
  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return;

    const current = getCurrentSnapshot();
    const prev = pastRef.current.pop()!;

    if (current) {
      futureRef.current = [...futureRef.current, current];
    }

    setNodes(prev.nodes);
    setEdges(prev.edges);
    syncHistoryAvailability();
  }, [getCurrentSnapshot, setNodes, setEdges, syncHistoryAvailability]);

  /** Redo: restore next snapshot, push current to past. */
  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;

    const current = getCurrentSnapshot();
    const next = futureRef.current.pop()!;

    if (current) {
      pastRef.current = [...pastRef.current, current];
    }

    setNodes(next.nodes);
    setEdges(next.edges);
    syncHistoryAvailability();
  }, [getCurrentSnapshot, setNodes, setEdges, syncHistoryAvailability]);

  return {
    undo,
    redo,
    captureSnapshot,
    clearHistory,
    canUndo,
    canRedo,
  };
}
