"use client";

import { ArrowUpRight, KeyRound, Loader2, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { getQuickLoginAction, saveEntryCredentialsAction } from "@/app/vault-actions";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { QuickLoginInfo } from "@/lib/vault/types";
import { Alert } from "../ui/alert";
import { Button } from "../ui/button";
import { Field } from "../ui/field";
import { Input } from "../ui/input";
import { Kbd } from "../ui/kbd";
import { rowActionClass } from "../ui/row-actions";
import { Tooltip } from "../ui/tooltip";
import {
  CredentialsFieldset,
  LegendAction,
  PasswordInput,
  SecretNotes,
  SecretRow,
  SetupTwoFactorNotice,
  TwoFactorPrompt,
  VaultDialog,
  copyText,
  hostOf,
  tx,
  useCredentialReveal,
} from "./shared";

/**
 * "Quick login" for one entry: the vendor's login URL and the entry's account credentials in one panel,
 * with open-site and copy actions.
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
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)} className={className}>
        <KeyRound className="h-3.5 w-3.5 text-violet-300" aria-hidden="true" />
        {label}
      </Button>
    ) : (
      <button
        type="button"
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        className={cn(rowActionClass, "text-violet-300 hover:bg-violet-500/10 hover:text-violet-200", className)}
      >
        <KeyRound aria-hidden="true" />
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
  // "Entry · vendor · account" for the header, filled in once the body has loaded.
  const [subtitle, setSubtitle] = useState("");
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSubtitle("");
  }

  return (
    <VaultDialog
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      icon={<KeyRound />}
      title={tx(locale, "Quick login", "Быстрый вход")}
      description={subtitle || undefined}
      footer={
        <Button asChild type="button" variant="ghost" size="sm">
          <Link href={`/app/accounts?workspace=${workspaceId}`}>{tx(locale, "All accounts", "Все аккаунты")}</Link>
        </Button>
      }
    >
      {/* Mounted only while open, so every opening starts fresh. */}
      <QuickLoginBody
        workspaceId={workspaceId}
        itemId={itemId}
        locale={locale}
        onInfo={(info) => setSubtitle([info.itemName, info.vendorName, info.account?.name].filter(Boolean).join(" · "))}
      />
    </VaultDialog>
  );
}

/** The credentials part of Quick login on its own, for the entry drawer (which shows the vendor and URL itself). */
export function EntryCredentials({ workspaceId, itemId, locale }: { workspaceId: number; itemId: number; locale: Locale }) {
  return <QuickLoginBody workspaceId={workspaceId} itemId={itemId} locale={locale} embedded />;
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-white/10 px-3 py-2.5 text-xs leading-5 text-zinc-500">{children}</p>;
}

function QuickLoginBody({
  workspaceId,
  itemId,
  locale,
  embedded = false,
  onInfo,
}: {
  workspaceId: number;
  itemId: number;
  locale: Locale;
  embedded?: boolean;
  onInfo?: (info: QuickLoginInfo) => void;
}) {
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
  const onInfoRef = useRef(onInfo);
  useEffect(() => {
    onInfoRef.current = onInfo;
  });

  async function load() {
    const result = await getQuickLoginAction(workspaceId, itemId);
    if (!result.ok) {
      setLoadError(result.error);
      return null;
    }
    setInfo(result.info);
    onInfoRef.current?.(result.info);
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
      onInfoRef.current?.(result.info);
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

  if (loadError) return <Alert tone="danger">{loadError}</Alert>;
  if (!info) {
    return (
      <div className="flex h-24 items-center justify-center text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        <span className="sr-only">{tx(locale, "Loading", "Загрузка")}</span>
      </div>
    );
  }

  const editAction =
    account && info.canReveal && !editing && (state.status === "shown" || !hasCreds) ? (
      <LegendAction onClick={() => setEditing(true)}>
        {hasCreds ? <Pencil className="h-3 w-3" aria-hidden="true" /> : <Plus className="h-3 w-3" aria-hidden="true" />}
        {hasCreds ? tx(locale, "Edit", "Изменить") : tx(locale, "Add", "Добавить")}
      </LegendAction>
    ) : null;

  return (
    <div className="space-y-5">
      {!embedded ? (
        <Field label={tx(locale, "Login page", "Страница входа")}>
          {info.url ? (
            <button
              type="button"
              onClick={() => openSite()}
              className="group/url flex h-9 min-w-0 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-left text-[13px] transition hover:border-white/15 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
            >
              <span className="truncate text-sky-300">{hostOf(info.url)}</span>
              <span className="truncate text-xs text-zinc-600">{info.url.replace(/^https?:\/\/[^/]+/, "").replace(/^\/$/, "")}</span>
              <ArrowUpRight className="ml-auto h-4 w-4 shrink-0 text-zinc-500 transition group-hover/url:text-sky-300" aria-hidden="true" />
            </button>
          ) : (
            <Placeholder>
              {tx(locale, "No URL yet. Add one to the vendor on the ", "Ссылки пока нет. Добавьте её поставщику на странице ")}
              <Link href={`/app/vendors?workspace=${workspaceId}`} className="text-zinc-300 underline decoration-white/20 underline-offset-2 hover:text-white">
                {tx(locale, "Vendors page", "«Поставщики»")}
              </Link>
              .
            </Placeholder>
          )}
        </Field>
      ) : null}

      <CredentialsFieldset locale={locale} action={editAction}>
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
          <Placeholder>{tx(locale, "No saved account for this entry.", "Для этой записи нет сохранённого аккаунта.")}</Placeholder>
        ) : !info.canReveal ? (
          <p className="text-xs text-zinc-500">{tx(locale, "Only workspace owners and editors can view credentials.", "Учётные данные видят только владельцы и редакторы пространства.")}</p>
        ) : !hasCreds ? (
          <Placeholder>{tx(locale, `“${account.name}” has no login or password saved yet.`, `У аккаунта «${account.name}» пока нет сохранённого логина и пароля.`)}</Placeholder>
        ) : state.status === "shown" ? (
          <div className="space-y-1.5">
            <SecretRow label={tx(locale, "Login", "Логин")} value={state.credentials.login} locale={locale} />
            <SecretRow label={tx(locale, "Password", "Пароль")} value={state.credentials.password} secret locale={locale} />
            {state.credentials.notes ? <SecretNotes>{state.credentials.notes}</SecretNotes> : null}
            {info.url ? (
              <div className="flex flex-wrap gap-2 pt-2">
                <Button type="button" size="sm" onClick={() => openSite("login")} disabled={!state.credentials.login}>
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
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
          <Alert tone="danger" className="text-xs">
            {state.message}
          </Alert>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => void reveal(account.id)} disabled={state.status === "loading"}>
              {state.status === "loading" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {tx(locale, "Show credentials", "Показать учётные данные")}
            </Button>
            {info.twoFactor.required ? <span className="text-[11.5px] text-zinc-500">{tx(locale, "2FA code needed", "Нужен код 2FA")}</span> : null}
          </div>
        )}
      </CredentialsFieldset>
    </div>
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
  const id = useId();
  const [name, setName] = useState(accountName);
  const [login, setLogin] = useState(initial?.login || "");
  const [password, setPassword] = useState(initial?.password || "");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const message = await onSave({ accountName: name, login, password });
          setError(message || "");
        });
      }}
    >
      {askName ? (
        <Field label={tx(locale, "Account name", "Название аккаунта")} htmlFor={`${id}-name`} hint={tx(locale, "As written on the entry.", "Как указано в записи.")}>
          <Input id={`${id}-name`} value={name} onChange={(event) => setName(event.target.value)} placeholder="ops@company" autoFocus />
        </Field>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={tx(locale, "Login", "Логин")} htmlFor={`${id}-login`}>
          <Input
            id={`${id}-login`}
            value={login}
            onChange={(event) => setLogin(event.target.value)}
            autoComplete="off"
            placeholder={tx(locale, "Login or email", "Логин или email")}
            autoFocus={!askName}
          />
        </Field>
        <Field label={tx(locale, "Password", "Пароль")} htmlFor={`${id}-password`}>
          <PasswordInput
            id={`${id}-password`}
            locale={locale}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
          />
        </Field>
      </div>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="flex flex-wrap items-center gap-2">
        <span className="hidden items-center gap-1.5 text-[11.5px] text-zinc-500 sm:flex">
          <Kbd>↵</Kbd>
          {tx(locale, "save", "сохранить")}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {onCancel ? (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              {tx(locale, "Cancel", "Отмена")}
            </Button>
          ) : null}
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
            {tx(locale, "Save", "Сохранить")}
          </Button>
        </div>
      </div>
    </form>
  );
}
