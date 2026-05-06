"use client";

import { useState } from "react";
import { saveUserAdminChangesAction } from "@/app/actions";
import type { User, UserRole } from "@/lib/types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { SelectInput } from "./ui/hidden-input";
import { Input } from "./ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

export function AdminUsersTable({
  users,
  actorRole,
}: {
  users: User[];
  actorRole: UserRole;
}) {
  const [editingUser, setEditingUser] = useState<User | null>(null);

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="border-b border-white/10 p-5">
          <h2 className="text-lg font-semibold text-white">Users table</h2>
          <p className="mt-1 text-sm text-zinc-500">Edit users from a single actions dialog.</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Premium</TableHead>
              <TableHead>2FA</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const manageable = actorRole === "superadmin" || user.role === "user";
              return (
                <TableRow key={user.id}>
                  <TableCell className="font-semibold text-white">{user.username}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{user.role}</Badge>
                  </TableCell>
                  <TableCell>{user.premium ? <Badge variant="success">Premium</Badge> : <Badge variant="secondary">Standard</Badge>}</TableCell>
                  <TableCell>{user.totpEnabled ? "Enabled" : "Off"}</TableCell>
                  <TableCell className="text-zinc-500">{new Date(user.createdAt).toLocaleDateString("en-GB")}</TableCell>
                  <TableCell className="text-right">
                    {manageable ? (
                      <Button size="sm" variant="secondary" onClick={() => setEditingUser(user)}>
                        Manage
                      </Button>
                    ) : (
                      <span className="text-xs text-zinc-500">Locked</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </section>

      {editingUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <button type="button" className="absolute inset-0" aria-label="Close edit user modal" onClick={() => setEditingUser(null)} />
          <section className="relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b12]">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Manage {editingUser.username}</h3>
                <p className="text-sm text-zinc-500">Update access, premium, password, and account recovery.</p>
              </div>
              <Button type="button" variant="ghost" onClick={() => setEditingUser(null)}>
                Close
              </Button>
            </div>

            <form
              action={saveUserAdminChangesAction}
              className="p-5"
              onSubmit={(event) => {
                const ok = window.confirm(`Save changes for ${editingUser.username}?`);
                if (!ok) event.preventDefault();
              }}
            >
              <input type="hidden" name="userId" value={editingUser.id} />
              <Table>
                <TableBody>
                  <TableRow>
                    <TableHead className="w-44">Role</TableHead>
                    <TableCell>
                      {actorRole === "superadmin" ? (
                        <SelectInput
                          name="role"
                          defaultValue={editingUser.role}
                          options={[
                            { value: "user", label: "user" },
                            { value: "admin", label: "admin" },
                            { value: "superadmin", label: "superadmin" },
                          ]}
                        />
                      ) : (
                        <span className="text-sm text-zinc-400">Superadmin only ({editingUser.role})</span>
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableHead>Premium</TableHead>
                    <TableCell>
                      <SelectInput
                        name="premium"
                        defaultValue={editingUser.premium ? "1" : "0"}
                        options={[
                          { value: "0", label: "Standard" },
                          { value: "1", label: "Premium" },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableHead>Password</TableHead>
                    <TableCell>
                      <Input name="password" type="password" placeholder="Leave blank to keep current password" />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableHead>Recovery / 2FA</TableHead>
                    <TableCell>
                      <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
                        <input name="resetTotpNow" type="checkbox" />
                        Reset 2FA now
                      </label>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <div className="mt-5 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="destructive">
                  Save changes
                </Button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
