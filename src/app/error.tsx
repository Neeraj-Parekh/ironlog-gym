"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <p className="text-sm text-destructive font-medium mb-2">
        Something went wrong
      </p>
      <p className="text-xs text-muted-foreground font-mono mb-4">
        {error.message || "An unexpected error occurred"}
      </p>
      <button
        onClick={reset}
        className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
      >
        Try Again
      </button>
    </div>
  );
}
