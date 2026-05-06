"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { useState } from "react";
import { deleteWorkspaceAction } from "@/app/actions";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { Button } from "./ui/button";

export function DeleteWorkspaceAlert({
  workspaceId,
  workspaceName,
  locale = "en",
}: {
  workspaceId: number;
  workspaceName: string;
  locale?: Locale;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button
          type="button"
          size="sm"
          className="border border-red-300/30 bg-red-500/15 text-red-100 hover:bg-red-500/25"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t(locale, "deleteWorkspace")}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/10 bg-[#0b0b10] p-6 shadow-2xl shadow-black/50">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-red-500/10 text-red-200">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <Dialog.Title className="text-lg font-semibold text-white">{t(locale, "deleteWorkspaceConfirm")}</Dialog.Title>
                <Dialog.Description className="mt-2 text-sm leading-6 text-zinc-400">
                  {locale === "ru"
                    ? <>Это действие навсегда удалит <span className="font-semibold text-zinc-200">{workspaceName}</span> и его данные. Отменить нельзя.</>
                    : <>This will permanently remove <span className="font-semibold text-zinc-200">{workspaceName}</span> and its data. This action cannot be undone.</>}
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="rounded-xl p-2 text-zinc-500 transition hover:bg-white/10 hover:text-white" aria-label={locale === "ru" ? "Закрыть окно удаления пространства" : "Close delete workspace dialog"}>
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <form action={deleteWorkspaceAction} className="mt-6 flex justify-end gap-3">
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <Dialog.Close asChild>
              <Button type="button" variant="secondary">{locale === "ru" ? "Отмена" : "Cancel"}</Button>
            </Dialog.Close>
            <Button type="submit" variant="destructive">
              {t(locale, "deleteWorkspace")}
            </Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

