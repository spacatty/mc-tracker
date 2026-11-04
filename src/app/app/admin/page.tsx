import { createUserAction } from "@/app/actions";
import { AdminUsersTable } from "@/components/admin-users-table";
import { requireUser } from "@/lib/auth";
import { listUsers } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/hidden-input";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";

export default async function AdminPage() {
  const actor = await requireUser();
  const users = listUsers();

  if (actor.role === "user") {
    return (
      <PageHeader title="Admin" />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Admin" description="Users and recovery" />

      <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-surface">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-[15px] font-semibold text-white">Create user</h2>
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
            <Button>Create user</Button>
          </div>
        </form>
      </section>

      <AdminUsersTable users={users} actorRole={actor.role} />
    </div>
  );
}
