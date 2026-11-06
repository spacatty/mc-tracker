"use client";

import { useState, useTransition } from "react";
import { CalendarCheck, ExternalLink, KeyRound, Loader2, Pencil, WalletCards } from "lucide-react";
import { payEntryAction } from "@/app/actions";
import type { Locale } from "@/lib/i18n";
import { Button } from "./ui/button";
import { DatePickerInput } from "./ui/date-picker";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Field } from "./ui/field";
import { RowAction, RowActionMenu, RowActions } from "./ui/row-actions";
import { QuickLoginDialog } from "./vault/quick-login";

function tx(locale: Locale, en: string, ru: string) {
  return locale === "ru" ? ru : en;
}

/**
 * The upcoming-dates row actions: Pay (records a payment), Quick login (hover-revealed, when the entry has a
 * vendor or account), and a ⋯ menu with Edit and the vendor site. Clicks never reach the row.
 */
export function DashboardUpcomingActions({
  workspaceId,
  itemId,
  itemName,
  amountLabel,
  vendorUrl,
  canQuickLogin = true,
  locale = "en",
  className,
}: {
  workspaceId: number;
  itemId: number;
  itemName: string;
  amountLabel: string;
  /** Normalised vendor URL; adds "Open vendor site" to the menu. */
  vendorUrl?: string;
  /** Show the Quick login action (the entry has a vendor or account). */
  canQuickLogin?: boolean;
  locale?: Locale;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [isPending, startTransition] = useTransition();
  const dateId = `pay-date-${itemId}`;

  function quickPay() {
    const formData = new FormData();
    formData.set("id", String(itemId));
    formData.set("workspaceId", String(workspaceId));
    formData.set("paymentDate", paymentDate);
    startTransition(async () => {
      await payEntryAction(formData);
      setOpen(false);
    });
  }

  return (
    <RowActions className={className}>
      <RowAction label={tx(locale, "Pay", "Оплатить")} icon={<WalletCards />} onClick={() => setOpen(true)} />
      {canQuickLogin ? (
        <RowAction label={tx(locale, "Quick login", "Быстрый вход")} icon={<KeyRound />} onClick={() => setLoginOpen(true)} />
      ) : (
        // Keeps the icons in one column across rows when an entry has no login.
        <span className="inline-block h-7 w-7 shrink-0" aria-hidden="true" />
      )}
      <RowActionMenu
        label={tx(locale, `More actions for ${itemName}`, `Другие действия: ${itemName}`)}
        items={[
          // Opens the entry in the Entries page drawer, the same editor used there.
          { label: tx(locale, "Edit", "Изменить"), icon: <Pencil />, href: `/app/items?workspace=${workspaceId}&entry=${itemId}` },
          vendorUrl ? { label: tx(locale, "Open vendor site", "Открыть сайт поставщика"), icon: <ExternalLink />, href: vendorUrl, external: true } : null,
        ]}
      />

      <Dialog open={open} onOpenChange={(next) => { if (!isPending) setOpen(next); }}>
        <DialogContent size="sm" closeLabel={tx(locale, "Close quick pay dialog", "Закрыть окно оплаты")}>
          <DialogHeader icon={<CalendarCheck />} tone="success">
            <DialogTitle>{tx(locale, "Record payment", "Записать оплату")}</DialogTitle>
            <DialogDescription>
              {tx(
                locale,
                `Record a renewal for ${itemName}. The billing period and next due date move forward as usual.`,
                `Отметьте продление «${itemName}». Период оплаты и следующая дата сдвинутся как обычно.`,
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Field
              label={tx(locale, "Payment date", "Дата оплаты")}
              htmlFor={dateId}
              hint={tx(
                locale,
                `Amount: ${amountLabel}. Use the full invoice form if the price, vendor or period changed.`,
                `Сумма: ${amountLabel}. Если изменились цена, поставщик или период, используйте полную форму счёта.`,
              )}
            >
              <DatePickerInput name="paymentDate" triggerId={dateId} value={paymentDate} onChange={setPaymentDate} locale={locale} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={() => setOpen(false)}>
              {tx(locale, "Cancel", "Отмена")}
            </Button>
            <Button type="button" size="sm" onClick={quickPay} disabled={isPending || !paymentDate}>
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
              {isPending ? tx(locale, "Recording…", "Сохранение…") : tx(locale, "Record payment", "Записать оплату")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <QuickLoginDialog open={loginOpen} onOpenChange={setLoginOpen} workspaceId={workspaceId} itemId={itemId} locale={locale} />
    </RowActions>
  );
}
