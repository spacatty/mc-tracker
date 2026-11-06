"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { FolderPlus, Loader2, Plus } from "lucide-react";
import { createFolderAction } from "@/app/actions";
import { tx } from "@/components/capture/shared";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { EmojiPickerInput } from "./emoji-picker-input";
import { CurrentWorkspaceInput } from "./current-workspace-input";
import { Button } from "./ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Field } from "./ui/field";
import { Input } from "./ui/input";
import { Kbd } from "./ui/kbd";

/**
 * Submit button for dialog forms bound to a server action: spins while pending and calls `onSubmitted`
 * once the action settles (server actions here redirect, which would otherwise leave the dialog open).
 */
export function DialogSubmitButton({
  children,
  onSubmitted,
  variant,
}: {
  children: ReactNode;
  onSubmitted?: () => void;
  variant?: "default" | "destructive";
}) {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);
  useEffect(() => {
    if (pending) {
      wasPending.current = true;
    } else if (wasPending.current) {
      wasPending.current = false;
      onSubmitted?.();
    }
  }, [pending, onSubmitted]);
  return (
    <Button type="submit" size="sm" variant={variant} disabled={pending}>
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
      {children}
    </Button>
  );
}

export function CreateWorkspaceDialog({
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
          <Button size="sm">
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {t(locale, "createWorkspace")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent size="md" closeLabel={tx(locale, "Close create workspace dialog", "Закрыть окно создания пространства")}>
        <DialogHeader icon={<FolderPlus />}>
          <DialogTitle>{t(locale, "createWorkspace")}</DialogTitle>
          <DialogDescription>
            {tx(
              locale,
              "Each workspace has its own categories, entries, notifications and stats.",
              "У каждого пространства свои категории, записи, уведомления и статистика.",
            )}
          </DialogDescription>
        </DialogHeader>
        <form action={createFolderAction} className="flex min-h-0 flex-1 flex-col">
          <CurrentWorkspaceInput />
          <DialogBody>
            <div className="grid gap-4 grid-cols-[5.5rem_minmax(0,1fr)]">
              <Field label={tx(locale, "Icon", "Иконка")}>
                <EmojiPickerInput name="emoji" defaultValue="📦" ariaLabel={tx(locale, "Workspace icon", "Иконка пространства")} />
              </Field>
              <Field label={t(locale, "name")} htmlFor="create-workspace-name" required>
                <Input
                  id="create-workspace-name"
                  name="name"
                  placeholder={tx(locale, "e.g. Team servers", "например, «Серверы команды»")}
                  required
                  autoFocus
                />
              </Field>
            </div>
          </DialogBody>
          <DialogFooter
            hint={
              <>
                <Kbd>Enter</Kbd> {tx(locale, "to create", "создать")}
              </>
            }
          >
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              {t(locale, "cancel")}
            </Button>
            <DialogSubmitButton onSubmitted={() => setOpen(false)}>{t(locale, "createWorkspace")}</DialogSubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
