"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { enableTotpAction, getTotpSetupAction } from "@/app/actions";
import type { Locale } from "@/lib/i18n";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type Setup = {
  secret: string;
  qr: string;
  otpAuthUrl: string;
};

export function TotpSetup({ enabled, locale = "en" }: { enabled: boolean; locale?: Locale }) {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="text-lg font-semibold text-white">Google Authenticator 2FA</h2>
      <p className="mt-1 text-sm text-zinc-400">
        {enabled
          ? (locale === "ru" ? "2FA включена для вашего аккаунта." : "2FA is enabled for your account.")
          : (locale === "ru" ? "Сканируйте QR-код в Google Authenticator и подтвердите один код." : "Scan a QR code with Google Authenticator and verify one code.")}
      </p>
      {!enabled ? (
        <div className="mt-4 space-y-4">
          <Button
            type="button"
            onClick={() => startTransition(async () => setSetup(await getTotpSetupAction()))}
            variant="secondary"
          >
            {isPending ? (locale === "ru" ? "Подготовка..." : "Preparing...") : (locale === "ru" ? "Сгенерировать QR" : "Generate setup QR")}
          </Button>
          {setup ? (
            <form action={enableTotpAction} className="grid gap-3 md:grid-cols-[160px_1fr]">
              <div className="rounded-xl bg-white p-3">
                <Image src={setup.qr} alt={locale === "ru" ? "QR Google Authenticator" : "Google Authenticator QR"} width={136} height={136} />
              </div>
              <div className="space-y-3">
                <input type="hidden" name="secret" value={setup.secret} />
                <p className="break-all rounded-xl bg-black/30 p-3 font-mono text-xs text-zinc-300">{setup.secret}</p>
                <Input
                  name="token"
                  placeholder={locale === "ru" ? "6-значный код" : "6-digit code"}
                />
                <Button>{locale === "ru" ? "Включить 2FA" : "Enable 2FA"}</Button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
