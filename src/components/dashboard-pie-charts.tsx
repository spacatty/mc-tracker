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

const CHART_HEIGHT = 224;

function ChartSlot({ children }: { children: React.ReactNode }) {
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  return (
    <div className="h-56 w-full min-h-[224px] min-w-0">
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
  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-surface">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_180px]">
        <ChartSlot>
          <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0} minHeight={CHART_HEIGHT}>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={1} stroke="#111113" strokeWidth={2}>
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
                formatter={(value) => valueFormatter(Number(Array.isArray(value) ? value[0] : value || 0))}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartSlot>
        <div className="space-y-2">
          {data.slice(0, 7).map((entry) => (
            <div key={entry.name} className="flex items-center justify-between rounded-md bg-surface-muted px-3 py-2">
              <span className="inline-flex items-center gap-2 text-sm text-zinc-300">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                {entry.name}
              </span>
              <span className="text-sm font-semibold text-white">{valueFormatter(entry.value)}</span>
            </div>
          ))}
          {!data.length ? <p className="text-sm text-zinc-500">{emptyLabel}</p> : null}
        </div>
      </div>
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
