import Link from "next/link";
import { Archive, Check, CheckCheck, Inbox, Trash2 } from "lucide-react";
import {
  deleteAllNotificationsAction,
  deleteNotificationAction,
  deleteReadNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Surface } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth";
import { listWebsiteNotificationsForWorkspace, resolveWorkspaceForUser } from "@/lib/db";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import type { WebsiteNotification } from "@/lib/types";

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CleanupForm({
  action,
  workspaceId,
  children,
}: {
  action: (formData: FormData) => Promise<void>;
  workspaceId: number;
  children: React.ReactNode;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      {children}
    </form>
  );
}

function NotificationRow({ notification, workspaceId, locale }: { notification: WebsiteNotification; workspaceId: number; locale: Locale }) {
  const href = notification.itemId ? `/app/items/${notification.itemId}?workspace=${workspaceId}` : null;
  const unread = !notification.readAt;
  const title = <span className={unread ? "font-medium text-zinc-100" : "text-zinc-400"}>{notification.title}</span>;
  return (
    <li className="group flex items-center gap-3 px-5 py-2.5 transition hover:bg-white/[0.02]">
      <span className={unread ? "h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" : "h-1.5 w-1.5 shrink-0 rounded-full bg-white/10"} aria-hidden="true" />
      <div className="min-w-0 flex-1 text-[13px] leading-5">
        <p className="truncate">
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
            <button type="submit" title={t(locale, "resolve")} aria-label={`${t(locale, "resolve")}: ${notification.title}`} className="grid h-7 w-7 place-items-center rounded-md text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-100">
              <Check className="h-3.5 w-3.5" />
            </button>
          </form>
        ) : null}
        <form action={deleteNotificationAction}>
          <input type="hidden" name="id" value={notification.id} />
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <button type="submit" title={t(locale, "remove")} aria-label={`${t(locale, "remove")}: ${notification.title}`} className="grid h-7 w-7 place-items-center rounded-md text-zinc-500 transition hover:bg-red-500/10 hover:text-red-200">
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

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const user = await requireUser();
  const locale = await getLocale();
  const params = await searchParams;
  const workspace = resolveWorkspaceForUser(user.id, Number(params.workspace || 0) || null);
  const notifications = listWebsiteNotificationsForWorkspace(workspace.id, user.id, 100);
  const unreadNotifications = notifications.filter((notification) => !notification.readAt);
  const readNotifications = notifications.filter((notification) => notification.readAt);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title={t(locale, "notifications")}
        description={
          notifications.length
            ? locale === "ru"
              ? `${unreadNotifications.length} требуют действия · ${readNotifications.length} прочитано`
              : `${unreadNotifications.length} need action · ${readNotifications.length} read`
            : undefined
        }
        actions={(
          <>
            <CleanupForm action={markAllNotificationsReadAction} workspaceId={workspace.id}>
              <Button size="sm" variant="secondary" disabled={!unreadNotifications.length}>
                <CheckCheck className="h-3.5 w-3.5" />
                {t(locale, "resolveAll")}
              </Button>
            </CleanupForm>
            <CleanupForm action={deleteReadNotificationsAction} workspaceId={workspace.id}>
              <Button size="sm" variant="ghost" disabled={!readNotifications.length}>
                <Archive className="h-3.5 w-3.5" />
                {t(locale, "cleanRead")}
              </Button>
            </CleanupForm>
            <CleanupForm action={deleteAllNotificationsAction} workspaceId={workspace.id}>
              <Button size="sm" variant="ghost" className="hover:bg-red-500/10 hover:text-red-200" disabled={!notifications.length}>
                <Trash2 className="h-3.5 w-3.5" />
                {t(locale, "clearInbox")}
              </Button>
            </CleanupForm>
          </>
        )}
      />

      {!notifications.length ? (
        <Surface className="flex flex-col items-center px-6 py-12 text-center">
          <Inbox className="h-5 w-5 text-zinc-600" />
          <h2 className="mt-3 text-sm font-medium text-zinc-200">{t(locale, "inboxClean")}</h2>
          <p className="mt-1 max-w-sm text-xs text-zinc-500">{locale === "ru" ? "Website-напоминания появятся здесь, когда у записей будут важные даты." : "Website reminders will land here when tracked entries approach important dates."}</p>
        </Surface>
      ) : (
        <Surface className="overflow-hidden">
          {unreadNotifications.length ? (
            <NotificationGroup title={t(locale, "needsAction")} count={unreadNotifications.length}>
              {unreadNotifications.map((notification) => (
                <NotificationRow key={notification.id} notification={notification} workspaceId={workspace.id} locale={locale} />
              ))}
            </NotificationGroup>
          ) : (
            <p className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-3 text-[13px] text-zinc-400">
              <CheckCheck className="h-4 w-4 text-emerald-300/80" />
              {t(locale, "allCaughtUp")}
            </p>
          )}
          {readNotifications.length ? (
            <NotificationGroup title={t(locale, "readArchive")} count={readNotifications.length}>
              {readNotifications.map((notification) => (
                <NotificationRow key={notification.id} notification={notification} workspaceId={workspace.id} locale={locale} />
              ))}
            </NotificationGroup>
          ) : null}
        </Surface>
      )}
    </div>
  );
}
