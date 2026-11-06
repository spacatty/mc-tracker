import { updateWorkspaceAction } from "@/app/actions";
import { Crown, FolderOpen } from "lucide-react";
import { CreateInvitePopover } from "@/components/create-invite-popover";
import { DeleteWorkspaceAlert } from "@/components/delete-workspace-alert";
import { EmojiPickerInput } from "@/components/emoji-picker-input";
import { AppIcon } from "@/components/icons";
import { InviteCreatedBanner } from "@/components/invite-created-banner";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SectionCard, SectionHeading } from "@/components/ui/section-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkspaceEntriesTable } from "@/components/workspace-entries-accordion-table";
import { WorkspaceEntryTransferPicker } from "@/components/workspace-entry-transfer-picker";
import { WorkspaceImportExport } from "@/components/workspace-import-export";
import { WorkspaceInviteLinks } from "@/components/workspace-invite-links";
import { WorkspaceMembersTable } from "@/components/workspace-members-table";
import { WorkspaceList } from "@/components/workspace-list";
import { requireUser } from "@/lib/auth";
import {
  listCategoriesForWorkspace,
  listItemsForWorkspace,
  listWorkspaceInvites,
  listWorkspaceMembers,
  listWorkspacesForUser,
} from "@/lib/db";
import { t, roleLabel, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

function tx(locale: Locale, en: string, ru: string) {
  return locale === "ru" ? ru : en;
}

/** "3 categories", "1 entry"… with Russian plural forms. */
function countLabel(locale: Locale, count: number, en: [string, string], ru: [string, string, string]) {
  if (locale === "ru") {
    const mod10 = count % 10;
    const mod100 = count % 100;
    const form = mod10 === 1 && mod100 !== 11 ? ru[0] : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? ru[1] : ru[2];
    return `${count} ${form}`;
  }
  return `${count} ${count === 1 ? en[0] : en[1]}`;
}

const panelHeading = "text-[10.5px] font-semibold uppercase tracking-[0.12em] text-zinc-500";

export default async function FoldersPage({ searchParams }: { searchParams: Promise<{ invite?: string; workspace?: string; ws?: string }> }) {
  const user = await requireUser();
  const locale = await getLocale();
  const params = await searchParams;
  const workspaces = listWorkspacesForUser(user.id);
  // `ws` is the workspace picked in this page's list; it falls back to the user's current workspace.
  const activeWorkspaceId = Number(params.ws || params.workspace || 0);
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

  const selected = workspaces.find((workspace) => workspace.id === activeWorkspaceId) || workspaces[0];
  const entryCounts = Object.fromEntries(workspaces.map((workspace) => [workspace.id, workspaceEntries[workspace.id]?.length ?? 0]));

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {params.invite ? <InviteCreatedBanner token={params.invite} locale={locale} /> : null}

      <div className="grid min-h-0 flex-1 items-start gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:items-stretch">
        <WorkspaceList workspaces={workspaces} entryCounts={entryCounts} selectedId={selected?.id} locale={locale} />

      {[selected].filter((workspace): workspace is NonNullable<typeof workspace> => Boolean(workspace)).map((workspace) => {
        const isOwner = workspace.accessRole === "owner";
        const members = listWorkspaceMembers(workspace.id, user.id);
        const invites = listWorkspaceInvites(workspace.id, user.id);
        const categories = listCategoriesForWorkspace(workspace.id, user.id);
        const items = listItemsForWorkspace(workspace.id, user.id);
        const entryOptions = items.map((item) => ({
          id: item.id,
          name: item.name,
          categoryName: item.categoryName,
          categoryColor: item.categoryColor,
          categoryIcon: item.categoryIcon,
          vendorName: item.vendorName,
          accountName: item.accountName,
          createdAt: item.createdAt,
        }));
        const stats = [
          countLabel(locale, categories.length, ["category", "categories"], ["категория", "категории", "категорий"]),
          countLabel(locale, items.length, ["entry", "entries"], ["запись", "записи", "записей"]),
          countLabel(locale, members.length, ["member", "members"], ["участник", "участника", "участников"]),
          ...(isOwner ? [countLabel(locale, invites.length, ["invite", "invites"], ["приглашение", "приглашения", "приглашений"])] : []),
        ];

        return (
          <SectionCard
            key={workspace.id}
            id={`workspace-${workspace.id}`}
            className="flex min-h-0 flex-col"
            bodyClassName="min-h-0 flex-1 overflow-y-auto"
            title={
              <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className="text-lg leading-none" aria-hidden="true">
                  {workspace.emoji}
                </span>
                <span className="truncate">{workspace.name}</span>
                <Badge variant="outline" tone={isOwner ? "accent" : "default"} icon={isOwner ? <Crown /> : undefined}>
                  {roleLabel(locale, workspace.accessRole)}
                </Badge>
                {!isOwner ? (
                  <Badge variant="outline" tone="info">
                    {t(locale, "shared")}
                  </Badge>
                ) : null}
              </span>
            }
            description={
              <>
                {t(locale, "owner")}: {workspace.ownerUsername || tx(locale, "unknown", "неизвестно")}
                <span className="text-zinc-600"> · </span>
                <span className="tabular-nums">{stats.join(" · ")}</span>
              </>
            }
            actions={isOwner ? <CreateInvitePopover workspaceId={workspace.id} locale={locale} /> : null}
          >
            <Tabs key={workspace.id} defaultValue="overview">
              <TabsList className="max-w-full justify-start">
                <TabsTrigger value="overview">{t(locale, "overview")}</TabsTrigger>
                <TabsTrigger value="entries">{t(locale, "entries")}</TabsTrigger>
                <TabsTrigger value="import-export">{t(locale, "importExport")}</TabsTrigger>
                {isOwner ? <TabsTrigger value="config">{t(locale, "config")}</TabsTrigger> : null}
              </TabsList>

              <TabsContent value="overview" className="mt-5">
                <div className="grid gap-6 lg:grid-cols-2">
                  <section className="min-w-0">
                    <h3 className={panelHeading}>{t(locale, "entriesInWorkspace")}</h3>
                    {items.length ? (
                      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                        {items.slice(0, 12).map((item) => (
                          <li key={item.id} className="min-w-0 max-w-full">
                            <Badge color={item.categoryColor} icon={<AppIcon name={item.categoryIcon} />} className="text-[13px]">
                              <span className="truncate text-zinc-200">{item.name}</span>
                            </Badge>
                          </li>
                        ))}
                        {items.length > 12 ? (
                          <li className="text-[13px] text-zinc-500">{tx(locale, `+${items.length - 12} more`, `и ещё ${items.length - 12}`)}</li>
                        ) : null}
                      </ul>
                    ) : (
                      <p className="mt-3 text-[13px] text-zinc-500">{t(locale, "noEntriesYet")}</p>
                    )}
                  </section>
                  <section className="min-w-0">
                    <h3 className={panelHeading}>{t(locale, "members")}</h3>
                    {members.length ? (
                      <ul className="mt-2 divide-y divide-white/[0.05]">
                        {members.map((member) => (
                          <li key={member.userId} className="flex items-center gap-2.5 py-2">
                            <span
                              className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/[0.06] text-[11px] font-semibold uppercase text-zinc-300"
                              aria-hidden="true"
                            >
                              {member.username.slice(0, 1)}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-zinc-100">{member.username}</span>
                            <Badge tone={member.role === "owner" ? "accent" : "default"} icon={member.role === "owner" ? <Crown /> : undefined}>
                              {roleLabel(locale, member.role)}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-[13px] text-zinc-500">{t(locale, "noSharedMembersYet")}</p>
                    )}
                  </section>
                </div>
              </TabsContent>

              <TabsContent value="entries" className="mt-5 space-y-8">
                <WorkspaceEntriesTable workspaceId={workspace.id} workspaceRole={workspace.accessRole} entries={entryOptions} locale={locale} />
                <section className="space-y-4">
                  <SectionHeading
                    as="h3"
                    title={t(locale, "moveCopyEntriesBetweenWorkspaces")}
                    description={tx(
                      locale,
                      "Pick a source workspace, tick the entries and copy or move them here.",
                      "Выберите исходное пространство, отметьте записи и скопируйте или перенесите их сюда.",
                    )}
                  />
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
                </section>
              </TabsContent>

              <TabsContent value="import-export" className="mt-5">
                <WorkspaceImportExport workspaceId={workspace.id} workspaceRole={workspace.accessRole} locale={locale} />
              </TabsContent>

              {isOwner ? (
                <TabsContent value="config" className="mt-5 space-y-8">
                  <section className="space-y-4">
                    <SectionHeading as="h3" title={tx(locale, "Workspace", "Пространство")} description={tx(locale, "Icon and name shown in the switcher.", "Иконка и название, которые видны в переключателе пространств.")} />
                    <form action={updateWorkspaceAction} className="grid max-w-2xl items-end gap-4 grid-cols-[5.5rem_minmax(0,1fr)] sm:grid-cols-[5.5rem_minmax(0,1fr)_auto]">
                      <input type="hidden" name="workspaceId" value={workspace.id} />
                      <Field label={tx(locale, "Icon", "Иконка")}>
                        <EmojiPickerInput name="emoji" defaultValue={workspace.emoji} ariaLabel={tx(locale, "Workspace icon", "Иконка пространства")} />
                      </Field>
                      <Field label={t(locale, "name")} htmlFor={`workspace-name-${workspace.id}`}>
                        <Input id={`workspace-name-${workspace.id}`} name="name" defaultValue={workspace.name} required />
                      </Field>
                      <Button type="submit" variant="secondary" className="col-span-2 justify-self-end sm:col-span-1">
                        {t(locale, "saveWorkspace")}
                      </Button>
                    </form>
                  </section>

                  <section className="space-y-4">
                    <SectionHeading as="h3" title={t(locale, "currentMembers")} />
                    <div className="overflow-hidden rounded-lg border border-white/[0.06]">
                      <WorkspaceMembersTable workspaceId={workspace.id} members={members} locale={locale} />
                    </div>
                  </section>

                  <section className="space-y-4">
                    <SectionHeading
                      as="h3"
                      title={tx(locale, "Invite links", "Ссылки-приглашения")}
                      description={tx(locale, "Anyone with an active link can join.", "Присоединиться по активной ссылке может любой.")}
                    />
                    <div className="overflow-hidden rounded-lg border border-white/[0.06]">
                      <WorkspaceInviteLinks workspaceId={workspace.id} invites={invites} isOwner={isOwner} locale={locale} />
                    </div>
                  </section>

                  <Alert
                    tone="danger"
                    role="note"
                    title={t(locale, "dangerZone")}
                    action={<DeleteWorkspaceAlert workspaceId={workspace.id} workspaceName={workspace.name} locale={locale} />}
                  >
                    {tx(locale, "Delete this workspace and all of its data permanently.", "Удалить это пространство и все его данные навсегда.")}
                  </Alert>
                </TabsContent>
              ) : null}
            </Tabs>
          </SectionCard>
        );
      })}

        {!selected ? (
          <EmptyState
            icon={<FolderOpen />}
            title={t(locale, "noWorkspacesYet")}
            description={tx(locale, "Create a workspace or join one with an invite link.", "Создайте пространство или присоединитесь к общему по ссылке-приглашению.")}
          />
        ) : null}
      </div>
    </div>
  );
}
