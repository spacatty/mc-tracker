"use client";

import { useMemo } from "react";
import { Copy, Link2, Trash2 } from "lucide-react";
import { revokeWorkspaceInviteAction } from "@/app/actions";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { Button } from "./ui/button";

export function WorkspaceInviteLinks({
  workspaceId,
  invites,
  isOwner,
  locale = "en",
}: {
  workspaceId: number;
  invites: Array<{ token: string; role: string }>;
  isOwner: boolean;
  locale?: Locale;
}) {
  const base = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);

  function fullLink(token: string) {
    if (!base) return `/invite/${token}`;
    return `${base}/invite/${token}`;
  }

  return (
    <div className="space-y-2">
      {invites.map((invite) => {
        const link = fullLink(invite.token);
        return (
          <div key={invite.token} className="flex flex-wrap items-center gap-2 rounded-xl border border-violet-400/15 bg-violet-500/[0.06] p-3 text-xs text-zinc-300">
            <button
              type="button"
              className="inline-flex items-center gap-2 break-all rounded-lg px-2 py-1 text-left hover:bg-white/10"
              onClick={async () => {
                await navigator.clipboard?.writeText(link);
              }}
              title={locale === "ru" ? "Скопировать ссылку-приглашение" : "Copy invite link"}
            >
              <span className="grid h-5 w-5 place-items-center rounded-md bg-violet-500/20 text-violet-200">
                <Link2 className="h-3 w-3 shrink-0" />
              </span>
              <span className="font-mono">{invite.role}: {link}</span>
              <Copy className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
            </button>
            {isOwner ? (
              <form action={revokeWorkspaceInviteAction} className="ml-auto">
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <input type="hidden" name="token" value={invite.token} />
                <Button size="sm" className="h-7 border border-red-300/30 bg-red-500/15 text-red-100 hover:bg-red-500/25">
                  <Trash2 className="h-3.5 w-3.5" />
                  {locale === "ru" ? "Отозвать" : "Revoke"}
                </Button>
              </form>
            ) : null}
          </div>
        );
      })}
      {!invites.length ? <p className="text-sm text-zinc-500">{t(locale, "noActiveInvites")}</p> : null}
    </div>
  );
}

