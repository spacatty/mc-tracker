import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarClock, CircleDollarSign, Gauge, Plus, Repeat, WalletCards } from "lucide-react";
import {
  DashboardCategoryPressureChart,
  DashboardCategorySplitChart,
  DashboardWorkspaceCostDominanceChart,
  DashboardWorkspaceObjectDominanceChart,
} from "@/components/dashboard-pie-charts";
import { DashboardUpcomingActions } from "@/components/dashboard-upcoming-actions";
import { AppIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/auth";
import { dashboardStatsForWorkspace, dashboardStatsGlobalForUser, resolveWorkspaceForUser } from "@/lib/db";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { displayDate, formatMoney } from "@/lib/utils";

function StatCard({ label, value, hint, accent, icon }: { label: string; value: string; hint: string; accent: string; icon: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d13]/90 px-4 py-3.5 shadow-[0_12px_28px_-20px_rgba(0,0,0,0.9)]">
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_55%)]" />
      <div className="relative flex items-center justify-between gap-3">
        <p className="inline-flex min-w-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/25" style={{ color: `${accent}cc` }}>{icon}</span>
          <span className="truncate">{label}</span>
        </p>
      </div>
      <div className="relative mt-2 flex items-end justify-between gap-3">
        <p className="text-xl font-semibold leading-none tracking-tight text-white">{value}</p>
      </div>
      <p className="relative mt-1.5 truncate text-[11px] text-zinc-500">{hint}</p>
    </div>
  );
}

function relativeDays(days: number) {
  if (days < 0) return `${Math.abs(days)} day${days === -1 ? "" : "s"} overdue`;
  if (days === 0) return "today";
  if (days === 1) return "~1 day";
  return `~${days} days`;
}

function vendorHref(url: string) {
  const normalized = url.trim();
  if (!normalized) return "";
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return `https://${normalized}`;
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
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-sm font-semibold uppercase tracking-[0.3em] text-violet-300">{t(locale, "recurringSpend")}</h1>
          <div className="mt-3 inline-flex items-center rounded-xl border border-white/10 bg-black/20 p-1">
            <Link
              href={globalHref}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${scope === "global" ? "bg-white/10 text-white" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              {t(locale, "global")}
            </Link>
            <Link
              href={workspaceHref}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${scope === "workspace" ? "bg-white/10 text-white" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              {t(locale, "workspace")}
            </Link>
          </div>
        </div>
        <Button asChild size="lg" variant="secondary" className="gap-2 border-violet-400/20 bg-violet-500/[0.14] text-violet-100 hover:border-violet-300/35 hover:bg-violet-500/[0.24] hover:text-white">
          <Link href={`/app/items/new?workspace=${workspace.id}`}>
            <Plus className="h-4 w-4" />
            {t(locale, "createEntry")}
          </Link>
        </Button>
      </header>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="border-b border-white/10 p-5">
          <h2 className="text-xl font-semibold text-white">{locale === "ru" ? "Ближайшие даты" : "Upcoming dates"}</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {scope === "global"
              ? (locale === "ru" ? "Предстоящие платежи по всем пространствам в ближайшие 2 недели." : "Upcoming payments across all your workspaces in the next 2 weeks.")
              : (locale === "ru" ? "Предстоящие платежи для выбранного пространства в ближайшие 2 недели." : "Upcoming payments for the selected workspace in the next 2 weeks.")}
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{locale === "ru" ? "Название" : "Name"}</TableHead>
              <TableHead>{locale === "ru" ? "Дата оплаты" : "Payment date"}</TableHead>
              <TableHead>{t(locale, "category")}</TableHead>
              <TableHead>{locale === "ru" ? "Вендор" : "Vendor"}</TableHead>
              <TableHead>{locale === "ru" ? "Аккаунт" : "Account"}</TableHead>
              <TableHead className="text-right">{t(locale, "amount")}</TableHead>
              <TableHead className="text-right">{t(locale, "actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.upcoming.map((item) => (
              <TableRow key={item.id} className="group bg-[#0b0b0f] hover:bg-[#111115]">
                <TableCell className="font-medium text-white">{item.name}</TableCell>
                <TableCell className="text-zinc-300">
                  {locale === "ru"
                    ? (item.daysUntilPayment < 0
                      ? `${Math.abs(item.daysUntilPayment)} дн. просрочено`
                      : item.daysUntilPayment === 0
                        ? "сегодня"
                        : `~${item.daysUntilPayment} дн.`)
                    : relativeDays(item.daysUntilPayment)} <span className="text-zinc-500">({displayDate(item.nextPaymentAt)})</span>
                </TableCell>
                <TableCell>
                  <Badge className="gap-2" style={{ backgroundColor: `${item.categoryColor || "#8b5cf6"}25`, color: item.categoryColor || "#c4b5fd" }}>
                    <AppIcon name={item.categoryIcon} className="h-3.5 w-3.5" />
                    {item.categoryName || t(locale, "uncategorized")}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium text-white">
                  {item.vendorName ? (
                    vendorHref(item.vendorUrl) ? (
                      <a href={vendorHref(item.vendorUrl)} target="_blank" rel="noreferrer" className="underline decoration-zinc-600 hover:decoration-violet-300">
                        {item.vendorName}
                      </a>
                    ) : (
                      item.vendorName
                    )
                  ) : (
                    <span className="text-zinc-500">—</span>
                  )}
                </TableCell>
                <TableCell className="text-zinc-300">{item.accountName || "—"}</TableCell>
                <TableCell className="text-right font-semibold text-white">{formatMoney(item.amount, item.currency)}</TableCell>
                <TableCell>
                  <DashboardUpcomingActions
                    workspaceId={item.workspaceId || workspace.id}
                    itemId={item.id}
                    itemName={item.name}
                    amountLabel={formatMoney(item.amount, item.currency)}
                  />
                </TableCell>
              </TableRow>
            ))}
            {!stats.upcoming.length ? (
              <TableRow><TableCell colSpan={7} className="py-10 text-center text-zinc-500">{locale === "ru" ? "Платежей в ближайшие 2 недели нет." : "No payments due in the next 2 weeks."}</TableCell></TableRow>
            ) : null}
          </TableBody>
        </Table>
      </section>

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
        <DashboardCategorySplitChart data={stats.categoryItemSplit} />
        <DashboardCategoryPressureChart data={stats.categoryBreakdown} currency={stats.displayCurrency} />
        {scope === "global" ? <DashboardWorkspaceObjectDominanceChart data={stats.workspaceObjectDominance} /> : null}
        {scope === "global" ? <DashboardWorkspaceCostDominanceChart data={stats.workspaceCostDominance} currency={stats.displayCurrency} /> : null}
      </section>
    </div>
  );
}
