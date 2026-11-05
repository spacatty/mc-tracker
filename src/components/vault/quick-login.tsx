"use client";

import { ArrowUpRight, KeyRound, Loader2, Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { getQuickLoginAction, saveEntryCredentialsAction } from "@/app/vault-actions";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { QuickLoginInfo } from "@/lib/vault/types";
import { Kbd } from "../capture/shared";
import { Button } from "../ui/button";
import { Tooltip, iconActionClass } from "../ui/tooltip";
import { Input } from "../ui/input";
import { FieldLabel, SecretRow, SetupTwoFactorNotice, TwoFactorPrompt, VaultDialog, copyText, hostOf, tx, useCredentialReveal } from "./shared";

/**
 * "Quick login" for one entry: the vendor's login URL and the entry's account credentials in one panel,
 * with open-site, copy and record-payment actions.
 */
export function QuickLoginButton({
  workspaceId,
  itemId,
  locale = "en",
  variant = "chip",
  className,
}: {
  workspaceId: number;
  itemId: number;
  locale?: Locale;
  variant?: "chip" | "icon" | "row";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const label = tx(locale, "Quick login", "Быстрый вход");
  const trigger =
    variant === "row" ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("inline-flex items-center gap-1.5 rounded-md border border-violet-400/20 bg-violet-500/10 px-2.5 py-1.5 text-xs font-medium text-violet-100 transition hover:border-violet-300/35 hover:bg-violet-500/20", className)}
      >
        <KeyRound className="h-3.5 w-3.5" />
        {label}
      </button>
    ) : (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        className={cn(iconActionClass, "hover:border-violet-400/30 hover:bg-violet-500/15", variant === "icon" && "border-transparent bg-transparent", className)}
      >
        <KeyRound className="h-3.5 w-3.5" />
      </button>
    );

  return (
    <>
      {variant === "row" ? trigger : <Tooltip label={label}>{trigger}</Tooltip>}
      <QuickLoginDialog open={open} onOpenChange={setOpen} workspaceId={workspaceId} itemId={itemId} locale={locale} />
    </>
  );
}

export function QuickLoginDialog({
  open,
  onOpenChange,
  workspaceId,
  itemId,
  locale = "en",
  trigger,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: number;
  itemId: number;
  locale?: Locale;
  trigger?: React.ReactNode;
}) {
  return (
    <VaultDialog open={open} onOpenChange={onOpenChange} trigger={trigger} icon={<KeyRound className="h-4 w-4" />} title={tx(locale, "Quick login", "Быстрый вход")}>
      {/* Mounted only while open, so every opening starts fresh. */}
      <QuickLoginBody workspaceId={workspaceId} itemId={itemId} locale={locale} />
    </VaultDialog>
  );
}

function QuickLoginBody({ workspaceId, itemId, locale }: { workspaceId: number; itemId: number; locale: Locale }) {
  const router = useRouter();
  const [info, setInfo] = useState<QuickLoginInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState(false);
  const { state, reveal } = useCredentialReveal(workspaceId);
  // Refreshing the page re-mounts the entries table (and this dialog with it), so wait until the dialog closes.
  const needsRefresh = useRef(false);
  useEffect(() => () => {
    if (needsRefresh.current) router.refresh();
  }, [router]);

  async function load() {
    const result = await getQuickLoginAction(workspaceId, itemId);
    if (!result.ok) {
      setLoadError(result.error);
      return null;
    }
    setInfo(result.info);
    return result.info;
  }

  useEffect(() => {
    let cancelled = false;
    void getQuickLoginAction(workspaceId, itemId).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      setInfo(result.info);
      // Show the credentials straight away when nothing stands in the way.
      const account = result.info.account;
      if (account && result.info.canReveal && result.info.twoFactor.unlocked && (account.hasLogin || account.hasPassword || account.hasNotes)) {
        void reveal(account.id);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, itemId, reveal]);

  const account = info?.account || null;
  const hasCreds = Boolean(account && (account.hasLogin || account.hasPassword || account.hasNotes));
  const credentials = state.status === "shown" ? state.credentials : null;

  function openSite(copy?: "login" | "password") {
    if (!info?.url) return;
    if (copy && credentials?.[copy]) void copyText(credentials[copy], locale, copy === "login" ? tx(locale, "Login", "Логин") : tx(locale, "Password", "Пароль"));
    window.open(info.url, "_blank", "noopener,noreferrer");
  }

  const footer =
        info ? (
          <div className="-mx-5 -mb-4 mt-5 flex items-center gap-2 border-t border-white/[0.06] px-5 py-3">
            <Link
              href={`/app/accounts?workspace=${workspaceId}`}
              className="ml-auto text-xs text-zinc-500 transition hover:text-zinc-200"
            >
              {tx(locale, "All accounts", "Все аккаунты")}
            </Link>
          </div>
        ) : null;

  return (
    <>
      {info ? <p className="-mt-1 mb-4 truncate text-xs text-zinc-500">{[info.itemName, info.vendorName, account?.name].filter(Boolean).join(" · ")}</p> : null}
      {loadError ? <p className="text-sm text-red-300">{loadError}</p> : null}
      {!info && !loadError ? (
        <div className="flex h-24 items-center justify-center text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" /></div>
      ) : null}
      {info ? (
        <div className="space-y-4">
          <div>
            <FieldLabel>{tx(locale, "Login page", "Страница входа")}</FieldLabel>
            {info.url ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openSite()}
                  className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 text-left text-sm text-sky-200 transition hover:border-sky-400/25 hover:bg-sky-500/[0.06]"
                >
                  <span className="truncate">{hostOf(info.url)}</span>
                  <span className="truncate text-xs text-zinc-600">{info.url.replace(/^https?:\/\/[^/]+/, "").replace(/^\/$/, "")}</span>
                  <ArrowUpRight className="ml-auto h-4 w-4 shrink-0" />
                </button>
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-white/10 px-3 py-2.5 text-xs text-zinc-500">
                {tx(locale, "No URL yet. Add one to the vendor on the ", "URL нет. Добавьте его поставщику на странице ")}
                <Link href={`/app/vendors?workspace=${workspaceId}`} className="text-zinc-300 underline decoration-white/20 underline-offset-2 hover:text-white">
                  {tx(locale, "Vendors page", "Поставщики")}
                </Link>
                .
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center">
              <FieldLabel>{tx(locale, "Credentials", "Учётные данные")}</FieldLabel>
              {account && info.canReveal && !editing && (state.status === "shown" || !hasCreds) ? (
                <button type="button" onClick={() => setEditing(true)} className="mb-1.5 ml-auto flex items-center gap-1 text-[11px] text-zinc-500 transition hover:text-zinc-200">
                  <Pencil className="h-3 w-3" />
                  {hasCreds ? tx(locale, "Edit", "Изменить") : tx(locale, "Add", "Добавить")}
                </button>
              ) : null}
            </div>

            {editing || (!account && info.canCreateAccount) ? (
              <CredentialsForm
                locale={locale}
                accountName={account?.name || info.entryAccountName}
                askName={!account}
                initial={credentials ? { login: credentials.login, password: credentials.password } : undefined}
                onCancel={account ? () => setEditing(false) : undefined}
                onSave={async (values) => {
                  const result = await saveEntryCredentialsAction({ workspaceId, itemId, ...values });
                  if (!result.ok) return result.error;
                  setEditing(false);
                  const next = await load();
                  if (next?.account) await reveal(next.account.id);
                  needsRefresh.current = true;
                  return null;
                }}
              />
            ) : !account ? (
              <p className="rounded-lg border border-dashed border-white/10 px-3 py-2.5 text-xs text-zinc-500">
                {tx(locale, "No saved account for this entry.", "Для этой записи нет сохранённого аккаунта.")}
              </p>
            ) : !info.canReveal ? (
              <p className="text-xs text-zinc-500">{tx(locale, "Only workspace owners and editors can view credentials.", "Учётные данные видят только владельцы и редакторы.")}</p>
            ) : !hasCreds ? (
              <p className="rounded-lg border border-dashed border-white/10 px-3 py-2.5 text-xs text-zinc-500">
                {tx(locale, `“${account.name}” has no login or password saved yet.`, `У «${account.name}» ещё нет логина и пароля.`)}
              </p>
            ) : state.status === "shown" ? (
              <div className="space-y-1.5">
                <SecretRow label={tx(locale, "Login", "Логин")} value={state.credentials.login} locale={locale} />
                <SecretRow label={tx(locale, "Password", "Пароль")} value={state.credentials.password} secret locale={locale} />
                {state.credentials.notes ? (
                  <p className="whitespace-pre-wrap rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-zinc-400">{state.credentials.notes}</p>
                ) : null}
                {info.url ? (
                  <div className="flex flex-wrap gap-2 pt-1.5">
                    <Button type="button" size="sm" onClick={() => openSite("login")} disabled={!state.credentials.login}>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      {tx(locale, "Copy login & open", "Копировать логин и открыть")}
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={() => openSite("password")} disabled={!state.credentials.password}>
                      {tx(locale, "Copy password & open", "Копировать пароль и открыть")}
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : state.status === "code" ? (
              <TwoFactorPrompt locale={locale} pending={false} error={state.error} onSubmit={(code) => void reveal(account.id, code)} />
            ) : state.status === "setup" ? (
              <SetupTwoFactorNotice locale={locale} message={state.message} />
            ) : state.status === "error" ? (
              <p className="text-xs text-red-300">{state.message}</p>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => void reveal(account.id)} disabled={state.status === "loading"}>
                    {state.status === "loading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                    {tx(locale, "Show credentials", "Показать данные")}
                  </Button>
                  {info.twoFactor.required ? <span className="text-[11px] text-zinc-500">{tx(locale, "2FA code needed", "Нужен код 2FA")}</span> : null}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
      {footer}
    </>
  );
}

function CredentialsForm({
  locale,
  accountName,
  askName,
  initial,
  onSave,
  onCancel,
}: {
  locale: Locale;
  accountName: string;
  askName: boolean;
  initial?: { login: string; password: string };
  onSave: (values: { accountName: string; login: string; password: string }) => Promise<string | null>;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(accountName);
  const [login, setLogin] = useState(initial?.login || "");
  const [password, setPassword] = useState(initial?.password || "");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const message = await onSave({ accountName: name, login, password });
          setError(message || "");
        });
      }}
    >
      {askName ? <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={tx(locale, "Account name (as on the entry)", "Имя аккаунта (как в записи)")} /> : null}
      <Input value={login} onChange={(event) => setLogin(event.target.value)} autoComplete="off" placeholder={tx(locale, "Login or email", "Логин или email")} autoFocus={!askName} />
      <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="new-password" placeholder={tx(locale, "Password", "Пароль")} />
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {tx(locale, "Save encrypted", "Сохранить (зашифровано)")}
        </Button>
        {onCancel ? <Button type="button" variant="ghost" size="sm" onClick={onCancel}>{tx(locale, "Cancel", "Отмена")}</Button> : null}
        <span className="ml-auto flex items-center gap-1 text-[11px] text-zinc-600"><Kbd>↵</Kbd>{tx(locale, "save", "сохранить")}</span>
      </div>
    </form>
  );
}
