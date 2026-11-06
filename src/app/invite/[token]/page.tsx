import Link from "next/link";
import { acceptInviteAction } from "@/app/actions";
import { BrandLogo, BrandWordmark } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { getWorkspaceInvite } from "@/lib/db";
import { getLocale } from "@/lib/i18n-server";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  await requireUser();
  const locale = await getLocale();
  const ru = locale === "ru";
  const { token } = await params;
  const invite = getWorkspaceInvite(token);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <BrandLogo className="h-6 w-6" />
          <BrandWordmark />
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-surface p-6">
          {invite ? (
            <form action={acceptInviteAction}>
              <input type="hidden" name="token" value={token} />
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{ru ? "Приглашение" : "Invitation"}</p>
              <h1 className="mt-2 flex items-center gap-2 text-[15px] font-semibold text-white">
                {invite.workspace_emoji ? <span aria-hidden="true">{invite.workspace_emoji}</span> : null}
                <span className="truncate">{invite.workspace_name}</span>
              </h1>
              <p className="mt-0.5 text-xs text-zinc-500">{ru ? "Вас пригласили в это пространство." : "You have been invited to join this workspace."}</p>
              <Button type="submit" className="mt-6 w-full">
                {ru ? "Принять приглашение" : "Accept invite"}
              </Button>
            </form>
          ) : (
            <div className="grid gap-4">
              <h1 className="text-[15px] font-semibold text-white">{ru ? "Приглашение недоступно" : "Invite unavailable"}</h1>
              <Alert tone="warning">{ru ? "Ссылка недействительна, истекла или уже использована." : "This link is invalid, has expired, or was already used."}</Alert>
              <Button asChild variant="secondary" className="w-full">
                <Link href="/app">{ru ? "Перейти в приложение" : "Go to the app"}</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
