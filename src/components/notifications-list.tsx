"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, CheckCheck, Search, Trash2 } from "lucide-react";
import { deleteNotificationAction, markNotificationReadAction } from "@/app/actions";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { notificationTitleWithHost } from "@/lib/item-host";
import type { WebsiteNotification } from "@/lib/types";
import { Input } from "./ui/input";

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Stored title with the entry's IP or domain after its name, e.g. "Sample (127.0.0.1) payment is due today". */
function displayTitle(notification: WebsiteNotification) {
  return notificationTitleWithHost(notification.title, notification.itemName, notification.itemHost);
}

function NotificationRow({ notification, workspaceId, locale }: { notification: WebsiteNotification; workspaceId: number; locale: Locale }) {
  const href = notification.itemId ? `/app/items/${notification.itemId}?workspace=${workspaceId}` : null;
  const unread = !notification.readAt;
  const fullTitle = displayTitle(notification);
  const title = <span className={unread ? "font-medium text-zinc-100" : "text-zinc-400"}>{fullTitle}</span>;
  return (
    <li className="group flex items-center gap-3 px-5 py-2.5 transition hover:bg-white/[0.02]">
      <span className={unread ? "h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" : "h-1.5 w-1.5 shrink-0 rounded-full bg-white/10"} aria-hidden="true" />
      <div className="min-w-0 flex-1 text-[13px] leading-5">
        <p className="truncate" title={fullTitle}>
          {href ? <Link href={href} className="hover:underline hover:decoration-white/30 hover:underline-offset-4">{title}</Link> : title}
          {notification.body ? <span className="text-zinc-500"> · {notification.body}</span> : null}
        </p>
      </div>
      <time dateTime={notification.createdAt} className="shrink-0 text-[11px] tabular-nums text-zinc-600">{formatTimestamp(notification.createdAt)}</time>
      <div className="flex w-[58px] shrink-0 items-center justify-end gap-0.5 opacity-100 transition md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
        {unread ? (
          <form action={markNotificationReadAction}>
            <input type="hidden" name="id" value={notification.id} />
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <button type="submit" title={t(locale, "resolve")} aria-label={`${t(locale, "resolve")}: ${fullTitle}`} className="grid h-7 w-7 place-items-center rounded-md text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-100">
              <Check className="h-3.5 w-3.5" />
            </button>
          </form>
        ) : null}
        <form action={deleteNotificationAction}>
          <input type="hidden" name="id" value={notification.id} />
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <button type="submit" title={t(locale, "remove")} aria-label={`${t(locale, "remove")}: ${fullTitle}`} className="grid h-7 w-7 place-items-center rounded-md text-zinc-500 transition hover:bg-red-500/10 hover:text-red-200">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    </li>
  );
}

function NotificationGroup({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="flex items-center gap-2 border-b border-white/[0.06] bg-white/[0.015] px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        {title}
        <span className="tabular-nums text-zinc-600">{count}</span>
      </h2>
      <ul className="divide-y divide-white/[0.04]">{children}</ul>
    </section>
  );
}

export function NotificationsList({ notifications, workspaceId, locale }: { notifications: WebsiteNotification[]; workspaceId: number; locale: Locale }) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!needle) return notifications;
    return notifications.filter((notification) =>
      [displayTitle(notification), notification.body, notification.itemName, notification.itemHost]
        .some((value) => String(value || "").toLowerCase().includes(needle)),
    );
  }, [needle, notifications]);
  const unread = visible.filter((notification) => !notification.readAt);
  const read = visible.filter((notification) => notification.readAt);
  const allUnread = notifications.some((notification) => !notification.readAt);

  return (
    <>
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-2.5">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={locale === "ru" ? "Поиск по названию, IP, домену…" : "Search name, IP, domain…"}
            aria-label={locale === "ru" ? "Поиск по уведомлениям" : "Search notifications"}
            className="h-8 pl-8 text-[13px]"
          />
        </div>
        {needle ? <span className="text-xs text-zinc-500">{visible.length} / {notifications.length}</span> : null}
      </div>
      {needle && !visible.length ? (
        <p className="px-5 py-8 text-center text-[13px] text-zinc-500">{locale === "ru" ? "Ничего не найдено." : "Nothing matches this search."}</p>
      ) : null}
      {unread.length ? (
        <NotificationGroup title={t(locale, "needsAction")} count={unread.length}>
          {unread.map((notification) => (
            <NotificationRow key={notification.id} notification={notification} workspaceId={workspaceId} locale={locale} />
          ))}
        </NotificationGroup>
      ) : !allUnread ? (
        <p className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-3 text-[13px] text-zinc-400">
          <CheckCheck className="h-4 w-4 text-emerald-300/80" />
          {t(locale, "allCaughtUp")}
        </p>
      ) : null}
      {read.length ? (
        <NotificationGroup title={t(locale, "readArchive")} count={read.length}>
          {read.map((notification) => (
            <NotificationRow key={notification.id} notification={notification} workspaceId={workspaceId} locale={locale} />
          ))}
        </NotificationGroup>
      ) : null}
    </>
  );
}
