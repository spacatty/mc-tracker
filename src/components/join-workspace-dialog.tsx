"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { Link2, UserPlus, X } from "lucide-react";
import { acceptInviteAction } from "@/app/actions";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function JoinWorkspaceDialog({
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
          <Button variant="secondary">
            <UserPlus className="h-4 w-4" />
            {t(locale, "joinWorkspace")}
          </Button>
        )}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="capture-overlay-in fixed inset-0 z-50 bg-black/60 backdrop-blur-md" />
        <Dialog.Content className="capture-panel-in fixed inset-x-0 top-[16vh] z-50 mx-auto w-[calc(100vw-1.5rem)] max-w-xl rounded-xl border border-white/10 bg-[#101013] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.85)]">
          <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-white/[0.015] p-5">
            <div>
              <Dialog.Title className="text-lg font-semibold text-white">{t(locale, "joinWorkspace")}</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-zinc-500">
                {locale === "ru"
                  ? "Вставьте полную ссылку-приглашение или токен, чтобы войти в общее пространство."
                  : "Paste a full invite link or token to join a shared workspace."}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="rounded-xl p-2 text-zinc-500 transition hover:bg-white/10 hover:text-white" aria-label={locale === "ru" ? "Закрыть окно входа в пространство" : "Close join workspace dialog"}>
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <form action={acceptInviteAction} className="space-y-4 p-5">
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">{locale === "ru" ? "Ссылка или токен приглашения" : "Invite link or token"}</label>
              <Input name="token" placeholder={locale === "ru" ? "https://.../invite/abc123 или abc123" : "https://.../invite/abc123 or abc123"} className="mt-2" required />
              <p className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                <Link2 className="h-3.5 w-3.5" />
                {locale === "ru" ? "Принимаются и полная ссылка, и токен." : "Full link and plain token are both accepted."}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button" variant="secondary">{locale === "ru" ? "Отмена" : "Cancel"}</Button>
              </Dialog.Close>
              <Button type="submit">
                {t(locale, "joinWorkspace")}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
