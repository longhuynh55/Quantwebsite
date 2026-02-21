import { Button } from "@/components/ui";
import { Play } from "lucide-react";

interface BacktestControlsProps {
  onRun: () => void;
  loading: boolean;
  onReset: () => void;
}

export function BacktestControls({ onRun, loading, onReset }: BacktestControlsProps) {
  return (
    <>
      <div className="flex items-end pb-1">
        <Button
          onClick={onRun}
          disabled={loading}
          className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-lg shadow-blue-500/20 font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          {loading ? (
            <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2" />
          ) : (
            <Play className="w-5 h-5 mr-2 fill-current" />
          )}
          Execute Engine
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl border-gray-200 dark:border-slate-800"
          onClick={onReset}
        >
          Reset All
        </Button>
      </div>
    </>
  );
}
