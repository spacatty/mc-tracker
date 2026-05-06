import { InvoiceForm } from "@/components/invoice-form";
import { Badge } from "@/components/ui/badge";
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
      <header>
        <h1 className="text-sm font-semibold uppercase tracking-[0.3em] text-violet-300">{t(locale, "experimentalInvoiceShifts")}</h1>
      </header>

      <InvoiceForm workspaceId={workspace.id} entries={entries} categories={listCategoriesForWorkspace(workspace.id, user.id)} locale={locale} />

      <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
        <div className="border-b border-white/10 p-5">
          <h2 className="text-lg font-semibold text-white">{t(locale, "invoiceLog")}</h2>
        </div>
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
      </section>
    </div>
  );
}
