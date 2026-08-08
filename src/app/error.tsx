"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to the structured logger
    console.error("[error-boundary]", error.message, error.digest);
  }, [error]);

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-background p-4">
      <div className="max-w-md space-y-4 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-rose-500/10">
          <AlertTriangle className="size-8 text-rose-500" />
        </div>
        <div>
          <h2 className="text-[20px] font-bold">Something went wrong</h2>
          <p className="text-[15px] text-muted-foreground mt-1">
            An unexpected error occurred. Try refreshing the page, or go back to the home view.
          </p>
        </div>
        {error.digest && (
          <p className="text-[12px] font-mono text-muted-foreground/60">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex items-center justify-center gap-2">
          <Button onClick={reset} className="flex items-center gap-1.5">
            <RefreshCw className="size-4" /> Try Again
          </Button>
          <Button
            variant="outline"
            onClick={() => window.location.href = "/"}
            className="flex items-center gap-1.5"
          >
            <Home className="size-4" /> Home
          </Button>
        </div>
      </div>
    </div>
  );
}
