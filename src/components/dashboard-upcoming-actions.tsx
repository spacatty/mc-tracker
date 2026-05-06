"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { useState, useTransition } from "react";
import { CalendarCheck, Edit3, WalletCards, X } from "lucide-react";
import { payEntryAction } from "@/app/actions";
import { Button } from "./ui/button";
import { DatePickerInput } from "./ui/date-picker";

export function DashboardUpcomingActions({
  workspaceId,
  itemId,
  itemName,
  amountLabel,
}: {
  workspaceId: number;
  itemId: number;
  itemName: string;
  amountLabel: string;
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
    <div className="flex justify-end gap-2">
      <Button
        asChild
        size="sm"
        variant="ghost"
        className="border border-sky-400/15 bg-sky-400/[0.06] px-3 text-sky-100 hover:border-sky-300/30 hover:bg-sky-400/10 hover:text-white"
      >
        <Link href={`/app/items/${itemId}?workspace=${workspaceId}`}>
          <Edit3 className="h-4 w-4" />
          Quick edit
        </Link>
      </Button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="border border-emerald-400/15 bg-emerald-400/[0.06] px-3 text-emerald-100 hover:border-emerald-300/30 hover:bg-emerald-400/10 hover:text-white"
          >
            <WalletCards className="h-4 w-4" />
            Quick Pay
          </Button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/10 bg-[#0b0b10] p-6 shadow-2xl shadow-black/50">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-200">
                  <CalendarCheck className="h-5 w-5" />
                </span>
                <div>
                  <Dialog.Title className="text-lg font-semibold text-white">Quick Pay</Dialog.Title>
                  <Dialog.Description className="mt-2 text-sm leading-6 text-zinc-400">
                    Record a basic renewal for {itemName}. Price, billing period, and next due date advance normally.
                  </Dialog.Description>
                </div>
              </div>
              <Dialog.Close asChild>
                <button type="button" className="rounded-xl p-2 text-zinc-500 transition hover:bg-white/10 hover:text-white" aria-label="Close quick pay dialog">
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Invoice payment date</p>
              <div className="mt-3">
                <DatePickerInput name="paymentDate" value={paymentDate} onChange={setPaymentDate} />
              </div>
              <p className="mt-3 text-xs text-zinc-500">Invoice amount: {amountLabel}. Use full invoice flow if price, vendor, or billing period changed.</p>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Dialog.Close asChild>
                <Button type="button" variant="secondary" disabled={isPending}>Cancel</Button>
              </Dialog.Close>
              <Button
                type="button"
                variant="secondary"
                onClick={quickPay}
                disabled={isPending || !paymentDate}
                className="border border-emerald-400/20 bg-emerald-500/[0.12] text-emerald-100 hover:border-emerald-300/35 hover:bg-emerald-500/[0.2] hover:text-white"
              >
                {isPending ? "Recording..." : "Record Quick Pay"}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
