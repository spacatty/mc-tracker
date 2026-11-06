"use client";

import { ArrowUpRight, Building2, KeyRound, Loader2, Pencil, Plus, SearchX, Trash2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deleteAccountAction,
  deleteVendorAction,
  saveAccountAction,
  saveVendorAction,
} from "@/app/vault-actions";
import { pluralRu, type Locale } from "@/lib/i18n";
import type { VaultAccount, Vendor } from "@/lib/vault/types";
import { LetterIcon } from "../capture/suggest-menu";
import { Alert } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { ConfirmDialog } from "../ui/dialog";
import { Field, FieldDescription } from "../ui/field";
import { Input, SearchInput, Textarea } from "../ui/input";
import { NativeSelect } from "../ui/native-select";
import { RowAction, RowActionMenu, RowActions } from "../ui/row-actions";
import { SectionCard } from "../ui/section-card";
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow, TableToolbar } from "../ui/table";
import {
  CredentialsFieldset,
  LegendAction,
  PasswordInput,
  SaveHint,
  SecretNotes,
  SecretRow,
  SetupTwoFactorNotice,
  TwoFactorPrompt,
  VaultDialog,
  hostOf,
  tx,
  useCredentialReveal,
} from "./shared";

function matches(query: string, ...values: string[]) {
  const needle = query.trim().toLowerCase();
  return !needle || values.some((value) => value.toLowerCase().includes(needle));
}

function Avatar({ text }: { text: string }) {
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-white/[0.06] bg-white/[0.03]" aria-hidden="true">
      <LetterIcon text={text} />
    </span>
  );
}

function CountText({ shown, total, locale }: { shown: number; total: number; locale: Locale }) {
  return (
    <span className="text-xs tabular-nums text-zinc-500">
      {shown === total ? total : tx(locale, `${shown} of ${total}`, `${shown} из ${total}`)}
    </span>
  );
}

type DeleteTarget = { id: number; name: string; inUse: number };

/** Delete confirmation. When entries use the record, it says how many will be unlinked (they keep their text). */
function DeleteConfirm({
  target,
  kind,
  locale,
  onClose,
  onDelete,
}: {
  target: DeleteTarget | null;
  kind: "vendor" | "account";
  locale: Locale;
  onClose: () => void;
  onDelete: (id: number) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const name = target?.name || "";
  const inUse = target?.inUse || 0;
  return (
    <ConfirmDialog
      open={Boolean(target)}
      onOpenChange={(next) => !next && onClose()}
      destructive
      pending={pending}
      title={kind === "vendor" ? tx(locale, `Delete vendor “${name}”?`, `Удалить поставщика «${name}»?`) : tx(locale, `Delete account “${name}”?`, `Удалить аккаунт «${name}»?`)}
      description={
        inUse
          ? tx(
              locale,
              `${inUse} ${inUse === 1 ? "entry uses" : "entries use"} it. They keep the name but lose the link.`,
              `Используется в ${inUse} ${pluralRu(inUse, "записи", "записях", "записях")}. Название в них сохранится, но связь с ним пропадёт.`,
            )
          : kind === "account"
            ? tx(locale, "Its encrypted credentials are deleted too. This cannot be undone.", "Зашифрованные учётные данные тоже будут удалены. Это действие нельзя отменить.")
            : tx(locale, "This cannot be undone.", "Это действие нельзя отменить.")
      }
      confirmLabel={tx(locale, "Delete", "Удалить")}
      cancelLabel={tx(locale, "Cancel", "Отмена")}
      onConfirm={() => {
        if (!target) return;
        startTransition(async () => {
          await onDelete(target.id);
          onClose();
        });
      }}
    />
  );
}

/* --------------------------------- Vendors --------------------------------- */

export function VendorsManager({ workspaceId, vendors, canEdit, locale }: { workspaceId: number; vendors: Vendor[]; canEdit: boolean; locale: Locale }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Vendor | "new" | null>(null);
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null);
  const visible = useMemo(() => vendors.filter((vendor) => matches(query, vendor.name, vendor.url, vendor.notes)), [vendors, query]);
  const newButton = canEdit ? (
    <Button type="button" size="sm" onClick={() => setEditing("new")}>
      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      {tx(locale, "New vendor", "Новый поставщик")}
    </Button>
  ) : null;

  return (
    <>
      <SectionCard flush className="flex min-h-[24rem] flex-1 flex-col" bodyClassName="flex min-h-0 flex-1 flex-col">
        <TableToolbar end={newButton}>
          <SearchInput
            size="sm"
            value={query}
            onChange={setQuery}
            placeholder={tx(locale, "Search vendors", "Поиск поставщиков")}
            clearLabel={tx(locale, "Clear search", "Очистить поиск")}
            className="max-w-sm flex-1"
          />
          <CountText shown={visible.length} total={vendors.length} locale={locale} />
        </TableToolbar>
        <Table bare fill minWidth={640}>
          <TableHeader>
            <TableRow>
              <TableHead>{tx(locale, "Vendor", "Поставщик")}</TableHead>
              <TableHead>URL</TableHead>
              <TableHead align="right">{tx(locale, "Accounts", "Аккаунты")}</TableHead>
              <TableHead align="right">{tx(locale, "Entries", "Записи")}</TableHead>
              <TableHead align="right" width="1%">
                <span className="sr-only">{tx(locale, "Actions", "Действия")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((vendor) => (
              <TableRow key={vendor.id} interactive={canEdit} onClick={canEdit ? () => setEditing(vendor) : undefined}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar text={vendor.name} />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-zinc-100">{vendor.name}</p>
                      {vendor.notes ? <p className="max-w-72 truncate text-[11.5px] text-zinc-500">{vendor.notes}</p> : null}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {vendor.url ? (
                    <a
                      href={vendor.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      className="inline-flex max-w-72 items-center gap-1 rounded-sm text-sky-300 transition hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
                    >
                      <span className="truncate">{hostOf(vendor.url)}</span>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    </a>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </TableCell>
                <TableCell align="right" className="tabular-nums">{vendor.accountCount || "—"}</TableCell>
                <TableCell align="right" className="tabular-nums">{vendor.entryCount || "—"}</TableCell>
                <TableCell align="right" className="w-[1%] whitespace-nowrap">
                  <RowActions>
                    {vendor.url ? (
                      <RowAction label={tx(locale, `Open ${hostOf(vendor.url)}`, `Открыть ${hostOf(vendor.url)}`)} icon={<ArrowUpRight />} href={vendor.url} external hidden="hover" />
                    ) : null}
                    {canEdit ? (
                      <RowActionMenu
                        label={tx(locale, `More actions for ${vendor.name}`, `Другие действия с «${vendor.name}»`)}
                        items={[
                          { label: tx(locale, "Edit", "Изменить"), icon: <Pencil />, onSelect: () => setEditing(vendor) },
                          "separator",
                          {
                            label: tx(locale, "Delete", "Удалить"),
                            icon: <Trash2 />,
                            destructive: true,
                            onSelect: () => setDeleting({ id: vendor.id, name: vendor.name, inUse: vendor.entryCount }),
                          },
                        ]}
                      />
                    ) : null}
                  </RowActions>
                </TableCell>
              </TableRow>
            ))}
            {vendors.length === 0 ? (
              <TableEmpty
                colSpan={5}
                icon={<Building2 />}
                title={tx(locale, "No vendors yet", "Поставщиков пока нет")}
                description={tx(
                  locale,
                  "Add the services you pay, with the URL you log in at. Entries link to a vendor by its name.",
                  "Добавьте сервисы, за которые платите, и ссылки для входа. Записи связываются с поставщиком по названию.",
                )}
              />
            ) : !visible.length ? (
              <TableEmpty
                colSpan={5}
                icon={<SearchX />}
                title={tx(locale, "Nothing matches", "Ничего не найдено")}
                action={
                  <Button type="button" variant="ghost" size="sm" onClick={() => setQuery("")}>
                    {tx(locale, "Clear search", "Очистить поиск")}
                  </Button>
                }
              />
            ) : null}
          </TableBody>
        </Table>
      </SectionCard>

      {editing ? (
        <VendorDialog
          key={editing === "new" ? "new" : editing.id}
          workspaceId={workspaceId}
          vendor={editing === "new" ? null : editing}
          locale={locale}
          onClose={() => setEditing(null)}
        />
      ) : null}
      <DeleteConfirm
        target={deleting}
        kind="vendor"
        locale={locale}
        onClose={() => setDeleting(null)}
        onDelete={async (id) => {
          const result = await deleteVendorAction(workspaceId, id);
          if (!result.ok) toast.error(result.error);
          router.refresh();
        }}
      />
    </>
  );
}

function VendorDialog({ workspaceId, vendor, locale, onClose }: { workspaceId: number; vendor: Vendor | null; locale: Locale; onClose: () => void }) {
  const router = useRouter();
  const id = useId();
  const [name, setName] = useState(vendor?.name || "");
  const [url, setUrl] = useState(vendor?.url || "");
  const [notes, setNotes] = useState(vendor?.notes || "");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const formId = `${id}-form`;

  function submit() {
    startTransition(async () => {
      const result = await saveVendorAction({ workspaceId, id: vendor?.id, name, url, notes });
      if (!result.ok) return setError(result.error);
      toast.success(vendor ? tx(locale, "Vendor saved", "Поставщик сохранён") : tx(locale, `Added ${name}`, `Добавлено: «${name}»`));
      onClose();
      router.refresh();
    });
  }

  return (
    <VaultDialog
      open
      onOpenChange={(open) => !open && onClose()}
      tone="sky"
      icon={<Building2 />}
      title={vendor ? tx(locale, "Edit vendor", "Изменить поставщика") : tx(locale, "New vendor", "Новый поставщик")}
      description={tx(locale, "Entries with this vendor name use its URL for Quick login.", "Записи с этим названием поставщика используют его URL для быстрого входа.")}
      hint={<SaveHint locale={locale} />}
      footer={
        <>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {tx(locale, "Cancel", "Отмена")}
          </Button>
          <Button type="submit" form={formId} size="sm" disabled={pending || !name.trim()}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
            {tx(locale, "Save", "Сохранить")}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Field label={tx(locale, "Name", "Название")} htmlFor={`${id}-name`} required>
          <Input id={`${id}-name`} autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Hetzner" />
        </Field>
        <Field label={tx(locale, "Login URL", "URL для входа")} htmlFor={`${id}-url`}>
          <Input id={`${id}-url`} value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://accounts.hetzner.com/login" inputMode="url" />
        </Field>
        <Field label={tx(locale, "Notes", "Заметки")} htmlFor={`${id}-notes`}>
          <Textarea
            id={`${id}-notes`}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            className="min-h-16"
            placeholder={tx(locale, "Support contacts, billing quirks…", "Контакты поддержки, особенности оплаты…")}
          />
        </Field>
        {error ? <Alert tone="danger">{error}</Alert> : null}
      </form>
    </VaultDialog>
  );
}

/* --------------------------------- Accounts -------------------------------- */

export function AccountsManager({
  workspaceId,
  accounts,
  vendors,
  canEdit,
  locale,
}: {
  workspaceId: number;
  accounts: VaultAccount[];
  vendors: Vendor[];
  canEdit: boolean;
  locale: Locale;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [editing, setEditing] = useState<VaultAccount | "new" | null>(null);
  const [viewing, setViewing] = useState<VaultAccount | null>(null);
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null);
  const visible = useMemo(
    () =>
      accounts.filter(
        (account) =>
          (vendorFilter === "all" || String(account.vendorId || "none") === vendorFilter) &&
          matches(query, account.name, account.vendorName, account.loginUrl, account.vendorUrl),
      ),
    [accounts, query, vendorFilter],
  );
  const newButton = canEdit ? (
    <Button type="button" size="sm" onClick={() => setEditing("new")}>
      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      {tx(locale, "New account", "Новый аккаунт")}
    </Button>
  ) : null;

  return (
    <>
      <SectionCard flush className="flex min-h-[24rem] flex-1 flex-col" bodyClassName="flex min-h-0 flex-1 flex-col">
        <TableToolbar end={newButton}>
          <SearchInput
            size="sm"
            value={query}
            onChange={setQuery}
            placeholder={tx(locale, "Search accounts", "Поиск аккаунтов")}
            clearLabel={tx(locale, "Clear search", "Очистить поиск")}
            className="max-w-sm flex-1"
          />
          {vendors.length ? (
            <NativeSelect size="sm" value={vendorFilter} onChange={setVendorFilter} ariaLabel={tx(locale, "Vendor", "Поставщик")} className="w-44">
              <option value="all">{tx(locale, "All vendors", "Все поставщики")}</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
              <option value="none">{tx(locale, "No vendor", "Без поставщика")}</option>
            </NativeSelect>
          ) : null}
          <CountText shown={visible.length} total={accounts.length} locale={locale} />
        </TableToolbar>
        <Table bare fill minWidth={720}>
          <TableHeader>
            <TableRow>
              <TableHead>{tx(locale, "Account", "Аккаунт")}</TableHead>
              <TableHead>{tx(locale, "Vendor", "Поставщик")}</TableHead>
              <TableHead>{tx(locale, "Credentials", "Учётные данные")}</TableHead>
              <TableHead align="right">{tx(locale, "Entries", "Записи")}</TableHead>
              <TableHead align="right" width="1%">
                <span className="sr-only">{tx(locale, "Actions", "Действия")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((account) => {
              const url = account.loginUrl || account.vendorUrl;
              const none = !account.hasLogin && !account.hasPassword && !account.hasNotes;
              return (
                <TableRow key={account.id} interactive onClick={() => setViewing(account)}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar text={account.name} />
                      <span className="truncate font-medium text-zinc-100">{account.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="truncate text-zinc-300">{account.vendorName || <span className="text-zinc-600">—</span>}</p>
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          className="inline-flex max-w-60 items-center gap-1 rounded-sm text-[11.5px] text-sky-300 transition hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
                        >
                          <span className="truncate">{hostOf(url)}</span>
                          <ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden="true" />
                        </a>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {account.hasLogin ? <Badge tone="success">{tx(locale, "login", "логин")}</Badge> : null}
                      {account.hasPassword ? <Badge tone="success">{tx(locale, "password", "пароль")}</Badge> : null}
                      {account.hasNotes ? <Badge tone="success">{tx(locale, "notes", "заметки")}</Badge> : null}
                      {none ? <span className="text-xs text-zinc-600">{tx(locale, "none saved", "не сохранены")}</span> : null}
                    </div>
                  </TableCell>
                  <TableCell align="right" className="tabular-nums">{account.entryCount || "—"}</TableCell>
                  <TableCell align="right" className="w-[1%] whitespace-nowrap">
                    <RowActions>
                      {canEdit ? (
                        <RowAction
                          label={tx(locale, "View credentials", "Показать учётные данные")}
                          icon={<KeyRound />}
                          tone="accent"
                          hidden="hover"
                          onClick={() => setViewing(account)}
                        />
                      ) : null}
                      {url ? (
                        <RowAction label={tx(locale, `Open ${hostOf(url)}`, `Открыть ${hostOf(url)}`)} icon={<ArrowUpRight />} href={url} external hidden="hover" />
                      ) : null}
                      {canEdit ? (
                        <RowActionMenu
                          label={tx(locale, `More actions for ${account.name}`, `Другие действия с «${account.name}»`)}
                          items={[
                            { label: tx(locale, "Edit", "Изменить"), icon: <Pencil />, onSelect: () => setEditing(account) },
                            "separator",
                            {
                              label: tx(locale, "Delete", "Удалить"),
                              icon: <Trash2 />,
                              destructive: true,
                              onSelect: () => setDeleting({ id: account.id, name: account.name, inUse: account.entryCount }),
                            },
                          ]}
                        />
                      ) : null}
                    </RowActions>
                  </TableCell>
                </TableRow>
              );
            })}
            {accounts.length === 0 ? (
              <TableEmpty
                colSpan={5}
                icon={<UserRound />}
                title={tx(locale, "No accounts yet", "Аккаунтов пока нет")}
                description={tx(
                  locale,
                  "Save the login for each vendor account. Credentials are encrypted before they are stored.",
                  "Сохраните логин для каждого аккаунта у поставщика. Учётные данные шифруются перед сохранением.",
                )}
              />
            ) : !visible.length ? (
              <TableEmpty
                colSpan={5}
                icon={<SearchX />}
                title={tx(locale, "Nothing matches", "Ничего не найдено")}
                action={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setQuery("");
                      setVendorFilter("all");
                    }}
                  >
                    {tx(locale, "Clear filters", "Сбросить фильтры")}
                  </Button>
                }
              />
            ) : null}
          </TableBody>
        </Table>
      </SectionCard>

      {editing ? (
        <AccountDialog
          key={editing === "new" ? "new" : editing.id}
          workspaceId={workspaceId}
          account={editing === "new" ? null : editing}
          vendors={vendors}
          locale={locale}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {viewing ? (
        <ViewAccountDialog
          key={viewing.id}
          workspaceId={workspaceId}
          account={viewing}
          canEdit={canEdit}
          locale={locale}
          onClose={() => setViewing(null)}
          onEdit={() => {
            setViewing(null);
            setEditing(viewing);
          }}
        />
      ) : null}
      <DeleteConfirm
        target={deleting}
        kind="account"
        locale={locale}
        onClose={() => setDeleting(null)}
        onDelete={async (id) => {
          const result = await deleteAccountAction(workspaceId, id);
          if (!result.ok) toast.error(result.error);
          router.refresh();
        }}
      />
    </>
  );
}

function ViewAccountDialog({
  workspaceId,
  account,
  canEdit,
  locale,
  onClose,
  onEdit,
}: {
  workspaceId: number;
  account: VaultAccount;
  canEdit: boolean;
  locale: Locale;
  onClose: () => void;
  onEdit: () => void;
}) {
  const { state, reveal } = useCredentialReveal(workspaceId);
  useEffect(() => {
    if (canEdit) void reveal(account.id);
  }, [canEdit, account.id, reveal]);
  const url = account.loginUrl || account.vendorUrl;
  return (
    <VaultDialog
      open
      onOpenChange={(open) => !open && onClose()}
      icon={<KeyRound />}
      title={account.name}
      description={account.vendorName || tx(locale, "No vendor", "Без поставщика")}
      footer={
        canEdit || url ? (
          <>
            {canEdit ? (
              <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                {tx(locale, "Edit", "Изменить")}
              </Button>
            ) : null}
            {url ? (
              <Button type="button" size="sm" onClick={() => window.open(url, "_blank", "noopener,noreferrer")}>
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                {tx(locale, "Open", "Открыть")} {hostOf(url)}
              </Button>
            ) : null}
          </>
        ) : null
      }
    >
      <CredentialsFieldset locale={locale}>
        {!canEdit ? (
          <p className="text-xs text-zinc-500">{tx(locale, "Only workspace owners and editors can view credentials.", "Учётные данные видят только владельцы и редакторы пространства.")}</p>
        ) : state.status === "shown" ? (
          <div className="space-y-1.5">
            <SecretRow label={tx(locale, "Login", "Логин")} value={state.credentials.login} locale={locale} />
            <SecretRow label={tx(locale, "Password", "Пароль")} value={state.credentials.password} secret locale={locale} />
            {state.credentials.notes ? <SecretNotes>{state.credentials.notes}</SecretNotes> : null}
          </div>
        ) : state.status === "code" ? (
          <TwoFactorPrompt locale={locale} pending={false} error={state.error} onSubmit={(code) => void reveal(account.id, code)} />
        ) : state.status === "setup" ? (
          <SetupTwoFactorNotice locale={locale} message={state.message} />
        ) : state.status === "error" ? (
          <Alert tone="danger" className="text-xs">
            {state.message}
          </Alert>
        ) : (
          <div className="flex h-20 items-center justify-center text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span className="sr-only">{tx(locale, "Loading", "Загрузка")}</span>
          </div>
        )}
      </CredentialsFieldset>
    </VaultDialog>
  );
}

function AccountDialog({
  workspaceId,
  account,
  vendors,
  locale,
  onClose,
}: {
  workspaceId: number;
  account: VaultAccount | null;
  vendors: Vendor[];
  locale: Locale;
  onClose: () => void;
}) {
  const router = useRouter();
  const id = useId();
  const formId = `${id}-form`;
  const { state, reveal } = useCredentialReveal(workspaceId);
  const [vendorId, setVendorId] = useState(String(account?.vendorId || vendors[0]?.id || ""));
  const [name, setName] = useState(account?.name || "");
  const [loginUrl, setLoginUrl] = useState(account?.loginUrl || "");
  // Undefined means "unchanged": editing never needs the old secret unless the user asks to see it.
  const [login, setLogin] = useState<string | undefined>(account ? undefined : "");
  const [password, setPassword] = useState<string | undefined>(account ? undefined : "");
  const [notes, setNotes] = useState<string | undefined>(account ? undefined : "");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const vendor = vendors.find((item) => String(item.id) === vendorId);
  const hasStored = Boolean(account && (account.hasLogin || account.hasPassword || account.hasNotes));

  async function loadCurrent(code?: string) {
    if (!account) return;
    const credentials = await reveal(account.id, code);
    if (credentials) {
      setLogin(credentials.login);
      setPassword(credentials.password);
      setNotes(credentials.notes);
    }
  }

  function submit() {
    startTransition(async () => {
      const result = await saveAccountAction({
        workspaceId,
        id: account?.id,
        vendorId: vendorId ? Number(vendorId) : null,
        name,
        loginUrl,
        login,
        password,
        notes,
      });
      if (!result.ok) return setError(result.error);
      toast.success(account ? tx(locale, "Account saved", "Аккаунт сохранён") : tx(locale, `Added ${name}`, `Добавлено: «${name}»`));
      onClose();
      router.refresh();
    });
  }

  const unchanged = tx(locale, "•••••• unchanged", "•••••• без изменений");
  const showCurrent =
    hasStored && login === undefined && state.status !== "code" ? (
      <LegendAction onClick={() => void loadCurrent()} disabled={state.status === "loading"}>
        {state.status === "loading" ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <KeyRound className="h-3 w-3" aria-hidden="true" />}
        {tx(locale, "Show current", "Показать текущие")}
      </LegendAction>
    ) : null;

  return (
    <VaultDialog
      open
      onOpenChange={(open) => !open && onClose()}
      icon={<UserRound />}
      title={account ? tx(locale, "Edit account", "Изменить аккаунт") : tx(locale, "New account", "Новый аккаунт")}
      description={tx(locale, "Login, password and notes are encrypted at rest.", "Логин, пароль и заметки хранятся в зашифрованном виде.")}
      hint={<SaveHint locale={locale} />}
      footer={
        <>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {tx(locale, "Cancel", "Отмена")}
          </Button>
          <Button type="submit" form={formId} size="sm" disabled={pending || !name.trim()}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
            {tx(locale, "Save", "Сохранить")}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tx(locale, "Vendor", "Поставщик")} htmlFor={`${id}-vendor`}>
            <NativeSelect id={`${id}-vendor`} value={vendorId} onChange={setVendorId} ariaLabel={tx(locale, "Vendor", "Поставщик")}>
              <option value="">{tx(locale, "No vendor", "Без поставщика")}</option>
              {vendors.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={tx(locale, "Account name", "Название аккаунта")} htmlFor={`${id}-name`} required>
            <Input id={`${id}-name`} autoFocus={!account} value={name} onChange={(event) => setName(event.target.value)} placeholder="ops@company" />
          </Field>
          <FieldDescription className="-mt-2 sm:col-span-2">
            {tx(locale, "Entries whose account and vendor match these names get Quick login.", "Записи с такими же названиями аккаунта и поставщика получат быстрый вход.")}
          </FieldDescription>
          <Field label={tx(locale, "Login URL", "URL для входа")} htmlFor={`${id}-url`} hint={tx(locale, "Optional. Defaults to the vendor’s URL.", "Необязательно. По умолчанию — URL поставщика.")} className="sm:col-span-2">
            <Input id={`${id}-url`} value={loginUrl} onChange={(event) => setLoginUrl(event.target.value)} placeholder={vendor?.url || "https://"} inputMode="url" />
          </Field>
        </div>

        <CredentialsFieldset
          locale={locale}
          action={showCurrent}
          description={state.status === "shown" ? tx(locale, "Showing the stored values. Clear a field to remove it.", "Показаны сохранённые значения. Очистите поле, чтобы удалить его.") : undefined}
        >
          {state.status === "code" ? (
            <TwoFactorPrompt locale={locale} pending={false} error={state.error} onSubmit={(code) => void loadCurrent(code)} />
          ) : state.status === "setup" ? (
            <SetupTwoFactorNotice locale={locale} message={state.message} />
          ) : state.status === "error" ? (
            <Alert tone="danger" className="text-xs">
              {state.message}
            </Alert>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tx(locale, "Login", "Логин")} htmlFor={`${id}-login`}>
              <Input
                id={`${id}-login`}
                value={login ?? ""}
                onChange={(event) => setLogin(event.target.value)}
                autoComplete="off"
                placeholder={login === undefined && account?.hasLogin ? unchanged : tx(locale, "Login or email", "Логин или email")}
              />
            </Field>
            <Field label={tx(locale, "Password", "Пароль")} htmlFor={`${id}-password`}>
              <PasswordInput
                id={`${id}-password`}
                locale={locale}
                value={password ?? ""}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                placeholder={password === undefined && account?.hasPassword ? unchanged : undefined}
              />
            </Field>
          </div>
          <Field label={tx(locale, "Notes", "Заметки")} htmlFor={`${id}-notes`}>
            <Textarea
              id={`${id}-notes`}
              value={notes ?? ""}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              className="min-h-16"
              placeholder={notes === undefined && account?.hasNotes ? unchanged : tx(locale, "Recovery codes, security answers…", "Коды восстановления, ответы на контрольные вопросы…")}
            />
          </Field>
        </CredentialsFieldset>
        {error ? <Alert tone="danger">{error}</Alert> : null}
      </form>
    </VaultDialog>
  );
}
