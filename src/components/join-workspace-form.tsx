"use client";

import { useId } from "react";
import { acceptInviteAction } from "@/app/actions";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
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
  const id = useId();
  const placeholder = locale === "ru" ? "Вставьте ссылку-приглашение или токен" : "Paste invite link or token";
  return (
    <form action={acceptInviteAction} className={className || ""}>
      <div className={cn("flex gap-2", !compact && "flex-col sm:flex-row")}>
        <label htmlFor={`${id}-token`} className="sr-only">
          {placeholder}
        </label>
        <Input id={`${id}-token`} name="token" placeholder={placeholder} className={cn("min-w-0 flex-1", compact && "h-8 text-[13px]")} />
        <Button type="submit" size={compact ? "sm" : "default"} variant="secondary">
          {t(locale, "joinWorkspace")}
        </Button>
      </div>
    </form>
  );
}
