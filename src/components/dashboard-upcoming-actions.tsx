"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { useState, useTransition } from "react";
import { CalendarCheck, KeyRound, MoreHorizontal, Pencil, WalletCards, X } from "lucide-react";
import { payEntryAction } from "@/app/actions";
import type { Locale } from "@/lib/i18n";
import { Button } from "./ui/button";
import { DatePickerInput } from "./ui/date-picker";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { QuickLoginDialog } from "./vault/quick-login";

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
  const [loginOpen, setLoginOpen] = useState(false);
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
    // Rows expand on click, so keep clicks on the actions to themselves.
    <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-emerald-400/20 bg-emerald-500/10 px-2.5 text-[11px] font-medium text-emerald-200 transition hover:border-emerald-300/35 hover:bg-emerald-500/20 hover:text-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
          >
            <WalletCards className="h-3.5 w-3.5" />
            {tx(locale, "Pay", "Оплатить")}
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="capture-overlay-in fixed inset-0 z-50 bg-black/60 backdrop-blur-md" />
          <Dialog.Content className="capture-panel-in fixed inset-x-0 top-[16vh] z-50 mx-auto w-[calc(100vw-1.5rem)] max-w-md rounded-xl border border-white/10 bg-[#101013] p-5 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.85)]">
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
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={tx(locale, "More actions", "Другие действия")}
            className="inline-grid h-7 w-7 place-items-center rounded-md border border-white/10 bg-white/[0.03] text-zinc-400 transition hover:bg-white/[0.07] hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40 data-[state=open]:bg-white/[0.07] data-[state=open]:text-zinc-100"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={6} className="min-w-44 bg-[#18181c]">
          {/* Opened from onSelect so the dialog mounts after the menu has closed and returned focus. */}
          <DropdownMenuItem className="gap-2.5" onSelect={() => setLoginOpen(true)}>
            <KeyRound className="h-3.5 w-3.5 text-violet-300" />
            {tx(locale, "Quick login", "Быстрый вход")}
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2.5" asChild>
            {/* Opens the entry in the Entries page inspector, the same editor used there. */}
            <Link href={`/app/items?workspace=${workspaceId}&entry=${itemId}`}>
              <Pencil className="h-3.5 w-3.5 text-sky-300" />
              {tx(locale, "Quick edit", "Изменить")}
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <QuickLoginDialog open={loginOpen} onOpenChange={setLoginOpen} workspaceId={workspaceId} itemId={itemId} locale={locale} />
    </div>
  );
}
