"use client";

import { Crown, Loader2, Lock, ShieldCheck, UserCog } from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { saveUserAdminChangesAction } from "@/app/actions";
import type { Locale } from "@/lib/i18n";
import type { User, UserRole } from "@/lib/types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Field, FieldDescription, FieldRow } from "./ui/field";
import { CheckboxInput, SelectInput } from "./ui/hidden-input";
import { Input } from "./ui/input";
import { RowAction, RowActions } from "./ui/row-actions";
import { SectionCard } from "./ui/section-card";
import { Switch } from "./ui/switch";
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from "./ui/table";
import { Tooltip } from "./ui/tooltip";

function tx(locale: Locale, en: string, ru: string) {
  return locale === "ru" ? ru : en;
}

function SubmitButton({ locale }: { locale: Locale }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
      {tx(locale, "Save changes", "Сохранить изменения")}
    </Button>
  );
}

export function AdminUsersTable({
  users,
  actorRole,
  locale,
}: {
  users: User[];
  actorRole: UserRole;
  locale: Locale;
}) {
  const [editingUser, setEditingUser] = useState<User | null>(null);

  return (
    <>
      <SectionCard flush className="flex min-h-[24rem] flex-1 flex-col" bodyClassName="flex min-h-0 flex-1 flex-col" title={tx(locale, "Users", "Пользователи")} description={tx(locale, "Open a user to change role, premium, password or 2FA.", "Откройте пользователя, чтобы изменить роль, Premium, пароль или 2FA.")}>
        <Table bare fill minWidth={640}>
          <TableHeader>
            <TableRow>
              <TableHead>{tx(locale, "User", "Пользователь")}</TableHead>
              <TableHead>{tx(locale, "Role", "Роль")}</TableHead>
              <TableHead>{tx(locale, "Plan", "Тариф")}</TableHead>
              <TableHead>2FA</TableHead>
              <TableHead>{tx(locale, "Created", "Создан")}</TableHead>
              <TableHead align="right" width="1%">
                <span className="sr-only">{tx(locale, "Actions", "Действия")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const manageable = actorRole === "superadmin" || user.role === "user";
              return (
                <TableRow key={user.id} interactive={manageable} onClick={manageable ? () => setEditingUser(user) : undefined}>
                  <TableCell primary>{user.username}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{user.role}</Badge>
                  </TableCell>
                  <TableCell>
                    {user.premium ? (
                      <Badge tone="warning" icon={<Crown />}>
                        Premium
                      </Badge>
                    ) : (
                      <span className="text-zinc-500">{tx(locale, "Standard", "Стандарт")}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.totpEnabled ? (
                      <Badge tone="success" icon={<ShieldCheck />}>
                        {tx(locale, "On", "Вкл.")}
                      </Badge>
                    ) : (
                      <span className="text-zinc-500">{tx(locale, "Off", "Выкл.")}</span>
                    )}
                  </TableCell>
                  <TableCell muted className="tabular-nums">
                    {new Date(user.createdAt).toLocaleDateString(locale === "ru" ? "ru-RU" : "en-GB")}
                  </TableCell>
                  <TableCell align="right" className="w-[1%] whitespace-nowrap">
                    <RowActions>
                      {manageable ? (
                        <RowAction label={tx(locale, `Manage ${user.username}`, `Управление пользователем ${user.username}`)} icon={<UserCog />} onClick={() => setEditingUser(user)} />
                      ) : (
                        <Tooltip label={tx(locale, "Only a superadmin can manage this user", "Управлять этим пользователем может только superadmin")}>
                          <span tabIndex={0} aria-label={tx(locale, "Locked", "Недоступно")} className="inline-grid h-7 w-7 place-items-center rounded-md text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40">
                            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                          </span>
                        </Tooltip>
                      )}
                    </RowActions>
                  </TableCell>
                </TableRow>
              );
            })}
            {!users.length ? <TableEmpty colSpan={6} title={tx(locale, "No users", "Пользователей нет")} /> : null}
          </TableBody>
        </Table>
      </SectionCard>

      <Dialog open={Boolean(editingUser)} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent size="md">
          {editingUser ? (
            <>
              <DialogHeader icon={<UserCog />}>
                <DialogTitle className="truncate">{tx(locale, `Manage ${editingUser.username}`, `Управление пользователем ${editingUser.username}`)}</DialogTitle>
                <DialogDescription>{tx(locale, "Update access, premium, password, and account recovery.", "Измените доступ, Premium, пароль и восстановление аккаунта.")}</DialogDescription>
              </DialogHeader>
              <form
                key={editingUser.id}
                action={async (formData) => {
                  await saveUserAdminChangesAction(formData);
                  toast.success(tx(locale, `Saved ${editingUser.username}`, `Изменения для ${editingUser.username} сохранены`));
                  setEditingUser(null);
                }}
                className="flex min-h-0 flex-1 flex-col"
              >
                <input type="hidden" name="userId" value={editingUser.id} />
                <DialogBody className="grid gap-4">
                  <Field label={tx(locale, "Role", "Роль")} htmlFor="admin-edit-role" hint={actorRole === "superadmin" ? undefined : tx(locale, "Only a superadmin can change roles.", "Менять роли может только superadmin.")}>
                    {actorRole === "superadmin" ? (
                      <SelectInput
                        name="role"
                        triggerId="admin-edit-role"
                        defaultValue={editingUser.role}
                        options={[
                          { value: "user", label: "user" },
                          { value: "admin", label: "admin" },
                          { value: "superadmin", label: "superadmin" },
                        ]}
                      />
                    ) : (
                      <p className="flex h-9 items-center rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 text-sm text-zinc-400">{editingUser.role}</p>
                    )}
                  </Field>
                  <Field label={tx(locale, "New password", "Новый пароль")} htmlFor="admin-edit-password" hint={tx(locale, "Leave blank to keep the current password.", "Оставьте пустым, чтобы сохранить текущий пароль.")}>
                    <Input id="admin-edit-password" name="password" type="password" autoComplete="new-password" />
                  </Field>
                  <div className="-mx-5 divide-y divide-white/[0.06] border-y border-white/[0.06]">
                    <FieldRow label="Premium" description={tx(locale, "Unlocks premium features for this user.", "Открывает пользователю функции Premium.")} htmlFor="admin-edit-premium" className="py-3">
                      <Switch id="admin-edit-premium" name="premium" value="1" defaultChecked={editingUser.premium} />
                    </FieldRow>
                    <div className="px-5 py-3">
                      <CheckboxInput name="resetTotpNow" id="admin-edit-reset-totp">
                        <span className="text-[13px] text-zinc-300">{tx(locale, "Reset 2FA now", "Сбросить 2FA сейчас")}</span>
                      </CheckboxInput>
                      <FieldDescription className="mt-1 pl-6">
                        {editingUser.totpEnabled ? tx(locale, "Removes the authenticator; they can set it up again.", "Аутентификатор будет удалён — пользователь сможет настроить его заново.") : tx(locale, "2FA is off for this user.", "У этого пользователя 2FA выключена.")}
                      </FieldDescription>
                    </div>
                  </div>
                </DialogBody>
                <DialogFooter>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditingUser(null)}>
                    {tx(locale, "Cancel", "Отмена")}
                  </Button>
                  <SubmitButton locale={locale} />
                </DialogFooter>
              </form>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
