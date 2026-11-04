"use client";

import { useSyncExternalStore } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { t, type Locale } from "@/lib/i18n";
import { formatMoney } from "@/lib/utils";

type PieDatum = {
  name: string;
  color: string;
  value: number;
};

const CHART_SIZE = 160;

function ChartSlot({ children }: { children: React.ReactNode }) {
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  return (
    <div className="h-40 w-40 shrink-0">
      {mounted ? children : null}
    </div>
  );
}

function PieCard({
  title,
  subtitle,
  data,
  valueFormatter,
  emptyLabel,
}: {
  title: string;
  subtitle: string;
  data: PieDatum[];
  valueFormatter: (value: number) => string;
  emptyLabel: string;
}) {
  const total = data.reduce((sum, entry) => sum + entry.value, 0);
  // A one-slice donut with padding/stroke draws a visible seam at 12 o'clock.
  const single = data.filter((entry) => entry.value > 0).length <= 1;
  return (
    <div className="rounded-xl border border-white/[0.08] bg-surface">
      <div className="border-b border-white/[0.06] px-5 py-4">
        <h2 className="text-[15px] font-semibold text-white">{title}</h2>
        <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>
      </div>
      {data.length ? (
        <div className="flex flex-col items-center gap-5 p-5 sm:flex-row sm:items-center">
          <ChartSlot>
            <ResponsiveContainer width={CHART_SIZE} height={CHART_SIZE}>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={52}
                  outerRadius={76}
                  paddingAngle={single ? 0 : 1.5}
                  stroke={single ? "none" : "#101013"}
                  strokeWidth={single ? 0 : 2}
                  startAngle={90}
                  endAngle={-270}
                  isAnimationActive={false}
                >
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#101013", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                  itemStyle={{ color: "#e4e4e7" }}
                  formatter={(value) => valueFormatter(Number(Array.isArray(value) ? value[0] : value || 0))}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartSlot>
          <ul className="w-full min-w-0 flex-1 divide-y divide-white/[0.04]">
            {data.slice(0, 7).map((entry) => (
              <li key={entry.name} className="flex items-center gap-2.5 py-2 text-[13px]">
                <span className="h-2 w-2 shrink-0 rounded-[3px]" style={{ backgroundColor: entry.color }} />
                <span className="min-w-0 flex-1 truncate text-zinc-300" title={entry.name}>{entry.name}</span>
                <span className="shrink-0 whitespace-nowrap font-medium tabular-nums text-zinc-100">{valueFormatter(entry.value)}</span>
                <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-zinc-500">{total ? `${Math.round((entry.value / total) * 100)}%` : "—"}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="px-5 py-10 text-center text-[13px] text-zinc-500">{emptyLabel}</p>
      )}
    </div>
  );
}

export function DashboardCategorySplitChart({ data, locale }: { data: Array<{ name: string; color: string; count: number }>; locale: Locale }) {
  return (
    <PieCard
      title={t(locale, "categorySplit")}
      subtitle={t(locale, "categorySplitDescription")}
      data={data.map((entry) => ({ name: entry.name, color: entry.color, value: entry.count }))}
      valueFormatter={(value) => String(value)}
      emptyLabel={t(locale, "noDataYet")}
    />
  );
}

export function DashboardCategoryPressureChart({ data, currency, locale }: { data: Array<{ name: string; color: string; monthly: number }>; currency: string; locale: Locale }) {
  return (
    <PieCard
      title={t(locale, "categorySpend")}
      subtitle={t(locale, "categorySpendDescription")}
      data={data.map((entry) => ({ name: entry.name, color: entry.color, value: entry.monthly }))}
      valueFormatter={(value) => formatMoney(value, currency)}
      emptyLabel={t(locale, "noDataYet")}
    />
  );
}

export function DashboardWorkspaceObjectDominanceChart({ data, locale }: { data: Array<{ name: string; color: string; count: number }>; locale: Locale }) {
  return (
    <PieCard
      title={t(locale, "entriesByWorkspace")}
      subtitle={t(locale, "entriesByWorkspaceDescription")}
      data={data.map((entry) => ({ name: entry.name, color: entry.color, value: entry.count }))}
      valueFormatter={(value) => String(value)}
      emptyLabel={t(locale, "noDataYet")}
    />
  );
}

export function DashboardWorkspaceCostDominanceChart({ data, currency, locale }: { data: Array<{ name: string; color: string; monthly: number }>; currency: string; locale: Locale }) {
  return (
    <PieCard
      title={t(locale, "spendByWorkspace")}
      subtitle={t(locale, "spendByWorkspaceDescription")}
      data={data.map((entry) => ({ name: entry.name, color: entry.color, value: entry.monthly }))}
      valueFormatter={(value) => formatMoney(value, currency)}
      emptyLabel={t(locale, "noDataYet")}
    />
  );
}
