import { Button } from "@/components/ui";
import { Play } from "lucide-react";

interface BacktestControlsProps {
  onRun: () => void;
  loading: boolean;
  onReset: () => void;
}

export function BacktestControls({ onRun, loading, onReset }: BacktestControlsProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button
        onClick={onRun}
        disabled={loading}
        className="h-10 bg-emerald-700 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
      >
        {loading ? (
          <div className="mr-2 h-4 w-4 animate-spin border-2 border-white border-t-transparent" />
        ) : (
          <Play className="mr-2 h-4 w-4 fill-current" />
        )}
        Execute Engine
      </Button>
      <Button
        variant="outline"
        className="h-10 border-stone-300 bg-white px-4 text-xs font-semibold uppercase tracking-[0.12em] text-stone-700 hover:border-stone-400 hover:bg-stone-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
        onClick={onReset}
      >
        Reset
      </Button>
    </div>
  );
}
