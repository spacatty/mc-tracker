import type { ReactNode } from "react";
import { DashboardUpcomingTable, UPCOMING_HORIZON_DAYS, type UpcomingWorkspaceContext } from "@/components/dashboard-upcoming-table";
import { AppIcon } from "@/components/icons";
import { SectionCard } from "@/components/ui/section-card";
import { SegmentedLinks } from "@/components/ui/segmented";
import { requireUser } from "@/lib/auth";
import { dashboardStatsForWorkspace, dashboardStatsGlobalForUser, getUserDashboardPrefs, getWorkspaceRole, listCategoriesForWorkspace, listVendorSuggestionsForWorkspace, resolveWorkspaceForUser } from "@/lib/db";
import { pluralRu } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { displayDate, formatMoney, softColor } from "@/lib/utils";

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
    <div className="min-w-0 bg-surface px-5 py-4">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{label}</p>
      <p className="mt-1.5 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className={tone === "danger" ? "text-[18px] font-semibold tabular-nums text-red-300" : "text-[18px] font-semibold tabular-nums text-white"}>{value}</span>
        <span className="truncate text-[11.5px] text-zinc-500">{detail}</span>
      </p>
    </div>
  );
}

/** Bars for spend shares; the stacked overview bar only appears when there is more than one row to compare. */
function SpendBars({ rows, currency, total }: { rows: Array<{ name: string; color?: string; monthly: number }>; currency: string; total: number }) {
  const max = Math.max(...rows.map((row) => row.monthly), 1);
  if (!rows.length || total <= 0) return <p className="px-5 py-4 text-[13px] text-zinc-500">—</p>;
  return (
    <div className="space-y-3 px-5 py-4">
      {rows.length > 1 && rows.some((row) => row.color) ? (
        <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
          {rows.map((row) => <span key={row.name} style={{ flex: row.monthly, backgroundColor: softColor(row.color) }} />)}
        </div>
      ) : null}
      <ul className="space-y-2.5">
        {rows.map((row) => (
          <li key={row.name} className="space-y-1">
            <div className="flex items-center gap-2 text-[13px]">
              {row.color ? <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: softColor(row.color) }} /> : null}
              <span className="min-w-0 flex-1 truncate text-zinc-300">{row.name}</span>
              <span className="tabular-nums text-zinc-100">{formatMoney(row.monthly, currency)}</span>
              <span className="w-9 text-right tabular-nums text-zinc-500">{Math.round((row.monthly / total) * 100)}%</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-white/[0.04]">
              <span className="block h-full rounded-full" style={{ width: `${(row.monthly / max) * 100}%`, backgroundColor: softColor(row.color || "#38bdf8") }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A side column card: the standard SectionCard with a muted figure in the header. */
function SidePanel({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <SectionCard
      flush
      title={title}
      actions={note ? <span className="truncate text-xs tabular-nums text-zinc-500">{note}</span> : undefined}
      headerClassName="items-center"
      // At xl the column is viewport-tall: panels shrink together and each list scrolls inside its own card.
      className="flex flex-col xl:min-h-[9rem] xl:shrink"
      bodyClassName="min-h-0 flex-1 overflow-y-auto"
    >
      {children}
    </SectionCard>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ workspace?: string; scope?: string }> }) {
  const user = await requireUser();
  const locale = await getLocale();
  const params = await searchParams;
  const workspace = resolveWorkspaceForUser(user.id, Number(params.workspace || 0) || null);
  const scope = params.scope === "workspace" ? "workspace" : "global";
  const stats = scope === "workspace"
    ? await dashboardStatsForWorkspace(workspace.id, user.id, user.displayCurrency, UPCOMING_HORIZON_DAYS)
    : await dashboardStatsGlobalForUser(user.id, user.displayCurrency, UPCOMING_HORIZON_DAYS);
  const { showTrend } = getUserDashboardPrefs(user.id);
  const globalHref = `/app?workspace=${workspace.id}&scope=global`;
  const workspaceHref = `/app?workspace=${workspace.id}&scope=workspace`;
  const currency = stats.displayCurrency;
  // The entry drawer opens on the dashboard too, so it needs each listed workspace's categories and vendors.
  const contexts: Record<number, UpcomingWorkspaceContext> = {};
  for (const id of new Set(stats.upcoming.map((item) => item.workspaceId || workspace.id))) {
    contexts[id] = {
      categories: listCategoriesForWorkspace(id, user.id),
      vendorSuggestions: listVendorSuggestionsForWorkspace(id, user.id),
      readOnly: getWorkspaceRole(id, user.id) === "viewer",
    };
  }

  const dueIn30 = stats.upcomingDueByCategory.reduce((sum, row) => sum + row.month, 0);
  const next = stats.upcoming.find((item) => item.daysUntilPayment >= 0 && item.daysUntilPayment <= 30);
  const twoWeeksOut = isoInDays(14);
  const overdue = stats.upcoming.filter((item) => item.daysUntilPayment < 0);
  const overdueTotal = overdue.reduce((sum, item) => sum + (item.displayAmount ?? item.amount), 0);
  const oldest = overdue.reduce((most, item) => Math.max(most, -item.daysUntilPayment), 0);
  const nextWeek = stats.upcoming.filter((item) => item.daysUntilPayment >= 0 && item.daysUntilPayment <= 7);
  const change = stats.oneMonthChangePercent;
  const spendTotal = stats.categoryBreakdown.reduce((sum, row) => sum + row.monthly, 0);

  return (
    <div className="flex min-h-0 flex-col gap-4 xl:h-full">
      <section
        aria-label={tx(locale, "Summary", "Сводка")}
        className="grid shrink-0 grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.06] lg:grid-cols-4"
      >
        <Stat
          label={tx(locale, "Due in 30 days", "К оплате за 30 дней")}
          value={formatMoney(dueIn30, currency)}
          detail={next
            ? tx(locale, `next on ${displayDate(next.nextPaymentAt)}`, `ближайший — ${displayDate(next.nextPaymentAt)}`)
            : tx(locale, `first after ${displayDate(twoWeeksOut)}`, `ближайший после ${displayDate(twoWeeksOut)}`)}
        />
        <Stat
          label={tx(locale, "Overdue", "Просрочено")}
          value={overdue.length ? formatMoney(overdueTotal, currency) : 0}
          tone={overdue.length ? "danger" : undefined}
          detail={overdue.length
            ? tx(locale, `${overdue.length} ${overdue.length === 1 ? "entry" : "entries"} · oldest ${oldest} days`, `${overdue.length} ${pluralRu(overdue.length, "запись", "записи", "записей")} · самая давняя — ${oldest} дн.`)
            : tx(locale, "all paid", "всё оплачено")}
        />
        <Stat
          label={tx(locale, "Per month", "В месяц")}
          value={formatMoney(stats.approxMonthlySpend, currency)}
          detail={showTrend && change ? (
            <><span className={change > 0 ? "text-amber-300" : "text-emerald-300"}>{change > 0 ? "+" : ""}{change.toFixed(1)}%</span> {tx(locale, "vs last month", "к прошлому месяцу")}</>
          ) : tx(locale, `≈ ${formatMoney(stats.approxYearlySpend, currency)} / year`, `≈ ${formatMoney(stats.approxYearlySpend, currency)} / год`)}
        />
        <Stat label={tx(locale, "Active", "Активные")} value={stats.recurringCount} detail={tx(locale, "recurring entries", pluralRu(stats.recurringCount, "регулярная запись", "регулярные записи", "регулярных записей"))} />
      </section>

      <div className="grid items-start gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_320px] xl:grid-rows-[minmax(0,1fr)] xl:items-stretch">
        <DashboardUpcomingTable
          items={stats.upcoming}
          workspaceId={workspace.id}
          displayCurrency={currency}
          contexts={contexts}
          locale={locale}
          headerActions={
            <SegmentedLinks
              size="sm"
              ariaLabel={tx(locale, "Dashboard scope", "Область обзора")}
              value={scope}
              options={[
                { value: "global", href: globalHref, label: tx(locale, "All workspaces", "Все пространства") },
                { value: "workspace", href: workspaceHref, label: tx(locale, "This workspace", "Это пространство") },
              ]}
            />
          }
        />

        {/* Scrolls on its own beside the table at xl. */}
        <aside className="flex flex-col gap-4 xl:min-h-0">
          <SidePanel title={tx(locale, "Next 7 days", "Ближайшие 7 дней")} note={nextWeek.length ? formatMoney(nextWeek.reduce((sum, item) => sum + (item.displayAmount ?? item.amount), 0), currency) : undefined}>
            {nextWeek.length ? (
              <ul className="divide-y divide-white/[0.05]">
                {nextWeek.map((item) => (
                  <li key={item.id} className="flex items-center gap-2.5 px-5 py-2.5 text-[13px]">
                    <span className="shrink-0" style={{ color: softColor(item.categoryColor) }}><AppIcon name={item.categoryIcon} className="h-3.5 w-3.5" /></span>
                    <span className="min-w-0 flex-1 truncate text-zinc-200">{item.name}</span>
                    <span className="shrink-0 text-[11.5px] tabular-nums text-zinc-500">{displayDate(item.nextPaymentAt)}</span>
                    <span className="w-20 shrink-0 text-right font-medium tabular-nums text-zinc-100">{formatMoney(item.displayAmount ?? item.amount, item.displayAmount !== undefined ? currency : item.currency)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-[13px] text-zinc-500">{tx(locale, "Nothing due this week.", "На этой неделе платежей нет.")}</p>
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
