"use client";

import { Check, Copy, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { forwardRef, useCallback, useState, type ComponentProps, type ReactNode, type SyntheticEvent } from "react";
import { toast } from "sonner";
import { revealCredentialsAction } from "@/app/vault-actions";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { AccountCredentials } from "@/lib/vault/types";
import { Alert } from "../ui/alert";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  type DialogSize,
  type DialogTone,
} from "../ui/dialog";
import { Fieldset } from "../ui/field";
import { Input, type InputProps } from "../ui/input";
import { Kbd } from "../ui/kbd";
import { Tooltip } from "../ui/tooltip";

export function tx(locale: Locale, en: string, ru: string) {
  return locale === "ru" ? ru : en;
}

export function hostOf(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }
}

export async function copyText(value: string, locale: Locale, what: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast(tx(locale, `${what} copied`, `Скопировано: ${what.toLowerCase()}`));
  } catch {
    toast.error(tx(locale, "Clipboard is blocked by the browser.", "Браузер запретил доступ к буферу обмена."));
  }
}

const stop = (event: SyntheticEvent) => event.stopPropagation();

const TONES: Record<"violet" | "sky" | "emerald" | "amber", DialogTone> = {
  violet: "accent",
  sky: "info",
  emerald: "success",
  amber: "warning",
};

/**
 * The app dialog (ui/dialog) with the vault's header/body/footer layout. Clicks inside never bubble to a
 * clickable table row that renders this dialog.
 */
export function VaultDialog({
  open,
  onOpenChange,
  icon,
  tone = "violet",
  title,
  description,
  children,
  footer,
  hint,
  trigger,
  size = "md",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: ReactNode;
  tone?: "violet" | "sky" | "emerald" | "amber";
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Footer buttons (right-aligned): Cancel ghost first, the Aurora submit last. */
  footer?: ReactNode;
  /** Left-aligned footer hint, usually keyboard shortcuts. */
  hint?: ReactNode;
  trigger?: ReactNode;
  size?: DialogSize;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      {/* `contents` keeps layout untouched; it only catches React clicks bubbling out of the portal (overlay included). */}
      <span className="contents" onClick={stop}>
        <DialogContent size={size}>
          <DialogHeader icon={icon} tone={TONES[tone]}>
            <DialogTitle className="truncate">{title}</DialogTitle>
            {description ? (
              <DialogDescription className="truncate">{description}</DialogDescription>
            ) : (
              <DialogDescription className="sr-only">{title}</DialogDescription>
            )}
          </DialogHeader>
          <DialogBody>{children}</DialogBody>
          {footer || hint ? <DialogFooter hint={hint}>{footer}</DialogFooter> : null}
        </DialogContent>
      </span>
    </Dialog>
  );
}

/** Footer hint: "↵ save · Esc close". */
export function SaveHint({ locale }: { locale: Locale }) {
  return (
    <>
      <Kbd>↵</Kbd>
      <span>{tx(locale, "save", "сохранить")}</span>
      <Kbd className="ml-2">Esc</Kbd>
      <span>{tx(locale, "close", "закрыть")}</span>
    </>
  );
}

/** The credentials group: a small-caps legend with an optional action on the right of it. */
export function CredentialsFieldset({
  locale,
  action,
  description,
  children,
}: {
  locale: Locale;
  action?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <Fieldset legend={tx(locale, "Credentials", "Учётные данные")} description={description}>
        {children}
      </Fieldset>
      {action ? <div className="absolute -top-1.5 right-0 flex items-center">{action}</div> : null}
    </div>
  );
}

/** Password input with a show/hide toggle inside it. */
export const PasswordInput = forwardRef<HTMLInputElement, InputProps & { locale: Locale }>(({ locale, className, ...props }, ref) => {
  const [visible, setVisible] = useState(false);
  const label = visible ? tx(locale, "Hide password", "Скрыть пароль") : tx(locale, "Show password", "Показать пароль");
  return (
    <div className="relative">
      <Input ref={ref} type={visible ? "text" : "password"} className={cn("pr-10", className)} {...props} />
      <Tooltip label={label}>
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={label}
          aria-pressed={visible}
          className="absolute right-1 top-1/2 inline-grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
        >
          {visible ? <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
        </button>
      </Tooltip>
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";

const secretButtonClass =
  "inline-grid h-7 w-7 shrink-0 place-items-center rounded-md text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40";

/** One credential line: masked until shown, with copy. */
export function SecretRow({
  label,
  value,
  secret,
  locale,
  mono = true,
}: {
  label: string;
  value: string;
  secret?: boolean;
  locale: Locale;
  mono?: boolean;
}) {
  const [visible, setVisible] = useState(!secret);
  const [copied, setCopied] = useState(false);
  const empty = !value;
  const toggleLabel = visible ? tx(locale, "Hide", "Скрыть") : tx(locale, "Show", "Показать");
  const copyLabel = tx(locale, `Copy ${label}`, `Копировать ${label.toLowerCase()}`);
  return (
    <div className="flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] pl-3 pr-1">
      <span className="w-20 shrink-0 text-xs text-zinc-500">{label}</span>
      <span className={cn("min-w-0 flex-1 truncate text-[13px]", mono && "font-mono", empty ? "text-zinc-600" : "text-zinc-100")}>
        {empty ? "—" : visible ? value : "•".repeat(Math.min(Math.max(value.length, 8), 16))}
      </span>
      {secret && !empty ? (
        <Tooltip label={toggleLabel}>
          <button type="button" onClick={() => setVisible((current) => !current)} className={secretButtonClass} aria-label={toggleLabel}>
            {visible ? <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
          </button>
        </Tooltip>
      ) : null}
      {!empty ? (
        <Tooltip label={copyLabel}>
          <button
            type="button"
            onClick={() => {
              void copyText(value, locale, label);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1200);
            }}
            className={secretButtonClass}
            aria-label={copyLabel}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
          </button>
        </Tooltip>
      ) : null}
    </div>
  );
}

/** Stored notes under the SecretRows. */
export function SecretNotes({ children }: { children: ReactNode }) {
  return <p className="whitespace-pre-wrap rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs leading-5 text-zinc-400">{children}</p>;
}

/**
 * Six-digit authenticator prompt. Submits by itself on the sixth digit (or on Enter). It is not a <form>, so it can
 * sit inside another form without nesting forms.
 */
export function TwoFactorPrompt({
  locale,
  pending,
  error,
  onSubmit,
}: {
  locale: Locale;
  pending: boolean;
  error?: string;
  onSubmit: (code: string) => void;
}) {
  const [code, setCode] = useState("");
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex items-center gap-2 text-xs text-zinc-300">
        <ShieldCheck className="h-3.5 w-3.5 text-violet-300" aria-hidden="true" />
        {tx(locale, "Enter your authenticator code to view credentials", "Введите код из приложения-аутентификатора, чтобы увидеть учётные данные")}
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <Input
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label={tx(locale, "Authenticator code", "Код аутентификатора")}
          aria-invalid={error ? true : undefined}
          value={code}
          disabled={pending}
          onChange={(event) => {
            const next = event.target.value.replace(/\D/g, "").slice(0, 6);
            setCode(next);
            if (next.length === 6) onSubmit(next);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            // Never submit a surrounding form from here.
            event.preventDefault();
            if (code.length === 6) onSubmit(code);
          }}
          placeholder="000 000"
          className="w-36 text-center font-mono tracking-[0.3em]"
        />
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin text-zinc-500" aria-hidden="true" />
        ) : (
          <span className="flex items-center gap-1 text-[11px] text-zinc-500">
            <Kbd>↵</Kbd>
          </span>
        )}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SetupTwoFactorNotice({ locale, message }: { locale: Locale; message?: string }) {
  return (
    <Alert tone="warning" className="text-xs">
      {message || tx(locale, "Credentials need a 2FA code, and your account has no authenticator yet.", "Чтобы увидеть учётные данные, нужен код 2FA, а аутентификатор у вас ещё не настроен.")}{" "}
      <Link href="/app/settings" className="underline decoration-amber-300/40 underline-offset-2 hover:text-white">
        {tx(locale, "Set it up in Settings", "Настроить в разделе «Настройки»")}
      </Link>
    </Alert>
  );
}

/** Small ghost button for actions next to a legend ("Edit", "Show current"). */
export function LegendAction({ children, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button type="button" variant="ghost" size="xs" className="h-6 px-1.5 text-[11.5px]" {...props}>
      {children}
    </Button>
  );
}

type RevealState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "code"; error?: string }
  | { status: "setup"; message: string }
  | { status: "shown"; credentials: AccountCredentials }
  | { status: "error"; message: string };

/** Reveals one account's credentials, asking for an authenticator code when the server wants one. */
export function useCredentialReveal(workspaceId: number) {
  const [state, setState] = useState<RevealState>({ status: "idle" });

  const reveal = useCallback(
    async (accountId: number, code?: string) => {
      setState((current) => (current.status === "code" ? current : { status: "loading" }));
      const result = await revealCredentialsAction(workspaceId, accountId, code);
      if (result.ok) {
        setState({ status: "shown", credentials: result.credentials });
        return result.credentials;
      }
      if (result.reason === "two_factor_required") setState({ status: "code" });
      else if (result.reason === "invalid_code") setState({ status: "code", error: result.message });
      else if (result.reason === "two_factor_not_configured") setState({ status: "setup", message: result.message });
      else setState({ status: "error", message: result.message });
      return null;
    },
    [workspaceId],
  );

  const reset = useCallback(() => setState({ status: "idle" }), []);
  return { state, reveal, reset };
}
