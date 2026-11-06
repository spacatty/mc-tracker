"use client";

import { useId, useState, useTransition } from "react";
import { Loader2, Pencil, Plus, Send, Trash2, Zap } from "lucide-react";
import { deleteNotificationChannelAction, saveTelegramChannelAction, sendTelegramTestAction } from "@/app/actions";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import type { NotificationChannel } from "@/lib/types";
import { Button } from "./ui/button";
import { ConfirmDialog, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Field } from "./ui/field";
import { Input } from "./ui/input";
import { Kbd } from "./ui/kbd";
import { RowAction, RowActions } from "./ui/row-actions";

function tx(locale: Locale, en: string, ru: string) {
  return locale === "ru" ? ru : en;
}

/**
 * Create or edit one Telegram route in a modal; the same form serves both.
 * Uncontrolled by default (renders its own trigger button); pass `open` + `onOpenChange` and `hideTrigger`
 * to open it from elsewhere (e.g. a row action).
 */
export function TelegramRouteDialog({
  workspaceId,
  channel,
  locale,
  triggerVariant = "default",
  triggerClassName,
  open: openProp,
  onOpenChange,
  hideTrigger,
}: {
  workspaceId: number;
  channel?: NotificationChannel;
  locale: Locale;
  triggerVariant?: "default" | "secondary" | "ghost";
  triggerClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (next: boolean) => {
    setOpenState(next);
    onOpenChange?.(next);
  };
  const [pending, startTransition] = useTransition();
  const editing = Boolean(channel);
  const idPrefix = useId();
  const id = (name: string) => `${idPrefix}-${name}`;

  function submit(formData: FormData) {
    startTransition(async () => {
      await saveTelegramChannelAction(formData);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* The trigger is built here, not passed in: a server-rendered element inside Radix Slot breaks hydration. */}
      {hideTrigger ? null : (
        <DialogTrigger asChild>
          <Button size="sm" variant={triggerVariant} className={triggerClassName}>
            {editing ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {editing ? tx(locale, "Edit", "Изменить") : t(locale, "addRoute")}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent closeLabel={tx(locale, "Close", "Закрыть")}>
        <form action={submit} className="flex min-h-0 flex-1 flex-col">
          {channel ? <input type="hidden" name="id" value={channel.id} /> : null}
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <DialogHeader icon={<Send />} tone="info">
            <DialogTitle>{editing ? channel?.title || t(locale, "telegram") : t(locale, "addTelegramRouteInstance")}</DialogTitle>
            <DialogDescription>
              {tx(
                locale,
                "One route per supergroup topic, e.g. one for Servers and another for Domains.",
                "Один маршрут на тему супергруппы — например, отдельно для серверов и для доменов.",
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            <Field label={t(locale, "routeTitle")} htmlFor={id("title")} className="sm:col-span-2">
              <Input id={id("title")} name="title" defaultValue={channel?.title} placeholder={tx(locale, "e.g. Domains topic", "например, тема «Домены»")} autoFocus />
            </Field>
            <Field label={t(locale, "chatId")} htmlFor={id("chat")}>
              <Input id={id("chat")} name="chatId" defaultValue={channel?.chatId} placeholder="-100…" className="font-mono text-[13px]" />
            </Field>
            <Field label={t(locale, "topicIdOptional")} htmlFor={id("topic")}>
              <Input id={id("topic")} name="topicId" defaultValue={channel?.topicId} placeholder={t(locale, "topicId")} className="font-mono text-[13px]" />
            </Field>
            <Field label={t(locale, "botToken")} htmlFor={id("token")} className="sm:col-span-2">
              <Input id={id("token")} name="botToken" defaultValue={channel?.botToken} placeholder="123456:ABC…" className="font-mono text-[13px]" />
            </Field>
            <Field
              label={tx(locale, "HTTP proxy (optional)", "HTTP-прокси (необязательно)")}
              htmlFor={id("proxy")}
              hint={tx(locale, "Only if Telegram is blocked on this server.", "Только если Telegram заблокирован на этом сервере.")}
              className="sm:col-span-2"
            >
              <Input id={id("proxy")} name="proxyUrl" defaultValue={channel?.proxyUrl} placeholder="http://user:pass@host:port" className="font-mono text-[13px]" />
            </Field>
          </DialogBody>
          <DialogFooter hint={<><Kbd>Esc</Kbd>{tx(locale, "to close", "закрыть")}</>}>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{tx(locale, "Cancel", "Отмена")}</Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editing ? t(locale, "saveChanges") : t(locale, "addRoute")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Footer of a route card: Test (ghost) left; Edit + Delete (confirmed) as row actions on the right. */
export function TelegramRouteCardActions({
  workspaceId,
  channel,
  locale,
  canEdit,
}: {
  workspaceId: number;
  channel: NotificationChannel;
  locale: Locale;
  canEdit: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [testing, startTest] = useTransition();
  const [deleting, startDelete] = useTransition();
  const name = channel.title || t(locale, "telegram");

  function payload() {
    const formData = new FormData();
    formData.set("id", String(channel.id));
    formData.set("workspaceId", String(workspaceId));
    return formData;
  }

  return (
    <div className="flex items-center gap-1 border-t border-white/[0.06] px-2 py-1.5">
      <Button type="button" variant="ghost" size="xs" disabled={testing} onClick={() => startTest(async () => { await sendTelegramTestAction(payload()); })}>
        {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
        {tx(locale, "Send test", "Отправить тестовое")}
      </Button>
      {canEdit ? (
        <>
          <RowActions className="ml-auto">
            <RowAction label={tx(locale, `Edit ${name}`, `Изменить «${name}»`)} icon={<Pencil />} onClick={() => setEditOpen(true)} />
            <RowAction label={`${t(locale, "delete")}: ${name}`} icon={<Trash2 />} tone="danger" onClick={() => setConfirmOpen(true)} />
          </RowActions>
          <TelegramRouteDialog workspaceId={workspaceId} channel={channel} locale={locale} open={editOpen} onOpenChange={setEditOpen} hideTrigger />
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            destructive
            pending={deleting}
            title={tx(locale, `Delete route “${name}”?`, `Удалить маршрут «${name}»?`)}
            description={tx(
              locale,
              "Categories that send reminders here will stop using it. This cannot be undone.",
              "Категории, которые отправляют сюда напоминания, перестанут его использовать. Это действие нельзя отменить.",
            )}
            confirmLabel={t(locale, "delete")}
            cancelLabel={tx(locale, "Cancel", "Отмена")}
            closeLabel={tx(locale, "Close", "Закрыть")}
            onConfirm={() =>
              startDelete(async () => {
                await deleteNotificationChannelAction(payload());
                setConfirmOpen(false);
              })
            }
          />
        </>
      ) : null}
    </div>
  );
}
