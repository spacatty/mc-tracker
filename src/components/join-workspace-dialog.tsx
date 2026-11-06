"use client";

import { useState, type ReactNode } from "react";
import { UserPlus } from "lucide-react";
import { acceptInviteAction } from "@/app/actions";
import { tx } from "@/components/capture/shared";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { DialogSubmitButton } from "./create-workspace-dialog";
import { CurrentWorkspaceInput } from "./current-workspace-input";
import { Button } from "./ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Field } from "./ui/field";
import { Input } from "./ui/input";
import { Kbd } from "./ui/kbd";

export function JoinWorkspaceDialog({
  trigger,
  locale = "en",
}: {
  /** Custom trigger. Only pass one from a client component (a server-rendered element here causes a hydration mismatch). */
  trigger?: ReactNode;
  locale?: Locale;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="secondary" size="sm">
            <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
            {t(locale, "joinWorkspace")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent size="md" closeLabel={tx(locale, "Close join workspace dialog", "Закрыть окно присоединения к пространству")}>
        <DialogHeader icon={<UserPlus />} tone="info">
          <DialogTitle>{t(locale, "joinWorkspace")}</DialogTitle>
          <DialogDescription>
            {tx(
              locale,
              "Paste an invite link or token to join a shared workspace.",
              "Вставьте ссылку-приглашение или токен, чтобы присоединиться к общему пространству.",
            )}
          </DialogDescription>
        </DialogHeader>
        <form action={acceptInviteAction} className="flex min-h-0 flex-1 flex-col">
          <CurrentWorkspaceInput />
          <DialogBody>
            <Field
              label={tx(locale, "Invite link or token", "Ссылка или токен приглашения")}
              htmlFor="join-workspace-token"
              hint={tx(locale, "Both the full link and the bare token work.", "Подойдёт и полная ссылка, и сам токен.")}
              required
            >
              <Input
                id="join-workspace-token"
                name="token"
                placeholder={tx(locale, "https://…/invite/abc123 or abc123", "https://…/invite/abc123 или abc123")}
                aria-describedby="join-workspace-token-hint"
                className="font-mono text-[13px]"
                required
                autoFocus
              />
            </Field>
          </DialogBody>
          <DialogFooter
            hint={
              <>
                <Kbd>Enter</Kbd> {tx(locale, "to join", "присоединиться")}
              </>
            }
          >
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              {t(locale, "cancel")}
            </Button>
            <DialogSubmitButton onSubmitted={() => setOpen(false)}>{t(locale, "joinWorkspace")}</DialogSubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
