import Link from "next/link";
import { Archive, Bell, CheckCheck, Clock3, Inbox, Sparkles, Trash2 } from "lucide-react";
import {
  deleteAllNotificationsAction,
  deleteNotificationAction,
  deleteReadNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

function NotificationActions({ notification, workspaceId, locale }: { notification: WebsiteNotification; workspaceId: number; locale: Locale }) {
  return (
    <div className="flex flex-wrap gap-2">
      {!notification.readAt ? (
        <form action={markNotificationReadAction}>
          <input type="hidden" name="id" value={notification.id} />
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <Button size="sm" variant="secondary" className="h-7 rounded-full px-3">
            <CheckCheck className="h-3.5 w-3.5" />
            {t(locale, "resolve")}
          </Button>
        </form>
      ) : null}
      <form action={deleteNotificationAction}>
        <input type="hidden" name="id" value={notification.id} />
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <Button size="sm" variant="ghost" className="h-7 rounded-full px-3 text-zinc-500 hover:text-red-100">
          <Trash2 className="h-3.5 w-3.5" />
          {t(locale, "remove")}
        </Button>
      </form>
    </div>
  );
}

function NotificationCard({
  notification,
  workspaceId,
  locale,
  featured = false,
}: {
  notification: WebsiteNotification;
  workspaceId: number;
  locale: Locale;
  featured?: boolean;
}) {
  const href = notification.itemId ? `/app/items/${notification.itemId}?workspace=${workspaceId}` : null;
  const title = (
    <h3 className={featured ? "text-xl font-semibold leading-tight text-white" : "line-clamp-2 text-sm font-semibold leading-snug text-white"}>
      {notification.title}
    </h3>
  );

  return (
    <article
      className={
        featured
          ? "relative overflow-hidden rounded-3xl border border-violet-300/20 bg-violet-500/[0.09] p-5 shadow-2xl shadow-violet-950/20"
          : "group rounded-2xl border border-white/10 bg-[#0d0d13]/85 p-4 transition hover:border-white/20 hover:bg-white/[0.055]"
      }
    >
      {featured ? <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(167,139,250,0.2),transparent_45%)]" /> : null}
      <div className="relative space-y-4">
        <div className="flex items-start justify-between gap-3">
          <span className={featured ? "grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-400/20 text-violet-100" : "grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-violet-200"}>
            {notification.readAt ? <Archive className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
          </span>
          <Badge variant={notification.readAt ? "secondary" : "destructive"} className="shrink-0">
            {notification.readAt ? t(locale, "readStatus") : t(locale, "newStatus")}
          </Badge>
        </div>

        <div className="min-w-0">
          {href ? (
            <Link href={href} className="transition hover:text-violet-100">
              {title}
            </Link>
          ) : (
            title
          )}
          <p className={featured ? "mt-2 text-sm leading-6 text-zinc-300" : "mt-2 line-clamp-3 text-xs leading-5 text-zinc-400"}>{notification.body}</p>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex items-center gap-2 text-xs text-zinc-500">
            <Clock3 className="h-3.5 w-3.5" />
            {formatTimestamp(notification.createdAt)}
          </p>
          <NotificationActions notification={notification} workspaceId={workspaceId} locale={locale} />
        </div>
      </div>
    </article>
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
  const latestUnread = unreadNotifications[0];
  const secondaryUnread = unreadNotifications.slice(latestUnread ? 1 : 0, latestUnread ? 7 : 6);
  const archivedNotifications = readNotifications.slice(0, 12);

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-sm font-semibold uppercase tracking-[0.3em] text-violet-300">{t(locale, "notificationsCenter")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-500">
            {locale === "ru"
              ? "Разбирайте свежие напоминания, закрывайте обработанные и очищайте лишний шум из входящих пространства."
              : "Triage fresh reminders, resolve the ones you handled, and clean old noise out of the workspace inbox."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CleanupForm action={markAllNotificationsReadAction} workspaceId={workspace.id}>
            <Button size="sm" variant="secondary" disabled={!unreadNotifications.length}>
              <CheckCheck className="h-4 w-4" />
              {t(locale, "resolveAll")}
            </Button>
          </CleanupForm>
          <CleanupForm action={deleteReadNotificationsAction} workspaceId={workspace.id}>
            <Button size="sm" variant="outline" disabled={!readNotifications.length}>
              <Archive className="h-4 w-4" />
              {t(locale, "cleanRead")}
            </Button>
          </CleanupForm>
          <CleanupForm action={deleteAllNotificationsAction} workspaceId={workspace.id}>
            <Button size="sm" variant="destructive" disabled={!notifications.length}>
              <Trash2 className="h-4 w-4" />
              {t(locale, "clearInbox")}
            </Button>
          </CleanupForm>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-violet-300/15 bg-violet-500/[0.08] p-4">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-violet-200"><Inbox className="h-4 w-4" /> {t(locale, "inbox")}</p>
          <p className="mt-3 text-3xl font-semibold text-white">{notifications.length}</p>
          <p className="text-xs text-zinc-500">{locale === "ru" ? "последних напоминаний сохранено" : "latest reminders kept"}</p>
        </div>
        <div className="rounded-2xl border border-red-300/15 bg-red-500/[0.06] p-4">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-red-200"><Bell className="h-4 w-4" /> {t(locale, "needsAction")}</p>
          <p className="mt-3 text-3xl font-semibold text-white">{unreadNotifications.length}</p>
          <p className="text-xs text-zinc-500">{locale === "ru" ? "неразрешенных уведомлений" : "unresolved notifications"}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-300"><Archive className="h-4 w-4" /> {t(locale, "readArchive")}</p>
          <p className="mt-3 text-3xl font-semibold text-white">{readNotifications.length}</p>
          <p className="text-xs text-zinc-500">{locale === "ru" ? "готово к очистке" : "ready for cleanup"}</p>
        </div>
      </section>

      {!notifications.length ? (
        <section className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.06] text-violet-200">
            <Sparkles className="h-5 w-5" />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-white">{t(locale, "inboxClean")}</h2>
          <p className="mt-2 text-sm text-zinc-500">{locale === "ru" ? "Website-напоминания появятся здесь, когда у записей будут важные даты." : "Website reminders will land here when tracked entries approach important dates."}</p>
        </section>
      ) : null}

      {latestUnread ? (
        <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <NotificationCard notification={latestUnread} workspaceId={workspace.id} featured locale={locale} />

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-300">{t(locale, "moreUnread")}</h2>
              <Badge variant="destructive">{Math.max(unreadNotifications.length - 1, 0)} {locale === "ru" ? "в ожидании" : "waiting"}</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {secondaryUnread.map((notification) => (
                <NotificationCard key={notification.id} notification={notification} workspaceId={workspace.id} locale={locale} />
              ))}
              {!secondaryUnread.length ? (
                <p className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-zinc-500">{t(locale, "noOtherUnreadReminders")}</p>
              ) : null}
            </div>
          </div>
        </section>
      ) : notifications.length ? (
        <section className="rounded-3xl border border-emerald-300/15 bg-emerald-500/[0.06] p-5">
          <h2 className="text-lg font-semibold text-white">{t(locale, "allCaughtUp")}</h2>
          <p className="mt-1 text-sm text-zinc-500">{locale === "ru" ? "Все в этом пространстве закрыто. Используйте очистку прочитанного для очистки архива." : "Everything in this workspace is resolved. Use Clean read when you want to wipe the archive."}</p>
        </section>
      ) : null}

      {archivedNotifications.length ? (
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold text-white">{t(locale, "readArchive")}</h2>
              <p className="text-sm text-zinc-500">{locale === "ru" ? "Компактные карточки делают старые напоминания удобными для просмотра." : "Compact cards keep old reminders scannable without taking over the page."}</p>
            </div>
            <Badge variant="secondary">{archivedNotifications.length} {locale === "ru" ? "показано" : "shown"}</Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {archivedNotifications.map((notification) => (
              <NotificationCard key={notification.id} notification={notification} workspaceId={workspace.id} locale={locale} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
