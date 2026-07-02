"use client";
import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Error boundary — catches render errors and shows a friendly message
 * instead of crashing the whole app.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-4">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-bold mb-1">Something went wrong</h2>
          <p className="text-sm text-muted-foreground mb-4 max-w-xs">
            This view hit an error. Your data is safe. Try reloading — if it
            persists, a hard reset from Profile → Data Management can help.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => this.setState({ hasError: false })}>
              Try Again
            </Button>
            <Button onClick={() => window.location.reload()}>
              Reload App
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
