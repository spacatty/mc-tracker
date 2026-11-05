import { Archive, CheckCheck, Inbox, Trash2 } from "lucide-react";
import {
  deleteAllNotificationsAction,
  deleteReadNotificationsAction,
  markAllNotificationsReadAction,
} from "@/app/actions";
import { NotificationsList } from "@/components/notifications-list";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Surface } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth";
import { listWebsiteNotificationsForWorkspace, resolveWorkspaceForUser } from "@/lib/db";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

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
          <NotificationsList notifications={notifications} workspaceId={workspace.id} locale={locale} />
        </Surface>
      )}
    </div>
  );
}
