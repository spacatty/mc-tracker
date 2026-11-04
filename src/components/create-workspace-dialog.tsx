"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { createFolderAction } from "@/app/actions";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { EmojiPickerInput } from "./emoji-picker-input";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function CreateWorkspaceDialog({
  trigger,
  locale = "en",
}: {
  trigger?: ReactNode;
  locale?: Locale;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        {trigger || (
          <Button>
            <Plus className="h-4 w-4" />
            {t(locale, "createWorkspace")}
          </Button>
        )}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="capture-overlay-in fixed inset-0 z-50 bg-black/60 backdrop-blur-md" />
        <Dialog.Content className="capture-panel-in fixed inset-x-0 top-[16vh] z-50 mx-auto w-[calc(100vw-1.5rem)] max-w-xl overflow-hidden rounded-xl border border-white/10 bg-[#101013] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.85)]">
          <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-white/[0.015] p-5">
            <div>
              <Dialog.Title className="text-lg font-semibold text-white">{t(locale, "createWorkspace")}</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-zinc-500">
                {locale === "ru"
                  ? "Каждое пространство имеет отдельные категории, записи, уведомления и статистику."
                  : "Each workspace has isolated categories, entries, notifications, and stats."}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="rounded-xl p-2 text-zinc-500 transition hover:bg-white/10 hover:text-white" aria-label={locale === "ru" ? "Закрыть окно создания пространства" : "Close create workspace dialog"}>
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <form action={createFolderAction} className="grid gap-3 p-5 lg:grid-cols-[120px_1fr]">
            <EmojiPickerInput name="emoji" defaultValue="📦" />
            <Input name="name" placeholder={locale === "ru" ? "Название пространства, например Team servers" : "Workspace name, e.g. Team servers"} required />
            <div className="lg:col-span-2 flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button" variant="secondary">{locale === "ru" ? "Отмена" : "Cancel"}</Button>
              </Dialog.Close>
              <Button type="submit">
                {t(locale, "createWorkspace")}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
