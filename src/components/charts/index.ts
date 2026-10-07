// Regimen chart kit — pure SVG/HTML, no dependencies.
//
// Client components (interactive scrubbing/tooltips): LineChart,
// BarChart, ScatterPlot. Server-safe: CalendarHeatmap (unless you pass
// onSelect), BeforeAfterBar, BarList. Function props (yFormat, tone,
// format, onSelect) can only be passed from Client Components — from a
// Server Component use the `unit` / `decimals` props instead.

export { default as LineChart } from "./LineChart";
export type { LineChartProps, LinePoint, LineBand, LineMarker } from "./LineChart";

export { default as BarChart } from "./BarChart";
export type { BarChartProps, BarDatum, BarTone } from "./BarChart";

export { default as CalendarHeatmap } from "./CalendarHeatmap";
export type { CalendarHeatmapProps, HeatmapDay } from "./CalendarHeatmap";

export { default as BeforeAfterBar } from "./BeforeAfterBar";
export type {
  BeforeAfterBarProps,
  BeforeAfterSample,
  BeforeAfterDirection,
} from "./BeforeAfterBar";

export { default as BarList } from "./BarList";
export type { BarListProps, BarListRow, BarListTone } from "./BarList";

export { default as ScatterPlot } from "./ScatterPlot";
export type { ScatterPlotProps, ScatterPoint } from "./ScatterPlot";

export * from "./scale";
