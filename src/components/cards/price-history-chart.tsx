"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  buildChartRows,
  type BuyPoint,
  type ChartRow,
  type PricePoint,
} from "@/lib/chart-series";
import { formatCurrency } from "@/lib/cost-basis";

export function PriceHistoryChart({
  points,
  targetPrice,
  buys = [],
}: {
  points: PricePoint[];
  targetPrice: number | null;
  buys?: BuyPoint[];
}) {
  if (points.length === 0 && buys.length === 0) {
    return (
      <p className="text-muted-foreground py-12 text-center text-sm">
        No prices logged yet.
      </p>
    );
  }

  const rows = buildChartRows(points, buys);
  const hasBuys = buys.length > 0;

  // The y-axis is scaled to the data, so a target far from recent prices sits
  // outside the domain — and recharts silently discards a reference line it
  // can't place. Widening the domain to reach the target would flatten the
  // price movement the chart exists to show, so an out-of-range target is
  // called out in the footnote instead of being drawn.
  const values = rows
    .flatMap((row) => [row.price, row.buy])
    .filter((value): value is number => value != null);
  const targetOffChart =
    targetPrice != null &&
    values.length > 0 &&
    (targetPrice < Math.min(...values) || targetPrice > Math.max(...values));
  const showTargetLine = targetPrice != null && !targetOffChart;

  return (
    <div className="flex flex-col gap-2">
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={(v: number) => `$${v}`}
              domain={["auto", "auto"]}
            />
            <Tooltip
              formatter={(value, name, item) => {
                if (name === "buy") {
                  const qty = (item?.payload as ChartRow | undefined)?.buyQty;
                  return [
                    `$${Number(value).toFixed(2)}${qty ? ` × ${qty}` : ""}`,
                    "Bought",
                  ];
                }
                return [`$${Number(value).toFixed(2)}`, "Price"];
              }}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                fontSize: 12,
              }}
            />
            {showTargetLine && (
              <ReferenceLine
                y={targetPrice}
                stroke="var(--muted-foreground)"
                strokeDasharray="4 4"
                label={{ value: "Target", fontSize: 11, position: "insideTopLeft" }}
              />
            )}
            <Line
              type="monotone"
              dataKey="price"
              stroke="var(--primary)"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              connectNulls
            />
            {hasBuys && (
              // strokeWidth 0 keeps this a scatter of markers rather than a
              // second trend line, while still feeding the shared tooltip.
              <Line
                type="monotone"
                dataKey="buy"
                stroke="var(--buy)"
                strokeWidth={0}
                dot={{ r: 5, fill: "var(--buy)", stroke: "var(--background)", strokeWidth: 2 }}
                activeDot={{ r: 7 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {(hasBuys || targetOffChart) && (
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {hasBuys && (
            <p className="flex items-center gap-1.5">
              <span
                className="inline-block size-2.5 rounded-full"
                style={{ background: "var(--buy)" }}
              />
              What you paid
            </p>
          )}
          {targetOffChart && (
            <p className="flex items-center gap-1.5">
              <span className="border-muted-foreground inline-block w-4 border-t border-dashed" />
              Target {formatCurrency(targetPrice)} —{" "}
              {targetPrice < Math.min(...values) ? "below" : "above"} chart range
            </p>
          )}
        </div>
      )}
    </div>
  );
}
