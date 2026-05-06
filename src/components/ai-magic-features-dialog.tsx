"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Info, Sparkles, X } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { Button } from "./ui/button";

export function AiMagicFeaturesDialog({ locale = "en" }: { locale?: Locale }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button variant="secondary" className="border border-violet-300/20 bg-violet-500/10 text-violet-100 hover:bg-violet-500/20">
          <Info className="h-4 w-4" />
          {locale === "ru" ? "Возможности" : "Features"}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-white/10 bg-[#090a11] shadow-2xl shadow-black/50">
          <div className="border-b border-white/10 bg-gradient-to-r from-violet-500/15 via-fuchsia-500/10 to-cyan-500/10 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="flex items-center gap-2 text-lg font-semibold text-white">
                  <Sparkles className="h-5 w-5 text-violet-200" />
                  {locale === "ru" ? "Возможности AI Magic" : "AI Magic Features"}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-zinc-400">
                  {locale === "ru" ? "Что AI Magic умеет сейчас." : "What AI Magic can do today."}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button type="button" className="rounded-xl p-2 text-zinc-500 transition hover:bg-white/10 hover:text-white" aria-label={locale === "ru" ? "Закрыть окно возможностей" : "Close features dialog"}>
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>
          </div>

          <div className="grid gap-3 p-5 md:grid-cols-2">
            <section className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <h3 className="text-sm font-semibold text-white">Import messy data</h3>
              <p className="mt-2 text-sm text-zinc-400">{locale === "ru" ? "Преобразует сырой текст в черновые действия create/edit/pay." : "Turns raw text into draft create/edit/pay actions for review."}</p>
              <p className="mt-3 rounded-xl bg-black/40 p-3 font-mono text-xs text-zinc-400">
                njal.la account scarlett domain myprofile.com bought now for 25 usd
              </p>
            </section>
            <section className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <h3 className="text-sm font-semibold text-white">{locale === "ru" ? "Обновления оплат" : "Payment updates"}</h3>
              <p className="mt-2 text-sm text-zinc-400">{locale === "ru" ? "Распознает оплату/продление и подготавливает обновления в стиле счетов." : "Detects renewal/payment intent and prepares invoice-style updates."}</p>
              <p className="mt-3 rounded-xl bg-black/40 p-3 font-mono text-xs text-zinc-400">
                i paid server 127.0.0.1 for 1 month at 29.04.2026
              </p>
            </section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
