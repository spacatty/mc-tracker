"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { useState, useTransition } from "react";
import { CalendarCheck, Edit3, WalletCards, X } from "lucide-react";
import { payEntryAction } from "@/app/actions";
import type { Locale } from "@/lib/i18n";
import { Button } from "./ui/button";
import { DatePickerInput } from "./ui/date-picker";

function tx(locale: Locale, en: string, ru: string) {
  return locale === "ru" ? ru : en;
}

export function DashboardUpcomingActions({
  workspaceId,
  itemId,
  itemName,
  amountLabel,
  locale = "en",
}: {
  workspaceId: number;
  itemId: number;
  itemName: string;
  amountLabel: string;
  locale?: Locale;
}) {
  const [open, setOpen] = useState(false);
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [isPending, startTransition] = useTransition();

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
    <div className="flex justify-end gap-1.5">
      <Button
        asChild
        variant="secondary"
        size="sm"
        className="h-7 gap-1.5 border-sky-400/20 bg-sky-500/10 px-2 text-[11px] text-sky-100 hover:border-sky-300/35 hover:bg-sky-500/20"
      >
        <Link href={`/app/items/${itemId}?workspace=${workspaceId}`}>
          <Edit3 className="h-3.5 w-3.5" />
          {tx(locale, "Quick edit", "Изменить")}
        </Link>
      </Button>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 gap-1.5 border-emerald-400/20 bg-emerald-500/10 px-2 text-[11px] text-emerald-100 hover:border-emerald-300/35 hover:bg-emerald-500/20"
          >
            <WalletCards className="h-3.5 w-3.5" />
            {tx(locale, "Quick Pay", "Оплатить")}
          </Button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-5 shadow-overlay">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-200">
                      <CalendarCheck className="h-5 w-5" />
                    </span>
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-white">{tx(locale, "Quick Pay", "Быстрая оплата")}</Dialog.Title>
                      <Dialog.Description className="mt-2 text-sm leading-6 text-zinc-400">
                        {tx(
                          locale,
                          `Record a basic renewal for ${itemName}. Price, billing period, and next due date advance normally.`,
                          `Записать продление для ${itemName}. Цена, период и следующая дата оплаты обновятся автоматически.`,
                        )}
                      </Dialog.Description>
                    </div>
                  </div>
                  <Dialog.Close asChild>
                    <button type="button" className="rounded-md p-2 text-zinc-500 transition hover:bg-white/10 hover:text-white" aria-label={tx(locale, "Close quick pay dialog", "Закрыть окно оплаты")}>
                      <X className="h-4 w-4" />
                    </button>
                  </Dialog.Close>
                </div>

                <div className="mt-5 rounded-lg border border-border bg-surface-muted p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{tx(locale, "Invoice payment date", "Дата оплаты")}</p>
                  <div className="mt-3">
                    <DatePickerInput name="paymentDate" value={paymentDate} onChange={setPaymentDate} locale={locale} />
                  </div>
                  <p className="mt-3 text-xs text-zinc-500">
                    {tx(
                      locale,
                      `Invoice amount: ${amountLabel}. Use full invoice flow if price, vendor, or billing period changed.`,
                      `Сумма: ${amountLabel}. Используйте полный счёт, если изменилась цена, поставщик или период.`,
                    )}
                  </p>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <Dialog.Close asChild>
                    <Button type="button" variant="secondary" disabled={isPending}>{tx(locale, "Cancel", "Отмена")}</Button>
                  </Dialog.Close>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={quickPay}
                    disabled={isPending || !paymentDate}
                    className="border border-emerald-400/20 bg-emerald-500/[0.12] text-emerald-100 hover:border-emerald-300/35 hover:bg-emerald-500/[0.2] hover:text-white"
                  >
                    {isPending ? tx(locale, "Recording...", "Сохранение...") : tx(locale, "Record Quick Pay", "Записать оплату")}
                  </Button>
                </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
