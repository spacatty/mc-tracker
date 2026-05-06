import {
  removeWorkspaceMemberAction,
  updateWorkspaceAction,
  updateWorkspaceMemberRoleAction,
} from "@/app/actions";
import { Plus, ShieldCheck, Trash2, UserPlus2 } from "lucide-react";
import { CreateInvitePopover } from "@/components/create-invite-popover";
import { CreateWorkspaceDialog } from "@/components/create-workspace-dialog";
import { DeleteWorkspaceAlert } from "@/components/delete-workspace-alert";
import { EmojiPickerInput } from "@/components/emoji-picker-input";
import { InviteCreatedBanner } from "@/components/invite-created-banner";
import { JoinWorkspaceDialog } from "@/components/join-workspace-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/hidden-input";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkspaceEntriesAccordionTable } from "@/components/workspace-entries-accordion-table";
import { WorkspaceEntryTransferPicker } from "@/components/workspace-entry-transfer-picker";
import { WorkspaceImportExport } from "@/components/workspace-import-export";
import { WorkspaceInviteLinks } from "@/components/workspace-invite-links";
import { requireUser } from "@/lib/auth";
import {
  listCategoriesForWorkspace,
  listItemsForWorkspace,
  listWorkspaceInvites,
  listWorkspaceMembers,
  listWorkspacesForUser,
} from "@/lib/db";
import { t, roleLabel } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export default async function FoldersPage({ searchParams }: { searchParams: Promise<{ invite?: string; workspace?: string }> }) {
  const user = await requireUser();
  const locale = await getLocale();
  const params = await searchParams;
  const workspaces = listWorkspacesForUser(user.id);
  const activeWorkspaceId = Number(params.workspace || 0);
  const workspaceEntries = Object.fromEntries(
    workspaces.map((workspace) => [
      workspace.id,
      listItemsForWorkspace(workspace.id, user.id).map((item) => ({
        id: item.id,
        name: item.name,
        categoryName: item.categoryName,
        vendorName: item.vendorName,
        accountName: item.accountName,
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        workspaceEmoji: workspace.emoji,
      })),
    ]),
  );

  return (
    <div className="space-y-7">
      <header className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h1 className="text-sm font-semibold uppercase tracking-[0.3em] text-fuchsia-300">{t(locale, "shareAndSpace")}</h1>
        </div>
        <div className="w-full rounded-xl border border-white/10 bg-black/20 p-1 md:w-auto md:max-w-full">
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <CreateWorkspaceDialog
              locale={locale}
              trigger={(
                <Button className="h-8 border border-fuchsia-300/20 bg-fuchsia-500/12 px-2.5 text-xs text-fuchsia-100 hover:bg-fuchsia-500/24">
                  <Plus className="h-3.5 w-3.5" />
                  {t(locale, "createWorkspace")}
                </Button>
              )}
            />
            <JoinWorkspaceDialog
              locale={locale}
              trigger={(
                <Button
                  variant="secondary"
                  className="h-8 border border-sky-300/20 bg-sky-500/10 px-2.5 text-xs text-sky-100 hover:bg-sky-500/20"
                >
                  <UserPlus2 className="h-3.5 w-3.5" />
                  {t(locale, "joinWorkspace")}
                </Button>
              )}
            />
          </div>
        </div>
      </header>

      {params.invite ? (
        <InviteCreatedBanner token={params.invite} />
      ) : null}

      <div className="grid gap-4">
        {workspaces.map((workspace) => {
          const isOwner = workspace.accessRole === "owner";
          const members = listWorkspaceMembers(workspace.id, user.id);
          const invites = listWorkspaceInvites(workspace.id, user.id);
          const categories = listCategoriesForWorkspace(workspace.id, user.id);
          const items = listItemsForWorkspace(workspace.id, user.id);
          const entryOptions = items.map((item) => ({
            id: item.id,
            name: item.name,
            categoryName: item.categoryName,
            vendorName: item.vendorName,
            accountName: item.accountName,
            createdAt: item.createdAt,
          }));

          return (
            <section key={workspace.id} className={`overflow-hidden rounded-3xl border bg-white/[0.03] ${isOwner ? "border-white/10" : "border-violet-400/30 shadow-[0_0_0_1px_rgba(167,139,250,0.2)]"}`}>
              <div className="grid gap-3 border-b border-white/10 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-xl font-semibold text-white">{workspace.emoji} {workspace.name}</h2>
                    <Badge variant={isOwner ? "default" : "secondary"}>{roleLabel(locale, workspace.accessRole)}</Badge>
                    {!isOwner ? <Badge className="bg-violet-500/20 text-violet-200">{t(locale, "shared")}</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">{t(locale, "owner")}: {workspace.ownerUsername || (locale === "ru" ? "неизвестно" : "unknown")}</p>
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <Badge variant="secondary">{categories.length} {t(locale, "categories").toLowerCase()}</Badge>
                  <Badge variant="secondary">{items.length} {t(locale, "entries").toLowerCase()}</Badge>
                  <Badge variant="secondary">{members.length} {t(locale, "members").toLowerCase()}</Badge>
                  <Badge variant={invites.length ? "default" : "secondary"}>{invites.length} {locale === "ru" ? "приглашений" : "invites"}</Badge>
                  {isOwner ? <CreateInvitePopover workspaceId={workspace.id} locale={locale} /> : null}
                </div>
              </div>
              <Tabs defaultValue={activeWorkspaceId === workspace.id ? "entries" : "overview"} className="p-4">
                <TabsList className="mb-3">
                  <TabsTrigger value="overview">{t(locale, "overview")}</TabsTrigger>
                  <TabsTrigger value="entries">{t(locale, "entries")}</TabsTrigger>
                  <TabsTrigger value="import-export">{t(locale, "importExport")}</TabsTrigger>
                  {isOwner ? <TabsTrigger value="config">{t(locale, "config")}</TabsTrigger> : null}
                </TabsList>
                <TabsContent value="overview">
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <h3 className="mb-3 text-sm font-semibold text-zinc-300">{t(locale, "entriesInWorkspace")}</h3>
                      <div className="flex flex-wrap gap-2">
                        {items.slice(0, 8).map((item) => (
                          <Badge key={item.id} variant="secondary">{item.name}</Badge>
                        ))}
                        {!items.length ? <p className="text-sm text-zinc-500">{t(locale, "noEntriesYet")}</p> : null}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <h3 className="mb-3 text-sm font-semibold text-zinc-300">{t(locale, "members")}</h3>
                      <div className="flex flex-wrap gap-2">
                        {members.map((member) => <Badge key={member.username} variant="secondary">{member.username}: {roleLabel(locale, member.role)}</Badge>)}
                        {!members.length ? <p className="text-sm text-zinc-500">{t(locale, "noSharedMembersYet")}</p> : null}
                      </div>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="entries">
                  <div className="grid gap-3 xl:grid-cols-[1fr_1fr]">
                    <div className="xl:col-span-2">
                      <WorkspaceEntriesAccordionTable
                        workspaceId={workspace.id}
                        workspaceRole={workspace.accessRole}
                        entries={entryOptions}
                        locale={locale}
                      />
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 xl:col-span-2">
                      <h3 className="mb-1 text-sm font-semibold text-zinc-200">{t(locale, "moveCopyEntriesBetweenWorkspaces")}</h3>
                      <p className="mb-3 text-xs text-zinc-500">{locale === "ru" ? "Выберите исходное пространство, найдите записи и сохраните изменения." : "Pick source workspace, fuzzy-search entries, then save changes."}</p>
                      <WorkspaceEntryTransferPicker
                        targetWorkspaceId={workspace.id}
                        targetEntries={entryOptions}
                        sourceWorkspaces={workspaces.map((candidate) => ({
                          id: candidate.id,
                          name: candidate.name,
                          emoji: candidate.emoji,
                          accessRole: candidate.accessRole,
                        }))}
                        entriesByWorkspace={workspaceEntries}
                        locale={locale}
                      />
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="import-export">
                  <WorkspaceImportExport workspaceId={workspace.id} workspaceRole={workspace.accessRole} locale={locale} />
                </TabsContent>
                {isOwner ? (
                  <TabsContent value="config">
                    <div className="grid gap-3">
                      <form action={updateWorkspaceAction} className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 md:grid-cols-[120px_1fr_auto]">
                        <input type="hidden" name="workspaceId" value={workspace.id} />
                        <EmojiPickerInput name="emoji" defaultValue={workspace.emoji} />
                        <Input name="name" defaultValue={workspace.name} />
                        <Button className="border border-emerald-300/25 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25">{t(locale, "saveWorkspace")}</Button>
                      </form>
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <h3 className="mb-3 text-sm font-semibold text-zinc-300">{t(locale, "currentMembers")}</h3>
                        <div className="space-y-2">
                          {members.map((member) => (
                            <div key={member.userId} className="grid gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                              <div className="flex min-w-0 flex-wrap items-center gap-2">
                                <Badge variant="secondary" className="max-w-[220px] truncate">{member.username}</Badge>
                                <Badge>{roleLabel(locale, member.role)}</Badge>
                              </div>
                              {member.role !== "owner" ? (
                                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                                  <form action={updateWorkspaceMemberRoleAction} className="flex items-center gap-2 rounded-xl border border-sky-400/20 bg-sky-500/5 px-2 py-1.5">
                                    <input type="hidden" name="workspaceId" value={workspace.id} />
                                    <input type="hidden" name="targetUserId" value={member.userId} />
                                    <SelectInput
                                      name="role"
                                      defaultValue={member.role}
                                      triggerClassName="h-8 min-w-[110px]"
                                      options={[
                                        { value: "viewer", label: roleLabel(locale, "viewer") },
                                        { value: "editor", label: roleLabel(locale, "editor") },
                                      ]}
                                    />
                                    <Button size="sm" className="border border-sky-300/30 bg-sky-500/20 text-sky-100 hover:bg-sky-500/30">
                                      <ShieldCheck className="h-3.5 w-3.5" />
                                      {t(locale, "saveRole")}
                                    </Button>
                                  </form>
                                  <form action={removeWorkspaceMemberAction}>
                                    <input type="hidden" name="workspaceId" value={workspace.id} />
                                    <input type="hidden" name="targetUserId" value={member.userId} />
                                    <Button size="sm" className="border border-red-300/30 bg-red-500/15 text-red-100 hover:bg-red-500/25">
                                      <Trash2 className="h-3.5 w-3.5" />
                                      {t(locale, "kick")}
                                    </Button>
                                  </form>
                                </div>
                              ) : null}
                            </div>
                          ))}
                          {!members.length ? <p className="text-sm text-zinc-500">{t(locale, "noSharedMembersYet")}</p> : null}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <h3 className="mb-3 text-sm font-semibold text-zinc-300">{locale === "ru" ? "Активные ссылки-приглашения" : "Active invite links"}</h3>
                        <WorkspaceInviteLinks workspaceId={workspace.id} invites={invites} isOwner={isOwner} locale={locale} />
                      </div>
                      <div className="rounded-2xl border border-red-400/20 bg-red-500/[0.04] p-4">
                        <h3 className="mb-1 text-sm font-semibold text-red-200">{t(locale, "dangerZone")}</h3>
                        <p className="mb-3 text-xs text-red-100/70">{locale === "ru" ? "Удалите это пространство и все связанные данные навсегда." : "Delete this workspace and all related data permanently."}</p>
                        <DeleteWorkspaceAlert workspaceId={workspace.id} workspaceName={workspace.name} locale={locale} />
                      </div>
                    </div>
                  </TabsContent>
                ) : null}
              </Tabs>
            </section>
          );
        })}
        {!workspaces.length ? <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-zinc-500">{t(locale, "noWorkspacesYet")}</p> : null}
      </div>
    </div>
  );
}
