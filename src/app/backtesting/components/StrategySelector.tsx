import { Input, Select } from "@/components/ui";

interface StrategySelectorProps {
  symbol: string;
  onSymbolChange: (value: string) => void;
  strategy: string;
  onStrategyChange: (value: string) => void;
  capital: string;
  onCapitalChange: (value: string) => void;
}

export function StrategySelector({
  symbol,
  onSymbolChange,
  strategy,
  onStrategyChange,
  capital,
  onCapitalChange,
}: StrategySelectorProps) {
  return (
    <div className="grid grid-cols-1 gap-4 border border-stone-200 bg-stone-50/70 p-4 dark:border-neutral-800 dark:bg-neutral-900/60 md:grid-cols-3 lg:col-span-3">
      <div className="space-y-1.5">
        <label className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500 dark:text-neutral-500">
          Instrument
        </label>
        <div className="relative">
          <Input
            value={symbol}
            onChange={(e) => onSymbolChange(e.target.value.toUpperCase())}
            placeholder="TICKER"
            className="border-stone-200 bg-white text-xs font-semibold uppercase tracking-[0.08em] dark:border-neutral-700 dark:bg-neutral-950"
            maxLength={10}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500 dark:text-neutral-500">
          Algorithm
        </label>
        <Select
          value={strategy}
          onChange={(e) => onStrategyChange(e.target.value)}
          options={[
            { value: "sma_crossover", label: "SMA Crossover" },
            { value: "ema_crossover", label: "EMA Crossover" },
            { value: "rsi_mean_reversion", label: "RSI Mean Reversion" },
            { value: "bollinger_bands", label: "Bollinger Band Breakout" },
            { value: "momentum", label: "Momentum Strategy" },
          ]}
          className="border-stone-200 bg-white text-xs dark:border-neutral-700 dark:bg-neutral-950"
        />
      </div>
      <div className="space-y-1.5">
        <label className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500 dark:text-neutral-500">
          Initial Capital
        </label>
        <div className="relative">
          <Input
            type="number"
            value={capital}
            onChange={(e) => onCapitalChange(e.target.value)}
            placeholder="100,000"
            className="border-stone-200 bg-white text-xs font-mono dark:border-neutral-700 dark:bg-neutral-950"
            min="1"
          />
        </div>
      </div>
    </div>
  );
}
