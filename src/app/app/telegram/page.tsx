import { Send } from "lucide-react";
import { TelegramRouteCardActions, TelegramRouteDialog } from "@/components/telegram-route-dialog";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth";
import { listNotificationChannelsForWorkspace, resolveWorkspaceForUser } from "@/lib/db";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export default async function TelegramRoutesPage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const user = await requireUser();
  const locale = await getLocale();
  const params = await searchParams;
  const workspace = resolveWorkspaceForUser(user.id, Number(params.workspace || 0) || null);
  const channels = listNotificationChannelsForWorkspace(workspace.id, user.id);
  const telegramChannels = channels.filter((channel) => channel.type === "telegram");
  const ru = locale === "ru";

  const canEdit = workspace.accessRole !== "viewer";

  return (
    <div className="space-y-6">
      {canEdit && telegramChannels.length ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] text-zinc-500">{ru ? "Один маршрут — одна тема супергруппы. В настройках категории выбирается, куда отправлять её напоминания." : "One route per supergroup topic. Categories pick which routes get their reminders."}</p>
          <TelegramRouteDialog workspaceId={workspace.id} locale={locale} />
        </div>
      ) : null}

      {telegramChannels.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {telegramChannels.map((channel) => (
            <article key={channel.id} className="flex min-w-0 flex-col rounded-xl border border-white/[0.06] bg-surface">
              <div className="flex items-start gap-3 px-4 pt-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sky-500/10 text-sky-300" aria-hidden="true">
                  <Send className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[13px] font-semibold text-zinc-100">{channel.title || t(locale, "telegram")}</h2>
                  <p className="mt-0.5 truncate font-mono text-[11.5px] text-zinc-500">
                    {channel.chatId || "—"}{channel.topicId ? ` · #${channel.topicId}` : ""}
                  </p>
                </div>
                {channel.proxyUrl ? <Badge variant="outline" className="shrink-0 text-[11px] text-zinc-400">proxy</Badge> : null}
              </div>
              <dl className="mx-4 mb-4 mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[11.5px]">
                <dt className="text-zinc-500">{t(locale, "botToken")}</dt>
                <dd className="truncate font-mono text-zinc-400">{channel.botToken ? `${channel.botToken.slice(0, 6)}…${channel.botToken.slice(-4)}` : "—"}</dd>
              </dl>
              <div className="mt-auto">
                <TelegramRouteCardActions workspaceId={workspace.id} channel={channel} locale={locale} canEdit={canEdit} />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Send />}
          title={t(locale, "noTelegramRoutesYet")}
          description={ru
            ? "Добавьте бота и чат, затем выберите маршрут в настройках категории."
            : "Add a bot and a chat, then pick the route in a category's settings."}
          action={canEdit ? <TelegramRouteDialog workspaceId={workspace.id} locale={locale} /> : null}
        />
      )}
    </div>
  );
}
