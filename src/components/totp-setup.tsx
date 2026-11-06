"use client";

import Image from "next/image";
import { Loader2, QrCode, ShieldCheck } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { enableTotpAction, getTotpSetupAction } from "@/app/actions";
import type { Locale } from "@/lib/i18n";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Field, FieldRow } from "./ui/field";
import { Input } from "./ui/input";

type Setup = {
  secret: string;
  qr: string;
  otpAuthUrl: string;
};

function tx(locale: Locale, en: string, ru: string) {
  return locale === "ru" ? ru : en;
}

/** Google Authenticator 2FA: a settings row, plus the QR + secret + code step once setup has started. Renders flat (no card). */
export function TotpSetup({
  enabled,
  locale = "en",
  usedFor = { login: true, credentials: false },
}: {
  enabled: boolean;
  locale?: Locale;
  usedFor?: { login: boolean; credentials: boolean };
}) {
  const id = useId();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [isPending, startTransition] = useTransition();

  const usage =
    usedFor.login && usedFor.credentials
      ? tx(locale, "The code is asked at sign-in and before credentials are shown.", "Код запрашивается при входе и перед показом учётных данных.")
      : usedFor.credentials
        ? tx(locale, "The code is asked before credentials are shown.", "Код запрашивается перед показом учётных данных.")
        : tx(locale, "The code is asked at sign-in.", "Код запрашивается при входе.");

  return (
    <div>
      <FieldRow
        label={tx(locale, "Google Authenticator 2FA", "2FA через Google Authenticator")}
        description={
          <>
            {enabled
              ? tx(locale, "2FA is enabled for your account.", "2FA включена для вашего аккаунта.")
              : tx(locale, "Scan a QR code with Google Authenticator and verify one code.", "Отсканируйте QR-код в Google Authenticator и подтвердите один код.")}{" "}
            {usage}
          </>
        }
      >
        {enabled ? (
          <Badge tone="success" icon={<ShieldCheck />}>
            {tx(locale, "On", "Включена")}
          </Badge>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={isPending}
            onClick={() => startTransition(async () => setSetup(await getTotpSetupAction()))}
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <QrCode className="h-3.5 w-3.5" aria-hidden="true" />}
            {isPending
              ? tx(locale, "Preparing…", "Подготовка…")
              : setup
                ? tx(locale, "New QR code", "Новый QR-код")
                : tx(locale, "Generate setup QR", "Создать QR-код")}
          </Button>
        )}
      </FieldRow>
      {!enabled && setup ? (
        <form action={enableTotpAction} className="grid gap-5 border-t border-white/[0.06] px-5 py-5 sm:grid-cols-[auto_minmax(0,1fr)]">
          <input type="hidden" name="secret" value={setup.secret} />
          <div className="w-fit rounded-lg bg-white p-2.5">
            <Image src={setup.qr} alt={tx(locale, "Google Authenticator QR", "QR-код для Google Authenticator")} width={136} height={136} />
          </div>
          <div className="grid content-start gap-4">
            <Field label={tx(locale, "Secret key", "Секретный ключ")} hint={tx(locale, "Type it in if you cannot scan the code.", "Введите его вручную, если код не сканируется.")}>
              <p className="break-all rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 font-mono text-xs text-zinc-300">{setup.secret}</p>
            </Field>
            <Field label={tx(locale, "Code from the app", "Код из приложения")} htmlFor={`${id}-token`}>
              <div className="flex gap-2">
                <Input
                  id={`${id}-token`}
                  name="token"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder={tx(locale, "6-digit code", "6-значный код")}
                  className="max-w-44 font-mono tracking-[0.2em]"
                />
                <Button type="submit">{tx(locale, "Enable 2FA", "Включить 2FA")}</Button>
              </div>
            </Field>
          </div>
        </form>
      ) : null}
    </div>
  );
}
