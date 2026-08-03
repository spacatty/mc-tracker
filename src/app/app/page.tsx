import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarClock, CircleDollarSign, Gauge, Plus, Repeat, WalletCards } from "lucide-react";
import {
  DashboardCategoryPressureChart,
  DashboardCategorySplitChart,
  DashboardWorkspaceCostDominanceChart,
  DashboardWorkspaceObjectDominanceChart,
} from "@/components/dashboard-pie-charts";
import { DashboardUpcomingTable } from "@/components/dashboard-upcoming-table";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Surface } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth";
import { dashboardStatsForWorkspace, dashboardStatsGlobalForUser, resolveWorkspaceForUser } from "@/lib/db";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { formatMoney } from "@/lib/utils";

function StatCard({ label, value, hint, accent, icon }: { label: string; value: string; hint: string; accent: string; icon: ReactNode }) {
  return (
    <Surface className="relative overflow-hidden px-4 py-3.5">
      <div className="relative flex items-center justify-between gap-3">
        <p className="inline-flex min-w-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle-foreground">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border bg-surface-muted" style={{ color: `${accent}cc` }}>{icon}</span>
          <span className="truncate">{label}</span>
        </p>
      </div>
      <div className="relative mt-2 flex items-end justify-between gap-3">
        <p className="text-xl font-semibold leading-none tracking-tight text-white">{value}</p>
      </div>
      <p className="relative mt-1.5 truncate text-[11px] text-subtle-foreground">{hint}</p>
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
  const globalHref = `/app?workspace=${workspace.id}&scope=global`;
  const workspaceHref = `/app?workspace=${workspace.id}&scope=workspace`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t(locale, "overview")}
        title={t(locale, "dashboard")}
        description={t(locale, "recurringSpend")}
        actions={(
          <Button asChild>
            <Link href={`/app/items?workspace=${workspace.id}&add=1`}>
              <Plus className="h-4 w-4" />
              {t(locale, "createEntry")}
            </Link>
          </Button>
        )}
      >
          <div className="mt-3 inline-flex items-center rounded-md border border-border bg-surface-muted p-1">
            <Link
              href={globalHref}
              className={`rounded-sm px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring/60 ${scope === "global" ? "bg-surface-raised text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t(locale, "global")}
            </Link>
            <Link
              href={workspaceHref}
              className={`rounded-sm px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring/60 ${scope === "workspace" ? "bg-surface-raised text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t(locale, "workspace")}
            </Link>
          </div>
      </PageHeader>

      <Surface className="overflow-hidden" role="region" aria-labelledby="upcoming-dates-title">
        <div className="border-b border-border p-5">
          <h2 id="upcoming-dates-title" className="text-xl font-semibold text-white">{locale === "ru" ? "Ближайшие даты" : "Upcoming dates"}</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {scope === "global"
              ? (locale === "ru" ? "Предстоящие платежи по всем пространствам в ближайшие 2 недели." : "Upcoming payments across all your workspaces in the next 2 weeks.")
              : (locale === "ru" ? "Предстоящие платежи для выбранного пространства в ближайшие 2 недели." : "Upcoming payments for the selected workspace in the next 2 weeks.")}
          </p>
        </div>
        <DashboardUpcomingTable items={stats.upcoming} workspaceId={workspace.id} locale={locale} />
      </Surface>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label={locale === "ru" ? "Всего" : "Total"}
          value={formatMoney(stats.totalExpenses, stats.displayCurrency)}
          hint={locale === "ru" ? "Разовые + регулярные" : "Single + recurring"}
          accent="#8b5cf6"
          icon={<CircleDollarSign className="h-3.5 w-3.5" />}
        />
        <StatCard
          label={locale === "ru" ? "Ежемесячные" : "Monthly recurring"}
          value={formatMoney(stats.monthlyRecurring, stats.displayCurrency)}
          hint={locale === "ru" ? `Ежемесячных записей: ${stats.monthlyRecurringCount}` : `${stats.monthlyRecurringCount} monthly entries`}
          accent="#38bdf8"
          icon={<Repeat className="h-3.5 w-3.5" />}
        />
        <StatCard
          label={locale === "ru" ? "Примерно в месяц" : "Approx monthly"}
          value={formatMoney(stats.approxMonthlySpend, stats.displayCurrency)}
          hint={locale === "ru" ? "Нормализованные регулярные" : "Normalized recurring"}
          accent="#06b6d4"
          icon={<CalendarClock className="h-3.5 w-3.5" />}
        />
        <StatCard
          label={locale === "ru" ? "Примерно в год" : "Approx yearly"}
          value={formatMoney(stats.approxYearlySpend, stats.displayCurrency)}
          hint={locale === "ru" ? `${formatMoney(stats.approxMonthlySpend, stats.displayCurrency)} / мес` : `${formatMoney(stats.approxMonthlySpend, stats.displayCurrency)} / month`}
          accent="#f43f5e"
          icon={<WalletCards className="h-3.5 w-3.5" />}
        />
        <StatCard
          label={locale === "ru" ? "Тренд за 1 месяц" : "1-month trend"}
          value={`${stats.oneMonthChangePercent.toFixed(1)}%`}
          hint={locale === "ru" ? `${formatMoney(stats.oneMonthChangeAmount, stats.displayCurrency)} влияние` : `${formatMoney(stats.oneMonthChangeAmount, stats.displayCurrency)} impact`}
          accent="#a3e635"
          icon={<Gauge className="h-3.5 w-3.5" />}
        />
      </section>

      <section className={`grid gap-5 ${scope === "global" ? "xl:grid-cols-2" : "xl:grid-cols-2"}`}>
        <DashboardCategorySplitChart data={stats.categoryItemSplit} locale={locale} />
        <DashboardCategoryPressureChart data={stats.categoryBreakdown} currency={stats.displayCurrency} locale={locale} />
        {scope === "global" ? <DashboardWorkspaceObjectDominanceChart data={stats.workspaceObjectDominance} locale={locale} /> : null}
        {scope === "global" ? <DashboardWorkspaceCostDominanceChart data={stats.workspaceCostDominance} currency={stats.displayCurrency} locale={locale} /> : null}
      </section>
    </div>
  );
}
