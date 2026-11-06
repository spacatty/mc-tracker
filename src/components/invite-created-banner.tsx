"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Copy } from "lucide-react";
import { tx } from "@/components/capture/shared";
import type { Locale } from "@/lib/i18n";
import { Alert } from "./ui/alert";
import { Button } from "./ui/button";

const noopSubscribe = () => () => {};

/** The page origin on the client, "" during SSR (no hydration mismatch). */
export function useOrigin() {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => "",
  );
}

export function InviteCreatedBanner({ token, locale = "en" }: { token: string; locale?: Locale }) {
  const [copied, setCopied] = useState(false);
  const origin = useOrigin();
  const link = `${origin}/invite/${token}`;

  async function copy() {
    await navigator.clipboard?.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <Alert
      tone="success"
      title={tx(locale, "Invite link created", "Ссылка-приглашение создана")}
      action={
        <Button type="button" size="xs" variant="secondary" onClick={copy}>
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
          {copied ? tx(locale, "Copied", "Скопировано") : tx(locale, "Copy link", "Копировать ссылку")}
        </Button>
      }
    >
      <span className="block truncate font-mono text-[12px]">{link}</span>
    </Alert>
  );
}
