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
    <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50/50 dark:bg-slate-900/50 p-4 rounded-2xl border border-gray-100 dark:border-slate-800">
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest px-1">
          Instrument
        </label>
        <div className="relative">
          <Input
            value={symbol}
            onChange={(e) => onSymbolChange(e.target.value.toUpperCase())}
            placeholder="TICKER"
            className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 rounded-xl font-bold uppercase"
            maxLength={10}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest px-1">
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
          className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 rounded-xl"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest px-1">
          Initial Capital
        </label>
        <div className="relative">
          <Input
            type="number"
            value={capital}
            onChange={(e) => onCapitalChange(e.target.value)}
            placeholder="100,000"
            className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 rounded-xl font-mono"
            min="1"
          />
        </div>
      </div>
    </div>
  );
}
