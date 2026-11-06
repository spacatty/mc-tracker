import { Archive, CheckCheck, Inbox } from "lucide-react";
import { deleteReadNotificationsAction, markAllNotificationsReadAction } from "@/app/actions";
import { ClearInboxButton, NotificationsList } from "@/components/notifications-list";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
  const ru = locale === "ru";

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col gap-6">
      {!notifications.length ? (
        <EmptyState
          icon={<Inbox />}
          title={t(locale, "inboxClean")}
          description={ru
            ? "Напоминания появятся здесь, когда у записей приблизятся важные даты."
            : "Website reminders will land here when tracked entries approach important dates."}
        />
      ) : (
        <NotificationsList
          notifications={notifications}
          workspaceId={workspace.id}
          locale={locale}
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
              <ClearInboxButton workspaceId={workspace.id} count={notifications.length} locale={locale} />
            </>
          )}
        />
      )}
    </div>
  );
}
