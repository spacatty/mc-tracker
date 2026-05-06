import { deleteNotificationChannelAction, saveTelegramChannelAction, sendTelegramTestAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-violet-500/10 via-sky-500/5 to-cyan-500/10 p-6">
        <h1 className="text-sm font-semibold uppercase tracking-[0.3em] text-violet-300">{t(locale, "telegramRouteInstances")}</h1>
      </header>

      <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
        <div className="border-b border-white/10 bg-black/20 p-5">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div>
              <h2 className="text-lg font-semibold text-white">{t(locale, "telegramRouteInstances")}</h2>
              <p className="mt-1 text-sm text-zinc-400">
                {locale === "ru"
                  ? "Создавайте отдельный экземпляр для каждого топика супергруппы."
                  : "Create one instance per supergroup topic. Example: one route for Servers topic, another route for Domains topic."}
              </p>
            </div>
            <Badge>{telegramChannels.length} {locale === "ru" ? "настроено" : "configured"}</Badge>
          </div>
        </div>
        <div className="p-5">
          <form action={saveTelegramChannelAction} className="rounded-2xl border border-violet-400/20 bg-violet-500/10 p-5">
            <input type="hidden" name="workspaceId" value={workspace.id} />
            <h3 className="text-sm font-semibold text-violet-100">{t(locale, "addTelegramRouteInstance")}</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="space-y-2 text-xs font-medium text-zinc-300">
                <span className="block">{t(locale, "routeTitle")}</span>
                <Input name="title" placeholder={locale === "ru" ? "например Domains topic" : "e.g. Domains topic"} />
              </label>
              <label className="space-y-2 text-xs font-medium text-zinc-300">
                <span className="block">{t(locale, "botToken")}</span>
                <Input name="botToken" placeholder={t(locale, "botToken")} />
              </label>
              <label className="space-y-2 text-xs font-medium text-zinc-300">
                <span className="block">{t(locale, "chatId")}</span>
                <Input name="chatId" placeholder={t(locale, "chatId")} />
              </label>
              <label className="space-y-2 text-xs font-medium text-zinc-300">
                <span className="block">{t(locale, "topicIdOptional")}</span>
                <Input name="topicId" placeholder={t(locale, "topicId")} />
              </label>
              <label className="space-y-2 text-xs font-medium text-zinc-300 md:col-span-2">
                <span className="block">{locale === "ru" ? "HTTP proxy (опционально)" : "HTTP proxy (optional)"}</span>
                <Input name="proxyUrl" placeholder="http://user:pass@host:port" />
              </label>
            </div>
            <div className="mt-4 flex justify-end">
              <Button>{t(locale, "addRoute")}</Button>
            </div>
          </form>
          <div className="mt-5 grid gap-4">
            {telegramChannels.map((channel) => (
              <div key={channel.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{t(locale, "telegram")}</Badge>
                  <Badge variant="secondary">chat {channel.chatId}</Badge>
                  {channel.topicId ? <Badge variant="secondary">topic {channel.topicId}</Badge> : null}
                </div>
                <form action={saveTelegramChannelAction} className="space-y-4">
                  <input type="hidden" name="id" value={channel.id} />
                  <input type="hidden" name="workspaceId" value={workspace.id} />
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-2 text-xs font-medium text-zinc-300">
                      <span className="block">{t(locale, "routeTitle")}</span>
                      <Input name="title" defaultValue={channel.title} placeholder={t(locale, "routeTitle")} />
                    </label>
                    <label className="space-y-2 text-xs font-medium text-zinc-300">
                      <span className="block">{t(locale, "botToken")}</span>
                      <Input name="botToken" defaultValue={channel.botToken} placeholder={t(locale, "botToken")} />
                    </label>
                    <label className="space-y-2 text-xs font-medium text-zinc-300">
                      <span className="block">{t(locale, "chatId")}</span>
                      <Input name="chatId" defaultValue={channel.chatId} placeholder={t(locale, "chatId")} />
                    </label>
                    <label className="space-y-2 text-xs font-medium text-zinc-300">
                      <span className="block">{t(locale, "topicId")}</span>
                      <Input name="topicId" defaultValue={channel.topicId} placeholder={t(locale, "topicIdOptional")} />
                    </label>
                    <label className="space-y-2 text-xs font-medium text-zinc-300 md:col-span-2">
                      <span className="block">{locale === "ru" ? "HTTP proxy (опционально)" : "HTTP proxy (optional)"}</span>
                      <Input name="proxyUrl" defaultValue={channel.proxyUrl} placeholder="http://user:pass@host:port" />
                    </label>
                  </div>
                  <div className="flex justify-end">
                    <Button variant="secondary">{t(locale, "saveChanges")}</Button>
                  </div>
                </form>
                <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-white/10 pt-3">
                  <form action={sendTelegramTestAction}>
                    <input type="hidden" name="id" value={channel.id} />
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <Button variant="secondary" size="sm">{t(locale, "sendTestMessage")}</Button>
                  </form>
                  <form action={deleteNotificationChannelAction}>
                    <input type="hidden" name="id" value={channel.id} />
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <Button variant="ghost" size="sm" className="text-red-200">{t(locale, "delete")}</Button>
                  </form>
                </div>
              </div>
            ))}
            {!telegramChannels.length ? (
              <p className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm text-zinc-500">{t(locale, "noTelegramRoutesYet")}</p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
