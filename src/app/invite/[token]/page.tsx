import { acceptInviteAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { getWorkspaceInvite } from "@/lib/db";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  await requireUser();
  const { token } = await params;
  const invite = getWorkspaceInvite(token);

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,#701a75_0,#07070b_48%)] px-6">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-black/45 p-8 shadow-2xl shadow-fuchsia-950/30">
        {invite ? (
          <form action={acceptInviteAction} className="mt-5 space-y-4">
            <input type="hidden" name="token" value={token} />
            <h1 className="text-sm font-semibold uppercase tracking-[0.3em] text-fuchsia-300">{invite.workspace_emoji} {invite.workspace_name}</h1>
            <button className="w-full rounded-xl bg-fuchsia-500 px-4 py-3 font-semibold text-white hover:bg-fuchsia-400">Accept invite</button>
          </form>
        ) : (
          <div className="mt-5">
            <h1 className="text-sm font-semibold uppercase tracking-[0.3em] text-fuchsia-300">Invite unavailable</h1>
          </div>
        )}
      </div>
    </main>
  );
}
