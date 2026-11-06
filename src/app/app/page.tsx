import Link from "next/link";
import type { ReactNode } from "react";
import { DashboardUpcomingTable } from "@/components/dashboard-upcoming-table";
import { AppIcon } from "@/components/icons";
import { Surface } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth";
import { dashboardStatsForWorkspace, dashboardStatsGlobalForUser, getUserDashboardPrefs, resolveWorkspaceForUser } from "@/lib/db";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { displayDate, formatMoney } from "@/lib/utils";

function tx(locale: string, en: string, ru: string) {
  return locale === "ru" ? ru : en;
}

/** The date a number of days from now, for wording like "first after 20 Nov". */
function isoInDays(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

/** One cell of the stats strip: label, value, and the detail that makes the number useful. */
function Stat({ label, value, detail, tone }: { label: string; value: ReactNode; detail: ReactNode; tone?: "danger" }) {
  return (
    <div className="min-w-0 py-3 pr-4 sm:border-l sm:border-white/[0.06] sm:pl-5 sm:first:border-l-0 sm:first:pl-0">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-2">
        <span className={tone === "danger" ? "text-[17px] font-semibold tabular-nums text-red-300" : "text-[17px] font-semibold tabular-nums text-white"}>{value}</span>
        <span className="truncate text-xs text-zinc-500">{detail}</span>
      </p>
    </div>
  );
}

/** Bars for spend shares; the stacked overview bar only appears when there is more than one row to compare. */
function SpendBars({ rows, currency, total }: { rows: Array<{ name: string; color?: string; monthly: number }>; currency: string; total: number }) {
  const max = Math.max(...rows.map((row) => row.monthly), 1);
  if (!rows.length || total <= 0) return <p className="px-4 py-5 text-sm text-zinc-500">—</p>;
  return (
    <div className="space-y-3 px-4 pb-4 pt-3">
      {rows.length > 1 && rows.some((row) => row.color) ? (
        <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
          {rows.map((row) => <span key={row.name} style={{ flex: row.monthly, backgroundColor: row.color }} />)}
        </div>
      ) : null}
      <ul className="space-y-2.5">
        {rows.map((row) => (
          <li key={row.name} className="space-y-1">
            <div className="flex items-center gap-2 text-[13px]">
              {row.color ? <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.color }} /> : null}
              <span className="min-w-0 flex-1 truncate text-zinc-300">{row.name}</span>
              <span className="tabular-nums text-zinc-100">{formatMoney(row.monthly, currency)}</span>
              <span className="w-9 text-right tabular-nums text-zinc-500">{Math.round((row.monthly / total) * 100)}%</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-white/[0.04]">
              <span className="block h-full rounded-full" style={{ width: `${(row.monthly / max) * 100}%`, backgroundColor: row.color || "#8b5cf6" }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SidePanel({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <Surface className="overflow-hidden">
      <div className="flex items-baseline gap-2 border-b border-white/[0.06] px-4 py-3">
        <h2 className="text-[14px] font-semibold text-white">{title}</h2>
        {note ? <span className="ml-auto truncate text-xs text-zinc-500">{note}</span> : null}
      </div>
      {children}
    </Surface>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ workspace?: string; scope?: string }> }) {
  const user = await requireUser();
  const locale = await getLocale();
  const params = await searchParams;
  const workspace = resolveWorkspaceForUser(user.id, Number(params.workspace || 0) || null);
  const scope = params.scope === "workspace" ? "workspace" : "global";
  const stats = scope === "workspace"
    ? await dashboardStatsForWorkspace(workspace.id, user.id, user.displayCurrency)
    : await dashboardStatsGlobalForUser(user.id, user.displayCurrency);
  const { showTrend } = getUserDashboardPrefs(user.id);
  const globalHref = `/app?workspace=${workspace.id}&scope=global`;
  const workspaceHref = `/app?workspace=${workspace.id}&scope=workspace`;
  const currency = stats.displayCurrency;

  const dueIn30 = stats.upcomingDueByCategory.reduce((sum, row) => sum + row.month, 0);
  const next = stats.upcoming.find((item) => item.daysUntilPayment >= 0);
  const twoWeeksOut = isoInDays(14);
  const overdue = stats.upcoming.filter((item) => item.daysUntilPayment < 0);
  const overdueTotal = overdue.reduce((sum, item) => sum + (item.displayAmount ?? item.amount), 0);
  const oldest = overdue.reduce((most, item) => Math.max(most, -item.daysUntilPayment), 0);
  const nextWeek = stats.upcoming.filter((item) => item.daysUntilPayment >= 0 && item.daysUntilPayment <= 7);
  const change = stats.oneMonthChangePercent;
  const spendTotal = stats.categoryBreakdown.reduce((sum, row) => sum + row.monthly, 0);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-white">{t(locale, "dashboard")}</h1>
          <p className="mt-1 text-[13px] text-zinc-500">{t(locale, "recurringSpend")}</p>
        </div>
        <div className="inline-flex items-center rounded-lg bg-white/[0.04] p-0.5">
          {[
            { href: globalHref, active: scope === "global", label: tx(locale, "All workspaces", "Все пространства") },
            { href: workspaceHref, active: scope === "workspace", label: tx(locale, "This workspace", "Это пространство") },
          ].map((option) => (
            <Link
              key={option.href}
              href={option.href}
              className={`rounded-md px-3 py-1 text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring/60 ${option.active ? "bg-white/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {option.label}
            </Link>
          ))}
        </div>
      </header>

      <section aria-label={tx(locale, "Summary", "Сводка")} className="grid grid-cols-2 border-y border-white/[0.06] lg:grid-cols-4">
        <Stat
          label={tx(locale, "Due in 30 days", "К оплате за 30 дней")}
          value={formatMoney(dueIn30, currency)}
          detail={next
            ? tx(locale, `next on ${displayDate(next.nextPaymentAt)}`, `ближайшая ${displayDate(next.nextPaymentAt)}`)
            : tx(locale, `first after ${displayDate(twoWeeksOut)}`, `первая после ${displayDate(twoWeeksOut)}`)}
        />
        <Stat
          label={tx(locale, "Overdue", "Просрочено")}
          value={overdue.length ? formatMoney(overdueTotal, currency) : 0}
          tone={overdue.length ? "danger" : undefined}
          detail={overdue.length
            ? tx(locale, `${overdue.length} ${overdue.length === 1 ? "entry" : "entries"} · oldest ${oldest} days`, `${overdue.length} шт. · старейшая ${oldest} дн.`)
            : tx(locale, "all paid", "всё оплачено")}
        />
        <Stat
          label={tx(locale, "Per month", "В месяц")}
          value={formatMoney(stats.approxMonthlySpend, currency)}
          detail={showTrend && change ? (
            <><span className={change > 0 ? "text-amber-300" : "text-emerald-300"}>{change > 0 ? "+" : ""}{change.toFixed(1)}%</span> {tx(locale, "vs last month", "к прошлому месяцу")}</>
          ) : tx(locale, `≈ ${formatMoney(stats.approxYearlySpend, currency)} / year`, `≈ ${formatMoney(stats.approxYearlySpend, currency)} / год`)}
        />
        <Stat label={tx(locale, "Active", "Активные")} value={stats.recurringCount} detail={tx(locale, "recurring entries", "регулярных записей")} />
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Surface className="min-w-0 overflow-hidden" role="region" aria-labelledby="upcoming-dates-title">
          <div className="flex items-baseline gap-2 border-b border-white/[0.06] px-5 py-3">
            <h2 id="upcoming-dates-title" className="text-[15px] font-semibold text-white">{tx(locale, "Upcoming dates", "Ближайшие даты")}</h2>
            <span className="text-xs text-zinc-500">{tx(locale, "overdue and the next 2 weeks", "просроченные и 2 недели вперёд")}</span>
          </div>
          <DashboardUpcomingTable items={stats.upcoming} workspaceId={workspace.id} displayCurrency={currency} locale={locale} />
        </Surface>

        {/* Below the 48px top bar, so it stays in view while the list scrolls. */}
        <aside className="grid gap-4 xl:sticky xl:top-16">
          <SidePanel title={tx(locale, "Next 7 days", "Ближайшие 7 дней")} note={nextWeek.length ? formatMoney(nextWeek.reduce((sum, item) => sum + (item.displayAmount ?? item.amount), 0), currency) : undefined}>
            {nextWeek.length ? (
              <ul className="divide-y divide-white/[0.04]">
                {nextWeek.slice(0, 6).map((item) => (
                  <li key={item.id} className="flex items-center gap-2.5 px-4 py-2 text-[13px]">
                    <span className="shrink-0" style={{ color: item.categoryColor || undefined }}><AppIcon name={item.categoryIcon} className="h-3.5 w-3.5" /></span>
                    <span className="min-w-0 flex-1 truncate text-zinc-200">{item.name}</span>
                    <span className="shrink-0 text-xs text-zinc-500">{displayDate(item.nextPaymentAt)}</span>
                    <span className="w-20 shrink-0 text-right tabular-nums text-zinc-100">{formatMoney(item.displayAmount ?? item.amount, item.displayAmount !== undefined ? currency : item.currency)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-4 text-[13px] text-zinc-500">{tx(locale, "Nothing due this week.", "На этой неделе платежей нет.")}</p>
            )}
          </SidePanel>
          <SidePanel title={tx(locale, "Spend by category", "Расходы по категориям")} note={`${formatMoney(spendTotal, currency)} / ${tx(locale, "mo", "мес")}`}>
            <SpendBars rows={stats.categoryBreakdown} currency={currency} total={spendTotal} />
          </SidePanel>
          <SidePanel title={tx(locale, "Top vendors", "Крупнейшие поставщики")} note={tx(locale, "per month", "в месяц")}>
            <SpendBars rows={stats.vendorBreakdown} currency={currency} total={spendTotal} />
          </SidePanel>
        </aside>
      </div>
    </div>
  );
}
