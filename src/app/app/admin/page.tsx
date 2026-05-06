import { createUserAction } from "@/app/actions";
import { AdminUsersTable } from "@/components/admin-users-table";
import { requireUser } from "@/lib/auth";
import { listUsers } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/hidden-input";
import { Input } from "@/components/ui/input";

export default async function AdminPage() {
  const actor = await requireUser();
  const users = listUsers();

  if (actor.role === "user") {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8">
        <h1 className="text-sm font-semibold uppercase tracking-[0.3em] text-red-300">Admin</h1>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-red-500/10 via-violet-500/5 to-sky-500/10 p-6">
        <h1 className="text-sm font-semibold uppercase tracking-[0.3em] text-red-300">Users and recovery</h1>
      </header>

      <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
        <div className="border-b border-white/10 bg-black/20 p-5">
          <h2 className="text-lg font-semibold text-white">Create user</h2>
          <p className="mt-1 text-sm text-zinc-500">Create an account with role and credentials in a single step.</p>
        </div>
        <form action={createUserAction} className="grid gap-3 p-5 md:grid-cols-2">
          <label className="space-y-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            <span>Username</span>
            <Input name="username" placeholder="Username" required />
          </label>
          <label className="space-y-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            <span>Password</span>
            <Input name="password" type="password" placeholder="Password" required />
          </label>
          <label className="space-y-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            <span>Role</span>
            <SelectInput
              name="role"
              defaultValue="user"
              options={[
                { value: "user", label: "user" },
                ...(actor.role === "superadmin" ? [{ value: "admin", label: "admin" }, { value: "superadmin", label: "superadmin" }] : []),
              ]}
            />
          </label>
          <div className="flex items-end justify-end">
            <Button variant="destructive">Create user</Button>
          </div>
        </form>
      </section>

      <AdminUsersTable users={users} actorRole={actor.role} />
    </div>
  );
}
