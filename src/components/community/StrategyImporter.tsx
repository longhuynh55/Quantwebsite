"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SharedStrategy } from "@/lib/community/strategy-service";
import { importStrategy } from "@/lib/community/strategy-service";
import { showSuccess, showError } from "@/components/ui/toast";
import { useStrategyBuilderStore } from "@/lib/stores/strategyBuilderStore";
import {
  Copy,
  CheckCircle2,
  Loader2,
  FileJson,
  AlertCircle,
  ArrowRight,
} from "lucide-react";

interface StrategyImporterProps {
  strategy: SharedStrategy | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess?: (strategy: SharedStrategy) => void;
}

type ImportStep = "confirm" | "importing" | "success" | "error";

export function StrategyImporter({
  strategy,
  open,
  onOpenChange,
  onImportSuccess,
}: StrategyImporterProps) {
  const [step, setStep] = React.useState<ImportStep>("confirm");
  const [customName, setCustomName] = React.useState("");
  const [errorMessage, setErrorMessage] = React.useState("");

  const { loadStrategy } = useStrategyBuilderStore();

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open && strategy) {
      setStep("confirm");
      setCustomName(`${strategy.name} (ban sao)`);
      setErrorMessage("");
    }
  }, [open, strategy]);

  const handleImport = async () => {
    if (!strategy) return;

    setStep("importing");
    setErrorMessage("");

    try {
      // Call the import API
      const importedStrategy = await importStrategy(strategy.id);

      // Load the strategy into the strategy builder store
      loadStrategy({
        id: importedStrategy.id,
        name: customName || importedStrategy.name,
        description: importedStrategy.description,
        nodes: importedStrategy.nodes,
        edges: importedStrategy.edges,
        createdAt: new Date(importedStrategy.createdAt),
        updatedAt: new Date(),
      });

      setStep("success");
      showSuccess("Sao chep thanh cong!", "Chien luoc da duoc them vao bo suu tap cua ban.");

      // Notify parent
      onImportSuccess?.(importedStrategy);
    } catch (error) {
      setStep("error");
      const message = error instanceof Error ? error.message : "Da xay ra loi khi sao chep chien luoc";
      setErrorMessage(message);
      showError("Loi sao chep", message);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  if (!strategy) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {step === "confirm" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Copy className="w-5 h-5 text-emerald-600" />
                Sao chep chien luoc
              </DialogTitle>
              <DialogDescription>
                Ban co muon sao chep chien luoc &quot;{strategy.name}&quot; vao bo suu tap cua minh?
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              {/* Strategy preview */}
              <div className="bg-stone-100 dark:bg-neutral-800/50 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-white dark:bg-neutral-700 rounded-lg">
                    <FileJson className="w-5 h-5 text-stone-600 dark:text-neutral-300" />
                  </div>
                  <div>
                    <p className="font-medium text-stone-900 dark:text-white">
                      {strategy.name}
                    </p>
                    <p className="text-sm text-stone-500 dark:text-neutral-400">
                      Boi {strategy.author}
                    </p>
                  </div>
                </div>

                {/* Quick stats */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-stone-500 dark:text-neutral-400">Nodes:</span>
                    <span className="font-medium">{strategy.nodes.length || 0}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-stone-500 dark:text-neutral-400">Connections:</span>
                    <span className="font-medium">{strategy.edges.length || 0}</span>
                  </div>
                </div>
              </div>

              {/* Custom name input */}
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-neutral-300 mb-2">
                  Ten chien luoc moi
                </label>
                <Input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Nhap ten chien luoc..."
                  className="w-full"
                />
              </div>

              {/* Import info */}
              <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-900/25 rounded-lg">
                <p className="text-sm text-emerald-700 dark:text-emerald-400">
                  Sau khi sao chep, ban co the chinh sua chien luoc nay trong trinh xay dung chien luoc.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Huy
              </Button>
              <Button onClick={handleImport}>
                Sao chep
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "importing" && (
          <>
            <DialogHeader>
              <DialogTitle>Dang sao chep...</DialogTitle>
            </DialogHeader>
            <div className="py-8 flex flex-col items-center justify-center">
              <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mb-4" />
              <p className="text-stone-500 dark:text-neutral-400">
                Dang sao chep chien luoc vao bo suu tap cua ban...
              </p>
            </div>
          </>
        )}

        {step === "success" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-5 h-5" />
                Sao chep thanh cong!
              </DialogTitle>
            </DialogHeader>
            <div className="py-8 flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <p className="text-stone-700 dark:text-neutral-300 text-center mb-2">
                Chien luoc <strong>&quot;{customName}&quot;</strong> da duoc sao chep thanh cong!
              </p>
              <p className="text-sm text-stone-500 dark:text-neutral-400 text-center">
                Ban co the tim thay no trong trinh xay dung chien luoc.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Dong
              </Button>
              <Button onClick={() => {
                handleClose();
                // Navigate to strategy builder
                window.location.href = "/strategy-builder";
              }}>
                Mo trinh xay dung
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "error" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertCircle className="w-5 h-5" />
                Loi sao chep
              </DialogTitle>
            </DialogHeader>
            <div className="py-8 flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <p className="text-stone-700 dark:text-neutral-300 text-center mb-2">
                Khong the sao chep chien luoc
              </p>
              <p className="text-sm text-stone-500 dark:text-neutral-400 text-center">
                {errorMessage || "Da xay ra loi. Vui long thu lai sau."}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Dong
              </Button>
              <Button onClick={handleImport}>
                Thu lai
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Compact copy button for card
interface CopyStrategyButtonProps {
  strategy: SharedStrategy;
  onCopyComplete?: (strategy: SharedStrategy) => void;
  className?: string;
  variant?: "default" | "compact";
}

export function CopyStrategyButton({
  strategy,
  onCopyComplete,
  className,
  variant = "default",
}: CopyStrategyButtonProps) {
  const [isImporting, setIsImporting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const { loadStrategy } = useStrategyBuilderStore();

  const handleCopy = async () => {
    setIsImporting(true);

    try {
      const importedStrategy = await importStrategy(strategy.id);

      // Load the strategy into the strategy builder store
      loadStrategy({
        id: importedStrategy.id,
        name: `${strategy.name} (ban sao)`,
        description: importedStrategy.description,
        nodes: importedStrategy.nodes,
        edges: importedStrategy.edges,
        createdAt: new Date(importedStrategy.createdAt),
        updatedAt: new Date(),
      });

      setIsSuccess(true);
      showSuccess("Sao chep thanh cong!", "Chien luoc da duoc them vao bo suu tap cua ban.");
      onCopyComplete?.(importedStrategy);

      // Reset success state after a delay
      setTimeout(() => {
        setIsSuccess(false);
      }, 2000);
    } catch {
      showError("Loi sao chep", "Khong the sao chep chien luoc. Vui long thu lai.");
    } finally {
      setIsImporting(false);
    }
  };

  if (variant === "compact") {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={handleCopy}
        disabled={isImporting}
        className={cn("h-8 w-8", className)}
        aria-label="Sao chep chien luoc"
      >
        {isImporting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isSuccess ? (
          <CheckCircle2 className="w-4 h-4 text-green-500" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </Button>
    );
  }

  return (
    <Button
      variant={isSuccess ? "secondary" : "default"}
      onClick={handleCopy}
      disabled={isImporting}
      className={className}
    >
      {isImporting ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Dang sao chep...
        </>
      ) : isSuccess ? (
        <>
          <CheckCircle2 className="w-4 h-4 mr-2" />
          Da sao chep!
        </>
      ) : (
        <>
          <Copy className="w-4 h-4 mr-2" />
          Sao chep
        </>
      )}
    </Button>
  );
}
