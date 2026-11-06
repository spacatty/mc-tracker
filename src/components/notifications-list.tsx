"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Check, CheckCheck, ExternalLink, Inbox, SearchX, Trash2 } from "lucide-react";
import { deleteAllNotificationsAction, deleteNotificationAction, markNotificationReadAction } from "@/app/actions";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { notificationTitleWithHost, titleWithHost } from "@/lib/item-host";
import type { WebsiteNotification } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { ConfirmDialog } from "./ui/dialog";
import { EmptyState } from "./ui/empty-state";
import { SearchInput } from "./ui/input";
import { RowAction, RowActionMenu, RowActions } from "./ui/row-actions";
import { SectionCard } from "./ui/section-card";
import { SegmentedControl } from "./ui/segmented";
import { TableToolbar } from "./ui/table";

type InboxFilter = "all" | "unread" | "read";

function tx(locale: Locale, en: string, ru: string) {
  return locale === "ru" ? ru : en;
}

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

function entryHref(notification: WebsiteNotification, workspaceId: number) {
  return notification.itemId ? `/app/items?workspace=${workspaceId}&entry=${notification.itemId}` : null;
}

function actionForm(id: number, workspaceId: number) {
  const formData = new FormData();
  formData.set("id", String(id));
  formData.set("workspaceId", String(workspaceId));
  return formData;
}

/** The title with the entry name emphasised and its IP/domain muted; falls back to the plain stored title. */
function TitleText({ notification, unread }: { notification: WebsiteNotification; unread: boolean }) {
  const name = notification.itemName || "";
  const host = (notification.itemHost || "").trim();
  const nameClass = unread ? "font-medium text-zinc-100" : "font-medium text-zinc-300";
  const restClass = unread ? "text-zinc-300" : "text-zinc-400";
  const index = name ? notification.title.indexOf(name) : -1;
  if (index === -1) return <span className={restClass}>{displayTitle(notification)}</span>;
  const showHost = host && titleWithHost(name, host) !== name && !notification.title.toLowerCase().includes(host.toLowerCase());
  return (
    <>
      {index > 0 ? <span className={restClass}>{notification.title.slice(0, index)}</span> : null}
      <span className={nameClass}>{name}</span>
      {showHost ? <span className="font-mono text-[12px] text-zinc-500"> {host}</span> : null}
      <span className={restClass}>{notification.title.slice(index + name.length)}</span>
    </>
  );
}

function NotificationRow({
  notification,
  workspaceId,
  locale,
  busy,
  onResolve,
  onRemove,
}: {
  notification: WebsiteNotification;
  workspaceId: number;
  locale: Locale;
  busy: boolean;
  onResolve: () => void;
  onRemove: () => void;
}) {
  const router = useRouter();
  const href = entryHref(notification, workspaceId);
  const unread = !notification.readAt;
  const fullTitle = displayTitle(notification);
  return (
    <li
      className={cn(
        "group relative flex items-center gap-3 px-4 py-2.5 transition hover:bg-white/[0.03]",
        href && "cursor-pointer",
        busy && "pointer-events-none opacity-50",
      )}
      onClick={href ? () => router.push(href) : undefined}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", unread ? "bg-violet-400" : "bg-white/10")} aria-hidden="true" />
      {unread ? <span className="sr-only">{t(locale, "needsAction")}:</span> : null}
      <div className="min-w-0 flex-1 text-[13px] leading-5">
        <p className="truncate">
          {href ? (
            <Link
              href={href}
              onClick={(event) => event.stopPropagation()}
              className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
              aria-label={fullTitle}
            >
              <TitleText notification={notification} unread={unread} />
            </Link>
          ) : (
            <TitleText notification={notification} unread={unread} />
          )}
        </p>
        {notification.body ? <p className="truncate text-[11.5px] leading-[1.125rem] text-zinc-500">{notification.body}</p> : null}
      </div>
      <time dateTime={notification.createdAt} className="hidden shrink-0 text-[11.5px] tabular-nums text-zinc-500 sm:block">
        {formatTimestamp(notification.createdAt)}
      </time>
      <RowActions className="w-[60px] shrink-0">
        {unread ? (
          <RowAction label={`${t(locale, "resolve")}: ${fullTitle}`} icon={<Check />} hidden="hover" onClick={onResolve} />
        ) : null}
        <RowActionMenu
          label={tx(locale, `More actions for ${fullTitle}`, `Другие действия: ${fullTitle}`)}
          items={[
            href ? { label: tx(locale, "Open entry", "Открыть запись"), icon: <ExternalLink />, href } : null,
            unread ? { label: t(locale, "resolve"), icon: <Check />, onSelect: onResolve } : null,
            "separator",
            { label: t(locale, "remove"), icon: <Trash2 />, destructive: true, onSelect: onRemove },
          ]}
        />
      </RowActions>
    </li>
  );
}

function NotificationGroup({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="[&+section]:border-t [&+section]:border-white/[0.06]">
      <h2 className="flex h-9 items-center gap-2 border-b border-white/[0.06] bg-white/[0.015] px-4 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
        {title}
        <span className="tabular-nums text-zinc-600">{count}</span>
      </h2>
      <ul className="divide-y divide-white/[0.05]">{children}</ul>
    </section>
  );
}

export function NotificationsList({ notifications, workspaceId, locale, actions }: { notifications: WebsiteNotification[]; workspaceId: number; locale: Locale; actions?: React.ReactNode }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [, startTransition] = useTransition();
  const needle = query.trim().toLowerCase();

  const matching = useMemo(() => {
    if (!needle) return notifications;
    return notifications.filter((notification) =>
      [displayTitle(notification), notification.body, notification.itemName, notification.itemHost]
        .some((value) => String(value || "").toLowerCase().includes(needle)),
    );
  }, [needle, notifications]);
  const unread = matching.filter((notification) => !notification.readAt);
  const read = matching.filter((notification) => notification.readAt);
  const anyUnread = notifications.some((notification) => !notification.readAt);
  const showUnread = filter !== "read";
  const showRead = filter !== "unread";
  const nothingShown = (!showUnread || !unread.length) && (!showRead || !read.length);

  function run(id: number, action: (formData: FormData) => Promise<void>) {
    setBusyIds((current) => new Set(current).add(id));
    startTransition(async () => {
      try {
        await action(actionForm(id, workspaceId));
      } finally {
        setBusyIds((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      }
    });
  }

  const renderRows = (list: WebsiteNotification[]) =>
    list.map((notification) => (
      <NotificationRow
        key={notification.id}
        notification={notification}
        workspaceId={workspaceId}
        locale={locale}
        busy={busyIds.has(notification.id)}
        onResolve={() => run(notification.id, markNotificationReadAction)}
        onRemove={() => run(notification.id, deleteNotificationAction)}
      />
    ));

  return (
    <SectionCard flush className="flex min-h-[24rem] flex-1 flex-col" bodyClassName="flex min-h-0 flex-1 flex-col">
      <TableToolbar
        end={
          <>
            {needle ? <span className="text-xs tabular-nums text-zinc-500">{matching.length} / {notifications.length}</span> : null}
            {actions}
          </>
        }
      >
        <SearchInput
          size="sm"
          value={query}
          onChange={setQuery}
          placeholder={tx(locale, "Search name, IP, domain…", "Поиск по названию, IP, домену…")}
          aria-label={tx(locale, "Search notifications", "Поиск по уведомлениям")}
          clearLabel={tx(locale, "Clear search", "Очистить поиск")}
          className="max-w-sm flex-1 basis-56"
        />
        <SegmentedControl<InboxFilter>
          ariaLabel={tx(locale, "Show", "Показать")}
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: tx(locale, "All", "Все"), count: matching.length },
            { value: "unread", label: t(locale, "needsAction"), count: unread.length },
            { value: "read", label: tx(locale, "Read", "Прочитанные"), count: read.length },
          ]}
        />
      </TableToolbar>
      <div className="min-h-0 flex-1 overflow-y-auto">

      {showUnread && !needle && !anyUnread ? (
        <p className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2.5 text-[13px] text-zinc-400">
          <CheckCheck className="h-4 w-4 text-emerald-300" aria-hidden="true" />
          {t(locale, "allCaughtUp")}
        </p>
      ) : null}

      {showUnread && unread.length ? (
        <NotificationGroup title={t(locale, "needsAction")} count={unread.length}>
          {renderRows(unread)}
        </NotificationGroup>
      ) : null}
      {showRead && read.length ? (
        <NotificationGroup title={t(locale, "readArchive")} count={read.length}>
          {renderRows(read)}
        </NotificationGroup>
      ) : null}

      {nothingShown && (needle || filter === "read" || anyUnread) ? (
        <EmptyState
          compact
          icon={needle ? <SearchX /> : <Inbox />}
          title={needle ? tx(locale, "Nothing matches this search", "Ничего не найдено") : tx(locale, "Nothing here", "Здесь пусто")}
          description={needle ? tx(locale, "Try a name, an IP address or a domain.", "Попробуйте название, IP-адрес или домен.") : undefined}
          action={
            needle || filter !== "all" ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
              >
                {tx(locale, "Show all", "Показать все")}
              </Button>
            ) : null
          }
        />
      ) : null}
      </div>
    </SectionCard>
  );
}

/** "Clear inbox" with a confirmation; posts the same form payload as before (workspaceId). */
export function ClearInboxButton({ workspaceId, count, locale }: { workspaceId: number; count: number; locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("workspaceId", String(workspaceId));
      await deleteAllNotificationsAction(formData);
      setOpen(false);
    });
  }

  return (
    <>
      <Button type="button" size="sm" variant="ghost" className="hover:bg-red-500/10 hover:text-red-200" disabled={!count} onClick={() => setOpen(true)}>
        <Trash2 className="h-3.5 w-3.5" />
        {t(locale, "clearInbox")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        destructive
        pending={pending}
        title={tx(locale, "Clear the inbox?", "Очистить входящие?")}
        description={tx(
          locale,
          `All ${count} notification${count === 1 ? "" : "s"} in this workspace will be removed. This cannot be undone.`,
          `Все уведомления этого пространства (${count}) будут удалены. Это действие нельзя отменить.`,
        )}
        confirmLabel={t(locale, "clearInbox")}
        cancelLabel={tx(locale, "Cancel", "Отмена")}
        closeLabel={tx(locale, "Close", "Закрыть")}
        onConfirm={confirm}
      />
    </>
  );
}
