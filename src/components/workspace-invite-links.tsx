"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Link2, Trash2 } from "lucide-react";
import { revokeWorkspaceInviteAction } from "@/app/actions";
import { tx } from "@/components/capture/shared";
import type { Locale } from "@/lib/i18n";
import { roleLabel, t } from "@/lib/i18n";
import { displayDate } from "@/lib/utils";
import { useOrigin } from "./invite-created-banner";
import { Badge } from "./ui/badge";
import { ConfirmDialog } from "./ui/dialog";
import { RowAction, RowActions } from "./ui/row-actions";

type Invite = { token: string; role: string; created_at?: string };

export function WorkspaceInviteLinks({
  workspaceId,
  invites,
  isOwner,
  locale = "en",
}: {
  workspaceId: number;
  invites: Invite[];
  isOwner: boolean;
  locale?: Locale;
}) {
  const origin = useOrigin();
  const [copiedToken, setCopiedToken] = useState("");
  const [revokeTarget, setRevokeTarget] = useState<Invite | null>(null);
  const [pending, startTransition] = useTransition();

  const fullLink = (token: string) => `${origin}/invite/${token}`;

  async function copy(token: string) {
    await navigator.clipboard?.writeText(fullLink(token));
    setCopiedToken(token);
    window.setTimeout(() => setCopiedToken((current) => (current === token ? "" : current)), 1200);
  }

  function revoke() {
    if (!revokeTarget) return;
    const token = revokeTarget.token;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("workspaceId", String(workspaceId));
      formData.set("token", token);
      await revokeWorkspaceInviteAction(formData);
      setRevokeTarget(null);
    });
  }

  if (!invites.length) {
    return <p className="px-4 py-6 text-center text-[13px] text-zinc-500">{t(locale, "noActiveInvites")}</p>;
  }

  return (
    <>
      <ul className="divide-y divide-white/[0.05]">
        {invites.map((invite) => {
          const role = invite.role === "editor" || invite.role === "viewer" ? roleLabel(locale, invite.role) : invite.role;
          return (
            <li key={invite.token} className="group flex items-center gap-3 px-4 py-2.5 transition hover:bg-white/[0.03]">
              <Link2 className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-[12px] text-zinc-300">{fullLink(invite.token)}</p>
                {invite.created_at ? (
                  <p className="text-[11.5px] tabular-nums text-zinc-500">
                    {tx(locale, "Created", "Создана")} {displayDate(invite.created_at)}
                  </p>
                ) : null}
              </div>
              <Badge variant="outline" tone={invite.role === "editor" ? "accent" : "default"} className="shrink-0">
                {role}
              </Badge>
              <RowActions>
                <RowAction
                  label={copiedToken === invite.token ? tx(locale, "Copied", "Скопировано") : tx(locale, "Copy invite link", "Копировать ссылку-приглашение")}
                  icon={copiedToken === invite.token ? <Check className="text-emerald-300" /> : <Copy />}
                  onClick={() => void copy(invite.token)}
                />
                {isOwner ? (
                  <RowAction
                    label={tx(locale, "Revoke invite", "Отозвать приглашение")}
                    icon={<Trash2 />}
                    tone="danger"
                    onClick={() => setRevokeTarget(invite)}
                  />
                ) : null}
              </RowActions>
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        open={Boolean(revokeTarget)}
        onOpenChange={(next) => {
          if (!next) setRevokeTarget(null);
        }}
        destructive
        pending={pending}
        title={tx(locale, "Revoke this invite?", "Отозвать приглашение?")}
        description={tx(locale, "The link stops working right away. People who already joined keep access.", "Ссылка сразу перестанет работать. Те, кто уже присоединился, сохранят доступ.")}
        confirmLabel={tx(locale, "Revoke", "Отозвать")}
        cancelLabel={t(locale, "cancel")}
        onConfirm={revoke}
      />
    </>
  );
}
