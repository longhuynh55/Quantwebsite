import { useState, useCallback, useRef, useEffect } from "react";
import { showSuccess, showError } from "@/components/ui/toast";
import { formatPercent } from "@/lib/utils";
import { BacktestResult, EquityPointApi, StrategyConfig } from "../types";
import { PARAM_LABELS } from "../constants";

interface UseBacktestOptions {
  symbol: string;
  strategy: string;
  capital: string;
  strategyParams: Record<string, string>;
  config: StrategyConfig;
}

interface UseBacktestReturn {
  loading: boolean;
  result: BacktestResult | null;
  error: string;
  statusMessage: string;
  runBacktest: () => Promise<void>;
  clearResult: () => void;
}

export function useBacktest({
  symbol,
  strategy,
  capital,
  strategyParams,
  config,
}: UseBacktestOptions): UseBacktestReturn {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const abortControllerRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);

  const clearResult = useCallback(() => {
    setResult(null);
    setError("");
  }, []);

  const runBacktest = useCallback(async () => {
    const trimmedSymbol = symbol.trim().toUpperCase();
    if (!trimmedSymbol) {
      const msg = "Please enter a symbol";
      setError(msg);
      setStatusMessage("Backtest validation failed: missing symbol.");
      showError("Validation error", msg);
      return;
    }

    const capitalNum = Number(capital);
    if (!Number.isFinite(capitalNum) || capitalNum <= 0) {
      const msg = "Please enter a valid capital amount";
      setError(msg);
      setStatusMessage("Backtest validation failed: invalid capital.");
      showError("Validation error", msg);
      return;
    }

    const payload: Record<string, unknown> = {
      symbol: trimmedSymbol,
      strategy,
      capital: capitalNum,
    };

    const parsedParams: Record<string, number> = {};
    for (const [key, value] of Object.entries(strategyParams)) {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        const msg = `Invalid value for ${PARAM_LABELS[key] ?? key}`;
        setError(msg);
        setStatusMessage(`Backtest validation failed: invalid ${PARAM_LABELS[key] ?? key}.`);
        showError("Validation error", msg);
        return;
      }
      parsedParams[key] = parsed;
    }

    const fee = Number(config.feeBps);
    const tax = Number(config.sellTaxBps);
    const slippage = Number(config.slippageBps);
    const lots = Number(config.lotSize);
    if (
      !Number.isFinite(fee) ||
      !Number.isFinite(tax) ||
      !Number.isFinite(slippage) ||
      !Number.isFinite(lots)
    ) {
      const msg = "Advanced configuration contains invalid numeric values";
      setError(msg);
      setStatusMessage("Backtest validation failed: invalid advanced configuration.");
      showError("Validation error", msg);
      return;
    }

    payload.params = parsedParams;
    payload.executionModel = config.executionModel;
    payload.feeBps = fee;
    payload.sellTaxBps = tax;
    payload.slippageBps = slippage;
    payload.lotSize = lots;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const requestId = requestSeqRef.current + 1;
    requestSeqRef.current = requestId;

    setLoading(true);
    setError("");
    setResult(null);
    setStatusMessage(`Running ${strategy} backtest for ${trimmedSymbol}...`);

    try {
      const response = await fetch("/api/backtesting", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || `HTTP error! status: ${response.status}`);
      }

      const equityCurve = (data.equityCurve || []).map((point: EquityPointApi) => ({
        date: new Date(point.date),
        equity: point.equity,
      }));

      if (requestId !== requestSeqRef.current) {
        return;
      }
      setResult({
        ...data,
        symbol: trimmedSymbol,
        equityCurve,
      });

      const netReturn = data?.metrics?.netReturn ?? data?.metrics?.totalReturn ?? 0;
      setStatusMessage(`Backtest completed for ${trimmedSymbol}.`);
      showSuccess(
        "Backtest complete",
        `${strategy} strategy on ${trimmedSymbol} returned ${formatPercent(netReturn)}`
      );
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      if (requestId !== requestSeqRef.current) {
        return;
      }
      const errorMessage = err instanceof Error ? err.message : "Failed to run backtest";
      setError(errorMessage);
      setStatusMessage(`Backtest failed for ${trimmedSymbol}.`);
      showError("Backtest failed", errorMessage);
      console.error("Backtest error:", err);
    } finally {
      if (requestId === requestSeqRef.current) {
        setLoading(false);
      }
    }
  }, [symbol, strategy, capital, strategyParams, config]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    loading,
    result,
    error,
    statusMessage,
    runBacktest,
    clearResult,
  };
}
