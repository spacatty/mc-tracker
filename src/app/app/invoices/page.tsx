import { InvoiceForm } from "@/components/invoice-form";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Surface } from "@/components/ui/surface";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/auth";
import { listCategoriesForWorkspace, listInvoicesForWorkspace, listItemsForWorkspace, resolveWorkspaceForUser } from "@/lib/db";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { displayDate, formatMoney, periodLabel } from "@/lib/utils";

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const user = await requireUser();
  const locale = await getLocale();
  const params = await searchParams;
  const workspace = resolveWorkspaceForUser(user.id, Number(params.workspace || 0) || null);
  const invoices = listInvoicesForWorkspace(workspace.id, user.id);
  const entries = listItemsForWorkspace(workspace.id, user.id);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t(locale, "billing")}
        title={t(locale, "invoices")}
        description={t(locale, "recordPaymentDescription")}
      />

      <InvoiceForm workspaceId={workspace.id} entries={entries} categories={listCategoriesForWorkspace(workspace.id, user.id)} locale={locale} />

      <Surface className="overflow-hidden" role="region" aria-labelledby="invoice-history-title">
        <div className="border-b border-border p-5">
          <h2 id="invoice-history-title" className="text-lg font-semibold text-white">{t(locale, "invoiceLog")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t(locale, "invoiceHistoryDescription")}</p>
        </div>
        <div className="space-y-3 p-3 md:hidden">
          {invoices.map((invoice) => (
            <article key={invoice.id} className="rounded-lg border border-border bg-surface-muted p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-foreground">{invoice.itemName || t(locale, "manualInvoice")}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{invoice.categoryName || t(locale, "uncategorized")}</p>
                </div>
                <p className="shrink-0 font-semibold text-foreground">{formatMoney(invoice.amount, invoice.currency)}</p>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-subtle-foreground">{t(locale, "vendor")}</dt>
                  <dd className="mt-1 text-muted-foreground">{invoice.vendorName || "—"}</dd>
                </div>
                <div>
                  <dt className="text-subtle-foreground">{t(locale, "period")}</dt>
                  <dd className="mt-1 text-muted-foreground">{periodLabel(invoice.period, invoice.customPeriodDays)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-subtle-foreground">{t(locale, "paymentDue")}</dt>
                  <dd className="mt-1 text-muted-foreground">{displayDate(invoice.paymentDate)} → {displayDate(invoice.dueDate)}</dd>
                </div>
              </dl>
              {(invoice.shiftDates || invoice.shiftPaymentPeriod) ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {invoice.shiftDates ? <Badge variant="success">{t(locale, "dates").toLowerCase()}</Badge> : null}
                  {invoice.shiftPaymentPeriod ? <Badge variant="secondary">{t(locale, "period").toLowerCase()}</Badge> : null}
                </div>
              ) : null}
            </article>
          ))}
          {!invoices.length ? <p className="py-8 text-center text-sm text-muted-foreground">{t(locale, "noInvoicesYet")}</p> : null}
        </div>
        <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t(locale, "entry")}</TableHead>
              <TableHead>{t(locale, "category")}</TableHead>
              <TableHead>{locale === "ru" ? "Вендор" : "Vendor"}</TableHead>
              <TableHead>{t(locale, "paymentDue")}</TableHead>
              <TableHead>{t(locale, "period")}</TableHead>
              <TableHead className="text-right">{t(locale, "amount")}</TableHead>
              <TableHead>{locale === "ru" ? "Сдвиги" : "Shifts"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium text-white">{invoice.itemName || t(locale, "manualInvoice")}</TableCell>
                <TableCell>{invoice.categoryName || t(locale, "uncategorized")}</TableCell>
                <TableCell>
                  <p>{invoice.vendorName || "-"}</p>
                  {invoice.accountName ? <p className="max-w-48 truncate text-xs text-zinc-400">{invoice.accountName}</p> : null}
                  {invoice.vendorUrl ? <p className="max-w-48 truncate text-xs text-zinc-500">{invoice.vendorUrl}</p> : null}
                </TableCell>
                <TableCell className="text-xs text-zinc-400">{displayDate(invoice.paymentDate)} → {displayDate(invoice.dueDate)}</TableCell>
                <TableCell>{periodLabel(invoice.period, invoice.customPeriodDays)}</TableCell>
                <TableCell className="text-right font-semibold text-white">{formatMoney(invoice.amount, invoice.currency)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {invoice.shiftDates ? <Badge variant="success">{t(locale, "dates").toLowerCase()}</Badge> : null}
                    {invoice.shiftPaymentPeriod ? <Badge>{t(locale, "period").toLowerCase()}</Badge> : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!invoices.length ? <TableRow><TableCell colSpan={7} className="py-10 text-center text-zinc-500">{t(locale, "noInvoicesYet")}</TableCell></TableRow> : null}
          </TableBody>
        </Table>
        </div>
      </Surface>
    </div>
  );
}
