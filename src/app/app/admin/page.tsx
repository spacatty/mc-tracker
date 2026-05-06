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
      <header>
        <h1 className="text-sm font-semibold uppercase tracking-[0.3em] text-red-300">Users and recovery</h1>
      </header>

      <form action={createUserAction} className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:grid-cols-[1fr_1fr_180px_auto]">
        <Input name="username" placeholder="Username" />
        <Input name="password" type="password" placeholder="Password" />
        <SelectInput
          name="role"
          defaultValue="user"
          options={[
            { value: "user", label: "user" },
            ...(actor.role === "superadmin" ? [{ value: "admin", label: "admin" }, { value: "superadmin", label: "superadmin" }] : []),
          ]}
        />
        <Button variant="destructive">Create user</Button>
      </form>

      <AdminUsersTable users={users} actorRole={actor.role} />
    </div>
  );
}
