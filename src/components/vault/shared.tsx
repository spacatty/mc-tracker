"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Check, Copy, Eye, EyeOff, Loader2, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { revealCredentialsAction } from "@/app/vault-actions";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { AccountCredentials } from "@/lib/vault/types";
import { Kbd } from "../capture/shared";

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
    toast(tx(locale, `${what} copied`, `${what}: скопировано`));
  } catch {
    toast.error(tx(locale, "Clipboard is blocked by the browser.", "Браузер запретил доступ к буферу обмена."));
  }
}

/** The Quick Capture panel: blurred overlay, dark glass card, icon tile and title. */
export function VaultDialog({
  open,
  onOpenChange,
  icon,
  tone = "violet",
  title,
  description,
  children,
  footer,
  trigger,
  wide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: ReactNode;
  tone?: "violet" | "sky" | "emerald" | "amber";
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  trigger?: ReactNode;
  wide?: boolean;
}) {
  const toneClass = {
    violet: "bg-violet-500/10 text-violet-200",
    sky: "bg-sky-500/10 text-sky-200",
    emerald: "bg-emerald-500/10 text-emerald-200",
    amber: "bg-amber-500/10 text-amber-200",
  }[tone];
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal>
        <Dialog.Overlay onClick={(event) => event.stopPropagation()} className="capture-overlay-in fixed inset-0 z-50 bg-black/60 backdrop-blur-md" />
        <Dialog.Content
          onClick={(event) => event.stopPropagation()}
          className={cn(
            "capture-panel-in fixed inset-x-0 top-[12vh] z-50 mx-auto flex max-h-[80vh] w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#101013] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.85)]",
            wide ? "max-w-lg" : "max-w-md",
          )}
        >
          <div className="flex items-start gap-3 border-b border-white/[0.06] px-5 py-4">
            <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", toneClass)}>{icon}</span>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate text-[15px] font-semibold text-white">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-0.5 truncate text-xs text-zinc-500">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{title}</Dialog.Description>}
            </div>
            <Dialog.Close className="rounded-md p-1.5 text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200" aria-label="Close">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer ? <div className="flex items-center gap-2 border-t border-white/[0.06] px-5 py-3">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{children}</span>;
}

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
  return (
    <div className="group flex h-10 items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] pl-3 pr-1.5">
      <span className="w-20 shrink-0 text-[11px] uppercase tracking-[0.14em] text-zinc-500">{label}</span>
      <span className={cn("min-w-0 flex-1 truncate text-sm", mono && "font-mono", empty ? "text-zinc-600" : "text-zinc-100")}>
        {empty ? "—" : visible ? value : "•".repeat(Math.min(Math.max(value.length, 8), 16))}
      </span>
      {secret && !empty ? (
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="rounded-md p-1.5 text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200"
          aria-label={visible ? tx(locale, "Hide", "Скрыть") : tx(locale, "Show", "Показать")}
        >
          {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      ) : null}
      {!empty ? (
        <button
          type="button"
          onClick={() => {
            void copyText(value, locale, label);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          }}
          className="rounded-md p-1.5 text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200"
          aria-label={tx(locale, `Copy ${label}`, `Копировать: ${label}`)}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      ) : null}
    </div>
  );
}

/** Six-digit authenticator prompt. Submits by itself on the sixth digit. */
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
    <form
      className="rounded-lg border border-violet-400/15 bg-violet-500/[0.05] p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (code.length === 6) onSubmit(code);
      }}
    >
      <div className="flex items-center gap-2 text-xs text-violet-100">
        <ShieldCheck className="h-3.5 w-3.5" />
        {tx(locale, "Enter your authenticator code to view credentials", "Введите код из приложения-аутентификатора")}
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <input
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          disabled={pending}
          onChange={(event) => {
            const next = event.target.value.replace(/\D/g, "").slice(0, 6);
            setCode(next);
            if (next.length === 6) onSubmit(next);
          }}
          placeholder="000 000"
          className="h-9 w-36 rounded-lg border border-white/10 bg-black/30 px-3 text-center font-mono text-base tracking-[0.3em] text-white outline-none placeholder:text-zinc-700 focus:border-white/20 focus:ring-2 focus:ring-violet-400/25"
        />
        {pending ? <Loader2 className="h-4 w-4 animate-spin text-zinc-500" /> : <span className="flex items-center gap-1 text-[11px] text-zinc-500"><Kbd>↵</Kbd></span>}
      </div>
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </form>
  );
}

export function SetupTwoFactorNotice({ locale, message }: { locale: Locale; message?: string }) {
  return (
    <div className="rounded-lg border border-amber-400/15 bg-amber-500/[0.06] p-3 text-xs text-amber-100">
      {message || tx(locale, "Credentials need a 2FA code, and your account has no authenticator yet.", "Для показа нужен код 2FA, а аутентификатор ещё не настроен.")}{" "}
      <Link href="/app/settings" className="underline decoration-amber-300/40 underline-offset-2 hover:text-white">
        {tx(locale, "Set it up in Settings", "Настроить в Настройках")}
      </Link>
    </div>
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
