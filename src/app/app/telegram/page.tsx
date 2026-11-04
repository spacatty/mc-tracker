import { Send, Trash2, Zap } from "lucide-react";
import { deleteNotificationChannelAction, sendTelegramTestAction } from "@/app/actions";
import { TelegramRouteDialog } from "@/components/telegram-route-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { listNotificationChannelsForWorkspace, resolveWorkspaceForUser } from "@/lib/db";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { PageHeader } from "@/components/ui/page-header";

export default async function TelegramRoutesPage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const user = await requireUser();
  const locale = await getLocale();
  const params = await searchParams;
  const workspace = resolveWorkspaceForUser(user.id, Number(params.workspace || 0) || null);
  const channels = listNotificationChannelsForWorkspace(workspace.id, user.id);
  const telegramChannels = channels.filter((channel) => channel.type === "telegram");

  const canEdit = workspace.accessRole !== "viewer";

  return (
    <div className="space-y-6">
      <PageHeader
        title={t(locale, "telegramRoutes")}
        description={locale === "ru" ? "Один маршрут на топик супергруппы. Категории выбирают, куда слать напоминания." : "One route per supergroup topic. Categories pick which routes get their reminders."}
        actions={canEdit ? (
          <TelegramRouteDialog
            workspaceId={workspace.id}
            locale={locale}
          />
        ) : null}
      />

      {telegramChannels.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {telegramChannels.map((channel) => (
            <article key={channel.id} className="flex flex-col rounded-xl border border-white/[0.08] bg-surface">
              <div className="flex items-start gap-3 px-4 pt-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-sky-500/10 text-sky-300">
                  <Send className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[13px] font-semibold text-zinc-100">{channel.title || t(locale, "telegram")}</h2>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-zinc-500">
                    {channel.chatId || "—"}{channel.topicId ? ` · #${channel.topicId}` : ""}
                  </p>
                </div>
                {channel.proxyUrl ? <Badge variant="secondary" className="shrink-0">proxy</Badge> : null}
              </div>
              <dl className="mx-4 mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[11px]">
                <dt className="text-zinc-600">{t(locale, "botToken")}</dt>
                <dd className="truncate font-mono text-zinc-400">{channel.botToken ? `${channel.botToken.slice(0, 6)}…${channel.botToken.slice(-4)}` : "—"}</dd>
              </dl>
              <div className="mt-4 flex items-center gap-1 border-t border-white/[0.06] px-2 py-2">
                <form action={sendTelegramTestAction}>
                  <input type="hidden" name="id" value={channel.id} />
                  <input type="hidden" name="workspaceId" value={workspace.id} />
                  <Button variant="ghost" size="sm"><Zap className="h-3.5 w-3.5" />{locale === "ru" ? "Тест" : "Test"}</Button>
                </form>
                {canEdit ? (
                  <>
                    <TelegramRouteDialog
                      workspaceId={workspace.id}
                      channel={channel}
                      locale={locale}
                      triggerVariant="ghost"
                    />
                    <form action={deleteNotificationChannelAction} className="ml-auto">
                      <input type="hidden" name="id" value={channel.id} />
                      <input type="hidden" name="workspaceId" value={workspace.id} />
                      <Button variant="ghost" size="sm" className="w-8 px-0 hover:bg-red-500/10 hover:text-red-200" title={t(locale, "delete")} aria-label={`${t(locale, "delete")}: ${channel.title}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </form>
                  </>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-white/10 px-6 py-12 text-center">
          <Send className="h-5 w-5 text-zinc-600" />
          <p className="mt-3 text-sm font-medium text-zinc-200">{t(locale, "noTelegramRoutesYet")}</p>
          {canEdit ? (
            <TelegramRouteDialog
              workspaceId={workspace.id}
              locale={locale}
              triggerVariant="secondary"
              triggerClassName="mt-4"
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
