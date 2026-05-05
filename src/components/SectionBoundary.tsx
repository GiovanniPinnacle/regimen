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
// The placeholder is intentionally small + dismissable so the rest of
// the page stays usable. We log the error to console so DevTools still
// surfaces the stack trace for debugging.

import React from "react";

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
      <div
        className="rounded-xl px-3 py-2.5 mb-3 flex items-center justify-between gap-2"
        style={{
          background: "rgba(176, 0, 32, 0.06)",
          border: "1px solid rgba(176, 0, 32, 0.20)",
          color: "var(--error)",
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            style={{ flexShrink: 0 }}
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4M12 16v0.01" />
          </svg>
          <span
            className="text-[12px] truncate"
            style={{ fontWeight: 500 }}
          >
            {this.props.label ?? "This section"} couldn&apos;t load
          </span>
        </div>
        <button
          onClick={this.reset}
          className="text-[11px] underline shrink-0"
          style={{ color: "var(--error)", fontWeight: 600 }}
        >
          Retry
        </button>
      </div>
    );
  }
}
