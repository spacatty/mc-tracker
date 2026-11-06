"use client";

import { useState, useTransition } from "react";
import { Crown, UserMinus, Users } from "lucide-react";
import { removeWorkspaceMemberAction, updateWorkspaceMemberRoleAction } from "@/app/actions";
import { tx } from "@/components/capture/shared";
import type { Locale } from "@/lib/i18n";
import { roleLabel, t } from "@/lib/i18n";
import type { WorkspaceRole } from "@/lib/types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { ConfirmDialog } from "./ui/dialog";
import { SelectInput } from "./ui/hidden-input";
import { RowAction, RowActions } from "./ui/row-actions";
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from "./ui/table";

type Member = { userId: number; username: string; role: WorkspaceRole };

/** Owner-only members table: change a member's role (server-action form) or remove them (confirmed). */
export function WorkspaceMembersTable({ workspaceId, members, locale = "en" }: { workspaceId: number; members: Member[]; locale?: Locale }) {
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    if (!removeTarget) return;
    const target = removeTarget;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("workspaceId", String(workspaceId));
      formData.set("targetUserId", String(target.userId));
      await removeWorkspaceMemberAction(formData);
      setRemoveTarget(null);
    });
  }

  return (
    <>
      <Table bare minWidth={520}>
        <TableHeader>
          <TableRow>
            <TableHead>{tx(locale, "User", "Пользователь")}</TableHead>
            <TableHead>{tx(locale, "Role", "Роль")}</TableHead>
            <TableHead align="right" className="w-[1%]">
              <span className="sr-only">{t(locale, "actions")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => {
            const isOwnerRow = member.role === "owner";
            const formId = `member-role-${workspaceId}-${member.userId}`;
            return (
              <TableRow key={member.userId}>
                <TableCell primary>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/[0.06] text-[11px] font-semibold uppercase text-zinc-300"
                      aria-hidden="true"
                    >
                      {member.username.slice(0, 1)}
                    </span>
                    <span className="truncate">{member.username}</span>
                  </span>
                </TableCell>
                <TableCell>
                  {isOwnerRow ? (
                    <Badge tone="accent" icon={<Crown />}>
                      {roleLabel(locale, "owner")}
                    </Badge>
                  ) : (
                    <form id={formId} action={updateWorkspaceMemberRoleAction} className="flex items-center gap-2">
                      <input type="hidden" name="workspaceId" value={workspaceId} />
                      <input type="hidden" name="targetUserId" value={member.userId} />
                      <div className="w-36">
                        <SelectInput
                          name="role"
                          defaultValue={member.role}
                          ariaLabel={tx(locale, `Role for ${member.username}`, `Роль пользователя ${member.username}`)}
                          triggerClassName="h-8 rounded-md text-[13px]"
                          options={[
                            { value: "viewer", label: roleLabel(locale, "viewer") },
                            { value: "editor", label: roleLabel(locale, "editor") },
                          ]}
                        />
                      </div>
                      <Button type="submit" size="sm" variant="ghost">
                        {t(locale, "saveRole")}
                      </Button>
                    </form>
                  )}
                </TableCell>
                <TableCell align="right" className="w-[1%] whitespace-nowrap">
                  {!isOwnerRow ? (
                    <RowActions>
                      <RowAction
                        label={tx(locale, `Remove ${member.username}`, `Исключить ${member.username}`)}
                        icon={<UserMinus />}
                        tone="danger"
                        onClick={() => setRemoveTarget(member)}
                      />
                    </RowActions>
                  ) : null}
                </TableCell>
              </TableRow>
            );
          })}
          {!members.length ? <TableEmpty colSpan={3} icon={<Users />} title={t(locale, "noSharedMembersYet")} /> : null}
        </TableBody>
      </Table>
      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(next) => {
          if (!next) setRemoveTarget(null);
        }}
        destructive
        pending={pending}
        icon={<UserMinus />}
        title={tx(locale, `Remove ${removeTarget?.username ?? "member"}?`, `Исключить ${removeTarget?.username ?? "участника"}?`)}
        description={tx(
          locale,
          "They lose access to this workspace. You can invite them again later.",
          "Участник потеряет доступ к пространству. Позже его можно пригласить снова.",
        )}
        confirmLabel={t(locale, "kick")}
        cancelLabel={t(locale, "cancel")}
        onConfirm={remove}
      />
    </>
  );
}
