"use client";

// SectionBoundary — class-component error boundary that catches render
// errors in a single subsection and renders a tiny "this section
// errored" placeholder instead of bubbling up to /app/error.tsx and
// killing the whole page.
//
// Usage: wrap any component that does data-fetching or has flaky
// dependencies. /today is the prime example — a single component
// throwing would otherwise blank the entire daily view.
//
//   <SectionBoundary label="Insights">
//     <InsightsBanner />
//   </SectionBoundary>
//
// The placeholder is intentionally small + retryable so the rest of
// the page stays usable. We log the error to console so DevTools still
// surfaces the stack trace for debugging.

import React from "react";
import Icon from "@/components/Icon";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

type Props = {
  /** Short label shown in the placeholder ("Insights", "Patterns"). */
  label?: string;
  /** Render nothing instead of a placeholder when the section errors.
   *  Use for non-essential decorative cards where a placeholder is
   *  worse than silent failure. */
  silent?: boolean;
  children: React.ReactNode;
};

type State = {
  error: Error | null;
};

export default class SectionBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface to DevTools console so devs can debug — and to any future
    // telemetry hook (Sentry/Datadog).
    console.error(
      `[SectionBoundary] ${this.props.label ?? "Section"} crashed:`,
      error,
      info,
    );
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.silent) return null;
    return (
      <Card
        padding="sm"
        role="alert"
        className="mb-3 flex items-center justify-between gap-3"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--surface-alt)] text-[var(--foreground-soft)]">
            <Icon name="info" size={16} strokeWidth={1.8} />
          </span>
          <span className="truncate text-footnote text-[var(--foreground-soft)]">
            {this.props.label ?? "This section"} couldn&apos;t load
          </span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon="refresh"
          onClick={this.reset}
          className="shrink-0 relative before:absolute before:-inset-1 before:content-['']"
        >
          Try again
        </Button>
      </Card>
    );
  }
}
