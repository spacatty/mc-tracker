"use client";

import { ArrowUpRight, Building2, DownloadCloud, KeyRound, Loader2, Pencil, Plus, Search, Trash2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deleteAccountAction,
  deleteVendorAction,
  importVendorsFromEntriesAction,
  saveAccountAction,
  saveVendorAction,
} from "@/app/vault-actions";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { VaultAccount, Vendor } from "@/lib/vault/types";
import { Kbd } from "../capture/shared";
import { LetterIcon } from "../capture/suggest-menu";
import { Button } from "../ui/button";
import { EmptyState } from "../ui/empty-state";
import { Input, Textarea } from "../ui/input";
import { NativeSelect } from "../ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { FieldLabel, SecretRow, SetupTwoFactorNotice, TwoFactorPrompt, VaultDialog, hostOf, tx, useCredentialReveal } from "./shared";

function matches(query: string, ...values: string[]) {
  const needle = query.trim().toLowerCase();
  return !needle || values.some((value) => value.toLowerCase().includes(needle));
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="relative block w-full max-w-xs">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-8 pl-8 text-[13px]" />
    </label>
  );
}

function Avatar({ text }: { text: string }) {
  return (
    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-white/[0.06] bg-white/[0.03]">
      <LetterIcon text={text} />
    </span>
  );
}

function ImportFromEntriesButton({ workspaceId, locale }: { workspaceId: number; locale: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={pending}
      title={tx(locale, "Create vendors and accounts from the names already used on entries", "Создать поставщиков и аккаунты из записей")}
      onClick={() =>
        startTransition(async () => {
          const result = await importVendorsFromEntriesAction(workspaceId);
          if (!result.ok) return void toast.error(result.error);
          toast.success(
            result.vendors || result.accounts
              ? tx(locale, `Added ${result.vendors} vendors and ${result.accounts} accounts from entries`, `Добавлено: поставщиков ${result.vendors}, аккаунтов ${result.accounts}`)
              : tx(locale, "Everything on your entries is already here", "Все поставщики и аккаунты уже добавлены"),
          );
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DownloadCloud className="h-3.5 w-3.5" />}
      {tx(locale, "Pull from entries", "Взять из записей")}
    </Button>
  );
}

function DeleteButton({ label, locale, onConfirm }: { label: string; locale: Locale; onConfirm: () => Promise<void> }) {
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onBlur={() => setArmed(false)}
      onClick={() => {
        if (!armed) return setArmed(true);
        startTransition(onConfirm);
      }}
      className={cn(
        "rounded-md p-1.5 text-zinc-500 transition hover:bg-red-500/15 hover:text-red-200",
        armed && "bg-red-500/15 px-2 text-[11px] font-medium text-red-200",
      )}
      aria-label={tx(locale, `Delete ${label}`, `Удалить ${label}`)}
      title={armed ? undefined : tx(locale, "Delete", "Удалить")}
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : armed ? tx(locale, "Confirm", "Удалить?") : <Trash2 className="h-3.5 w-3.5" />}
    </button>
  );
}

/* --------------------------------- Vendors --------------------------------- */

export function VendorsManager({ workspaceId, vendors, canEdit, locale }: { workspaceId: number; vendors: Vendor[]; canEdit: boolean; locale: Locale }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Vendor | "new" | null>(null);
  const visible = useMemo(() => vendors.filter((vendor) => matches(query, vendor.name, vendor.url, vendor.notes)), [vendors, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={query} onChange={setQuery} placeholder={tx(locale, "Search vendors", "Поиск поставщиков")} />
        {canEdit ? (
          <div className="ml-auto flex gap-2">
            <ImportFromEntriesButton workspaceId={workspaceId} locale={locale} />
            <Button type="button" size="sm" onClick={() => setEditing("new")}>
              <Plus className="h-3.5 w-3.5" />
              {tx(locale, "New vendor", "Новый поставщик")}
            </Button>
          </div>
        ) : null}
      </div>

      {vendors.length === 0 ? (
        <EmptyState
          icon={<Building2 />}
          title={tx(locale, "No vendors yet", "Поставщиков пока нет")}
          description={tx(locale, "Add the services you pay, with the URL you log in at. Entries link to a vendor by its name.", "Добавьте сервисы, которые оплачиваете, и URL для входа. Записи связываются с поставщиком по имени.")}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tx(locale, "Vendor", "Поставщик")}</TableHead>
              <TableHead>URL</TableHead>
              <TableHead className="text-center">{tx(locale, "Accounts", "Аккаунты")}</TableHead>
              <TableHead className="text-center">{tx(locale, "Entries", "Записи")}</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((vendor) => (
              <TableRow key={vendor.id} className="group">
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar text={vendor.name} />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-zinc-100">{vendor.name}</p>
                      {vendor.notes ? <p className="max-w-64 truncate text-xs text-zinc-500">{vendor.notes}</p> : null}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {vendor.url ? (
                    <a href={vendor.url} target="_blank" rel="noreferrer" className="inline-flex max-w-72 items-center gap-1 text-sky-300 hover:text-sky-200">
                      <span className="truncate">{hostOf(vendor.url)}</span>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                    </a>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </TableCell>
                <TableCell className="text-center tabular-nums">{vendor.accountCount || "—"}</TableCell>
                <TableCell className="text-center tabular-nums">{vendor.entryCount || "—"}</TableCell>
                <TableCell>
                  {canEdit ? (
                    <div className="flex justify-end gap-0.5 opacity-60 transition group-hover:opacity-100">
                      <button type="button" onClick={() => setEditing(vendor)} className="rounded-md p-1.5 text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200" aria-label={tx(locale, "Edit", "Изменить")}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <DeleteButton
                        label={vendor.name}
                        locale={locale}
                        onConfirm={async () => {
                          const result = await deleteVendorAction(workspaceId, vendor.id);
                          if (!result.ok) toast.error(result.error);
                          router.refresh();
                        }}
                      />
                    </div>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {editing ? (
        <VendorDialog
          key={editing === "new" ? "new" : editing.id}
          workspaceId={workspaceId}
          vendor={editing === "new" ? null : editing}
          locale={locale}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function VendorDialog({ workspaceId, vendor, locale, onClose }: { workspaceId: number; vendor: Vendor | null; locale: Locale; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(vendor?.name || "");
  const [url, setUrl] = useState(vendor?.url || "");
  const [notes, setNotes] = useState(vendor?.notes || "");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await saveVendorAction({ workspaceId, id: vendor?.id, name, url, notes });
      if (!result.ok) return setError(result.error);
      toast.success(vendor ? tx(locale, "Vendor saved", "Поставщик сохранён") : tx(locale, `Added ${name}`, `Добавлен ${name}`));
      onClose();
      router.refresh();
    });
  }

  return (
    <VaultDialog
      open
      onOpenChange={(open) => !open && onClose()}
      tone="sky"
      icon={<Building2 className="h-4 w-4" />}
      title={vendor ? tx(locale, "Edit vendor", "Изменить поставщика") : tx(locale, "New vendor", "Новый поставщик")}
      description={tx(locale, "Entries with this vendor name use its URL for Quick login.", "Записи с этим именем поставщика используют его URL для входа.")}
      footer={
        <>
          <span className="flex items-center gap-1 text-[11px] text-zinc-600"><Kbd>↵</Kbd>{tx(locale, "save", "сохранить")}<Kbd className="ml-2">Esc</Kbd>{tx(locale, "close", "закрыть")}</span>
          <Button type="submit" form="vendor-form" size="sm" className="ml-auto" disabled={pending || !name.trim()}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {tx(locale, "Save", "Сохранить")}
          </Button>
        </>
      }
    >
      <form id="vendor-form" className="space-y-3" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <label className="block">
          <FieldLabel>{tx(locale, "Name", "Название")}</FieldLabel>
          <Input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Hetzner" />
        </label>
        <label className="block">
          <FieldLabel>{tx(locale, "Login URL", "URL для входа")}</FieldLabel>
          <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://accounts.hetzner.com/login" inputMode="url" />
        </label>
        <label className="block">
          <FieldLabel>{tx(locale, "Notes", "Заметки")}</FieldLabel>
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} placeholder={tx(locale, "Support contacts, billing quirks…", "Контакты поддержки, особенности оплаты…")} />
        </label>
        {error ? <p className="text-xs text-red-300">{error}</p> : null}
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
  const visible = useMemo(
    () =>
      accounts.filter(
        (account) =>
          (vendorFilter === "all" || String(account.vendorId || "none") === vendorFilter) &&
          matches(query, account.name, account.vendorName, account.loginUrl, account.vendorUrl),
      ),
    [accounts, query, vendorFilter],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={query} onChange={setQuery} placeholder={tx(locale, "Search accounts", "Поиск аккаунтов")} />
        {vendors.length ? (
          <NativeSelect value={vendorFilter} onChange={setVendorFilter} ariaLabel={tx(locale, "Vendor", "Поставщик")} className="h-8 w-44 text-[13px]">
            <option value="all">{tx(locale, "All vendors", "Все поставщики")}</option>
            {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
            <option value="none">{tx(locale, "No vendor", "Без поставщика")}</option>
          </NativeSelect>
        ) : null}
        {canEdit ? (
          <div className="ml-auto flex gap-2">
            <ImportFromEntriesButton workspaceId={workspaceId} locale={locale} />
            <Button type="button" size="sm" onClick={() => setEditing("new")}>
              <Plus className="h-3.5 w-3.5" />
              {tx(locale, "New account", "Новый аккаунт")}
            </Button>
          </div>
        ) : null}
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          icon={<UserRound />}
          title={tx(locale, "No accounts yet", "Аккаунтов пока нет")}
          description={tx(locale, "Save the login for each vendor account. Credentials are encrypted before they are stored.", "Сохраните логин для каждого аккаунта. Данные шифруются перед сохранением.")}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tx(locale, "Account", "Аккаунт")}</TableHead>
              <TableHead>{tx(locale, "Vendor", "Поставщик")}</TableHead>
              <TableHead>{tx(locale, "Credentials", "Данные")}</TableHead>
              <TableHead className="text-center">{tx(locale, "Entries", "Записи")}</TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((account) => {
              const url = account.loginUrl || account.vendorUrl;
              return (
                <TableRow key={account.id} className="group">
                  <TableCell>
                    <button type="button" onClick={() => setViewing(account)} className="flex items-center gap-2.5 text-left">
                      <Avatar text={account.name} />
                      <span className="truncate font-medium text-zinc-100 hover:underline hover:decoration-white/30 hover:underline-offset-4">{account.name}</span>
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="truncate text-zinc-300">{account.vendorName || <span className="text-zinc-600">—</span>}</p>
                      {url ? (
                        <a href={url} target="_blank" rel="noreferrer" className="inline-flex max-w-60 items-center gap-1 text-xs text-sky-300 hover:text-sky-200">
                          <span className="truncate">{hostOf(url)}</span>
                          <ArrowUpRight className="h-3 w-3 shrink-0" />
                        </a>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {account.hasLogin ? <Chip>{tx(locale, "login", "логин")}</Chip> : null}
                      {account.hasPassword ? <Chip>{tx(locale, "password", "пароль")}</Chip> : null}
                      {account.hasNotes ? <Chip>{tx(locale, "notes", "заметки")}</Chip> : null}
                      {!account.hasLogin && !account.hasPassword && !account.hasNotes ? <span className="text-xs text-zinc-600">{tx(locale, "none saved", "не заданы")}</span> : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-center tabular-nums">{account.entryCount || "—"}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-0.5">
                      {canEdit ? (
                        <button type="button" onClick={() => setViewing(account)} className="rounded-md p-1.5 text-zinc-500 transition hover:bg-violet-500/15 hover:text-violet-200" aria-label={tx(locale, "View credentials", "Показать данные")} title={tx(locale, "View credentials", "Показать данные")}>
                          <KeyRound className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                      {canEdit ? (
                        <div className="flex gap-0.5 opacity-60 transition group-hover:opacity-100">
                          <button type="button" onClick={() => setEditing(account)} className="rounded-md p-1.5 text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200" aria-label={tx(locale, "Edit", "Изменить")}>
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <DeleteButton
                            label={account.name}
                            locale={locale}
                            onConfirm={async () => {
                              const result = await deleteAccountAction(workspaceId, account.id);
                              if (!result.ok) toast.error(result.error);
                              router.refresh();
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

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
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-200">{children}</span>;
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
      icon={<KeyRound className="h-4 w-4" />}
      title={account.name}
      description={account.vendorName || tx(locale, "No vendor", "Без поставщика")}
      footer={
        <>
          {url ? (
            <Button type="button" size="sm" onClick={() => window.open(url, "_blank", "noopener,noreferrer")}>
              <ArrowUpRight className="h-3.5 w-3.5" />
              {tx(locale, "Open", "Открыть")} {hostOf(url)}
            </Button>
          ) : null}
          {canEdit ? (
            <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
              {tx(locale, "Edit", "Изменить")}
            </Button>
          ) : null}
        </>
      }
    >
      {!canEdit ? (
        <p className="text-xs text-zinc-500">{tx(locale, "Only workspace owners and editors can view credentials.", "Учётные данные видят только владельцы и редакторы.")}</p>
      ) : state.status === "shown" ? (
        <div className="space-y-1.5">
          <SecretRow label={tx(locale, "Login", "Логин")} value={state.credentials.login} locale={locale} />
          <SecretRow label={tx(locale, "Password", "Пароль")} value={state.credentials.password} secret locale={locale} />
          {state.credentials.notes ? (
            <p className="whitespace-pre-wrap rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-zinc-400">{state.credentials.notes}</p>
          ) : null}
        </div>
      ) : state.status === "code" ? (
        <TwoFactorPrompt locale={locale} pending={false} error={state.error} onSubmit={(code) => void reveal(account.id, code)} />
      ) : state.status === "setup" ? (
        <SetupTwoFactorNotice locale={locale} message={state.message} />
      ) : state.status === "error" ? (
        <p className="text-xs text-red-300">{state.message}</p>
      ) : (
        <div className="flex h-20 items-center justify-center text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" /></div>
      )}
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
  const { state, reveal } = useCredentialReveal(workspaceId);
  const [vendorId, setVendorId] = useState(String(account?.vendorId || vendors[0]?.id || ""));
  const [name, setName] = useState(account?.name || "");
  const [loginUrl, setLoginUrl] = useState(account?.loginUrl || "");
  // Undefined means "unchanged": editing never needs the old secret unless the user asks to see it.
  const [login, setLogin] = useState<string | undefined>(account ? undefined : "");
  const [password, setPassword] = useState<string | undefined>(account ? undefined : "");
  const [notes, setNotes] = useState<string | undefined>(account ? undefined : "");
  const [showPassword, setShowPassword] = useState(false);
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
      toast.success(account ? tx(locale, "Account saved", "Аккаунт сохранён") : tx(locale, `Added ${name}`, `Добавлен ${name}`));
      onClose();
      router.refresh();
    });
  }

  const unchanged = tx(locale, "•••••• unchanged", "•••••• без изменений");

  return (
    <VaultDialog
      open
      wide
      onOpenChange={(open) => !open && onClose()}
      icon={<UserRound className="h-4 w-4" />}
      title={account ? tx(locale, "Edit account", "Изменить аккаунт") : tx(locale, "New account", "Новый аккаунт")}
      description={tx(locale, "Login, password and notes are encrypted at rest.", "Логин, пароль и заметки хранятся в зашифрованном виде.")}
      footer={
        <>
          <span className="flex items-center gap-1 text-[11px] text-zinc-600"><Kbd>↵</Kbd>{tx(locale, "save", "сохранить")}<Kbd className="ml-2">Esc</Kbd>{tx(locale, "close", "закрыть")}</span>
          <Button type="submit" form="account-form" size="sm" className="ml-auto" disabled={pending || !name.trim()}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {tx(locale, "Save encrypted", "Сохранить")}
          </Button>
        </>
      }
    >
      <form id="account-form" className="space-y-3" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <FieldLabel>{tx(locale, "Vendor", "Поставщик")}</FieldLabel>
            <NativeSelect value={vendorId} onChange={setVendorId} ariaLabel={tx(locale, "Vendor", "Поставщик")}>
              <option value="">{tx(locale, "No vendor", "Без поставщика")}</option>
              {vendors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </NativeSelect>
          </label>
          <label className="block">
            <FieldLabel>{tx(locale, "Account name", "Имя аккаунта")}</FieldLabel>
            <Input autoFocus={!account} value={name} onChange={(event) => setName(event.target.value)} placeholder="ops@company" />
          </label>
        </div>
        <p className="-mt-1 text-[11px] text-zinc-600">
          {tx(locale, "Entries whose account and vendor match these names get Quick login.", "Записи с этими именами аккаунта и поставщика получат быстрый вход.")}
        </p>
        <label className="block">
          <FieldLabel>{tx(locale, "Login URL (optional)", "URL входа (необязательно)")}</FieldLabel>
          <Input value={loginUrl} onChange={(event) => setLoginUrl(event.target.value)} placeholder={vendor?.url || "https://"} inputMode="url" />
        </label>

        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="mb-2 flex items-center">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{tx(locale, "Credentials", "Учётные данные")}</span>
            {hasStored && login === undefined && state.status !== "code" ? (
              <button type="button" onClick={() => void loadCurrent()} disabled={state.status === "loading"} className="ml-auto flex items-center gap-1 text-[11px] text-violet-200 hover:text-white">
                {state.status === "loading" ? <Loader2 className="h-3 w-3 animate-spin" /> : <KeyRound className="h-3 w-3" />}
                {tx(locale, "Show current", "Показать текущие")}
              </button>
            ) : null}
          </div>
          {state.status === "code" ? (
            <div className="mb-3"><TwoFactorPrompt locale={locale} pending={false} error={state.error} onSubmit={(code) => void loadCurrent(code)} /></div>
          ) : state.status === "setup" ? (
            <div className="mb-3"><SetupTwoFactorNotice locale={locale} message={state.message} /></div>
          ) : state.status === "error" ? (
            <p className="mb-3 text-xs text-red-300">{state.message}</p>
          ) : null}
          <div className="space-y-2">
            <Input
              value={login ?? ""}
              onChange={(event) => setLogin(event.target.value)}
              autoComplete="off"
              placeholder={login === undefined && account?.hasLogin ? unchanged : tx(locale, "Login or email", "Логин или email")}
            />
            <div className="relative">
              <Input
                value={password ?? ""}
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder={password === undefined && account?.hasPassword ? unchanged : tx(locale, "Password", "Пароль")}
                className="pr-16"
              />
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-[11px] text-zinc-500 hover:text-zinc-200">
                {showPassword ? tx(locale, "hide", "скрыть") : tx(locale, "show", "показать")}
              </button>
            </div>
            <Textarea
              value={notes ?? ""}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              placeholder={notes === undefined && account?.hasNotes ? unchanged : tx(locale, "Recovery codes, security answers… (encrypted)", "Коды восстановления, ответы… (зашифровано)")}
            />
          </div>
          {state.status === "shown" ? <SecretPreviewNote locale={locale} /> : null}
        </div>
        {error ? <p className="text-xs text-red-300">{error}</p> : null}
      </form>
    </VaultDialog>
  );
}

function SecretPreviewNote({ locale }: { locale: Locale }) {
  return <p className="mt-2 text-[11px] text-zinc-600">{tx(locale, "Showing the stored values. Clear a field to remove it.", "Показаны сохранённые значения. Очистите поле, чтобы удалить его.")}</p>;
}
