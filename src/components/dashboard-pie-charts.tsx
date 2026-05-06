"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatMoney } from "@/lib/utils";

type PieDatum = {
  name: string;
  color: string;
  value: number;
};

function PieCard({
  title,
  subtitle,
  data,
  valueFormatter,
}: {
  title: string;
  subtitle: string;
  data: PieDatum[];
  valueFormatter: (value: number) => string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_180px]">
        <div className="h-64 min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2} stroke="none">
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#09090b", border: "1px solid #27272a", borderRadius: 12 }}
                formatter={(value) => valueFormatter(Number(Array.isArray(value) ? value[0] : value || 0))}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-2">
          {data.slice(0, 7).map((entry) => (
            <div key={entry.name} className="flex items-center justify-between rounded-xl bg-black/25 px-3 py-2">
              <span className="inline-flex items-center gap-2 text-sm text-zinc-300">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                {entry.name}
              </span>
              <span className="text-sm font-semibold text-white">{valueFormatter(entry.value)}</span>
            </div>
          ))}
          {!data.length ? <p className="text-sm text-zinc-500">No data yet.</p> : null}
        </div>
      </div>
    </div>
  );
}

export function DashboardCategorySplitChart({ data }: { data: Array<{ name: string; color: string; count: number }> }) {
  return (
    <PieCard
      title="Category split"
      subtitle="Item count dominance by category"
      data={data.map((entry) => ({ name: entry.name, color: entry.color, value: entry.count }))}
      valueFormatter={(value) => String(value)}
    />
  );
}

export function DashboardCategoryPressureChart({ data, currency }: { data: Array<{ name: string; color: string; monthly: number }>; currency: string }) {
  return (
    <PieCard
      title="Category pressure"
      subtitle="Recurring pressure by monthly amount"
      data={data.map((entry) => ({ name: entry.name, color: entry.color, value: entry.monthly }))}
      valueFormatter={(value) => formatMoney(value, currency)}
    />
  );
}

export function DashboardWorkspaceObjectDominanceChart({ data }: { data: Array<{ name: string; color: string; count: number }> }) {
  return (
    <PieCard
      title="Workspace dominance"
      subtitle="Total objects by workspace"
      data={data.map((entry) => ({ name: entry.name, color: entry.color, value: entry.count }))}
      valueFormatter={(value) => String(value)}
    />
  );
}

export function DashboardWorkspaceCostDominanceChart({ data, currency }: { data: Array<{ name: string; color: string; monthly: number }>; currency: string }) {
  return (
    <PieCard
      title="Workspace cost dominance"
      subtitle="Recurring monthly pressure by workspace"
      data={data.map((entry) => ({ name: entry.name, color: entry.color, value: entry.monthly }))}
      valueFormatter={(value) => formatMoney(value, currency)}
    />
  );
}
