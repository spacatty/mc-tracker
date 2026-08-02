"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Archive, CalendarCheck, Edit3, MoreHorizontal, WalletCards, X } from "lucide-react";
import { archiveItemAction, payEntryAction } from "@/app/actions";
import { Button } from "./ui/button";
import { DatePickerInput } from "./ui/date-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

function ActionIcon({ children, tone = "violet" }: { children: React.ReactNode; tone?: "violet" | "sky" | "emerald" }) {
  const toneClass = {
    violet: "bg-violet-500/10 text-violet-200",
    sky: "bg-sky-500/10 text-sky-200",
    emerald: "bg-emerald-500/10 text-emerald-200",
  }[tone];

  return <span className={`grid h-8 w-8 place-items-center rounded-xl ${toneClass}`}>{children}</span>;
}

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

  function archiveItem() {
    const formData = new FormData();
    formData.set("id", String(itemId));
    formData.set("workspaceId", String(workspaceId));
    startTransition(async () => {
      await archiveItemAction(formData);
    });
  }

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="icon" className="h-9 w-9 border border-white/10 bg-white/[0.04] hover:bg-white/[0.1]">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 p-2">
          <DropdownMenuItem asChild className="gap-3 rounded-xl px-3 py-2.5">
            <Link href={`/app/items/${itemId}?workspace=${workspaceId}`}>
              <ActionIcon tone="sky"><Edit3 className="h-4 w-4" /></ActionIcon>
              <span className="font-medium">Quick edit</span>
            </Link>
          </DropdownMenuItem>
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
              <DropdownMenuItem onSelect={(event) => event.preventDefault()} className="gap-3 rounded-xl px-3 py-2.5">
                <ActionIcon tone="emerald"><WalletCards className="h-4 w-4" /></ActionIcon>
                <span className="font-medium">Quick Pay</span>
              </DropdownMenuItem>
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
          <DropdownMenuItem
            className="gap-3 rounded-xl px-3 py-2.5 text-violet-200"
            disabled={isPending}
            onSelect={archiveItem}
          >
            <ActionIcon tone="violet"><Archive className="h-4 w-4" /></ActionIcon>
            <span className="font-medium">Archive</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
