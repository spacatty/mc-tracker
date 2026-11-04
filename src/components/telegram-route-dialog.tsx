"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";
import { saveTelegramChannelAction } from "@/app/actions";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import type { NotificationChannel } from "@/lib/types";
import { Button } from "./ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Input } from "./ui/input";

function FieldLabel({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={wide ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
      <span className="block text-[11px] font-medium text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

/** Create or edit one Telegram route in a modal; the same form serves both. */
export function TelegramRouteDialog({
  workspaceId,
  channel,
  locale,
  triggerVariant = "default",
  triggerClassName,
}: {
  workspaceId: number;
  channel?: NotificationChannel;
  locale: Locale;
  triggerVariant?: "default" | "secondary" | "ghost";
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const editing = Boolean(channel);

  function submit(formData: FormData) {
    startTransition(async () => {
      await saveTelegramChannelAction(formData);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* The trigger is built here, not passed in: a server-rendered element inside Radix Slot breaks hydration. */}
      <DialogTrigger asChild>
        <Button size="sm" variant={triggerVariant} className={triggerClassName}>
          {editing ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {editing ? (locale === "ru" ? "Изменить" : "Edit") : t(locale, "addRoute")}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={locale === "ru" ? "Закрыть" : "Close"}>
        <form action={submit} className="flex min-h-0 flex-1 flex-col">
          {channel ? <input type="hidden" name="id" value={channel.id} /> : null}
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <DialogHeader>
            <DialogTitle>{editing ? channel?.title || t(locale, "telegram") : t(locale, "addTelegramRouteInstance")}</DialogTitle>
            <DialogDescription>
              {locale === "ru"
                ? "Один маршрут на топик супергруппы."
                : "One route per supergroup topic, e.g. one for Servers and another for Domains."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-3 sm:grid-cols-2">
            <FieldLabel label={t(locale, "routeTitle")} wide>
              <Input name="title" defaultValue={channel?.title} placeholder={locale === "ru" ? "например Domains topic" : "e.g. Domains topic"} autoFocus />
            </FieldLabel>
            <FieldLabel label={t(locale, "chatId")}>
              <Input name="chatId" defaultValue={channel?.chatId} placeholder="-100…" />
            </FieldLabel>
            <FieldLabel label={t(locale, "topicIdOptional")}>
              <Input name="topicId" defaultValue={channel?.topicId} placeholder={t(locale, "topicId")} />
            </FieldLabel>
            <FieldLabel label={t(locale, "botToken")} wide>
              <Input name="botToken" defaultValue={channel?.botToken} placeholder="123456:ABC…" className="font-mono text-xs" />
            </FieldLabel>
            <FieldLabel label={locale === "ru" ? "HTTP proxy (опционально)" : "HTTP proxy (optional)"} wide>
              <Input name="proxyUrl" defaultValue={channel?.proxyUrl} placeholder="http://user:pass@host:port" className="font-mono text-xs" />
            </FieldLabel>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{locale === "ru" ? "Отмена" : "Cancel"}</Button>
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
