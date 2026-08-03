"use client";

import { useSyncExternalStore } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const CHART_HEIGHT = 224;

export function DashboardTrendChart({ data }: { data: Array<{ label: string; amount: number }> }) {
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-surface">
      <div className="h-56 w-full min-h-[224px] min-w-0">
        {mounted ? (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0} minHeight={CHART_HEIGHT}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="trend" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#27272a" strokeDasharray="2 6" vertical={false} />
              <XAxis dataKey="label" stroke="#71717a" tickLine={false} axisLine={false} />
              <YAxis stroke="#71717a" tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }} />
              <Area type="monotone" dataKey="amount" stroke="#8b5cf6" fill="url(#trend)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        ) : null}
      </div>
    </div>
  );
}
