"use client";

import { acceptInviteAction } from "@/app/actions";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function JoinWorkspaceForm({
  compact = false,
  className,
  locale = "en",
}: {
  compact?: boolean;
  className?: string;
  locale?: Locale;
}) {
  return (
    <form action={acceptInviteAction} className={className || ""}>
      <div className={compact ? "flex gap-2" : "grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]"}>
        <Input
          name="token"
          placeholder={locale === "ru" ? "Вставьте ссылку-приглашение или токен" : "Paste invite link or token"}
          className={compact ? "h-9 text-xs" : undefined}
        />
        <Button type="submit" size={compact ? "sm" : "default"} variant="secondary">
          {t(locale, "joinWorkspace")}
        </Button>
      </div>
    </form>
  );
}

