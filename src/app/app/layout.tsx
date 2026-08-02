import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import {
  listCategoriesForWorkspace,
  listWorkspacesForUser,
  unreadNotificationCountForWorkspace,
} from "@/lib/db";
import { getLocale } from "@/lib/i18n-server";
import { startNotificationWorker } from "@/lib/notification-worker";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  startNotificationWorker();
  const user = await requireUser();
  const locale = await getLocale();
  const workspaces = listWorkspacesForUser(user.id);
  const categories = workspaces.flatMap((workspace) => listCategoriesForWorkspace(workspace.id, user.id));
  const unreadCount = workspaces.reduce((sum, workspace) => sum + unreadNotificationCountForWorkspace(workspace.id, user.id), 0);

  return (
    <AppShell user={user} workspaces={workspaces} categories={categories} unreadCount={unreadCount} locale={locale}>
      {children}
    </AppShell>
  );
}
