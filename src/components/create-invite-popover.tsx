"use client";

import { Link2, UserPlus2 } from "lucide-react";
import { createInviteAction } from "@/app/actions";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { Button } from "./ui/button";
import { SelectInput } from "./ui/hidden-input";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export function CreateInvitePopover({ workspaceId, locale = "en" }: { workspaceId: number; locale?: Locale }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 rounded-full border-violet-300/35 bg-transparent px-2.5 text-xs text-violet-100 hover:bg-violet-500/12">
          <Link2 className="h-3.5 w-3.5" />
          {t(locale, "createInvite")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 border-violet-400/20 bg-zinc-950/95 p-3">
        <form action={createInviteAction} className="space-y-3">
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">{locale === "ru" ? "Роль доступа" : "Share role"}</p>
            <p className="mt-1 text-xs text-zinc-500">{locale === "ru" ? "Выберите уровень доступа для пользователей по этой ссылке." : "Select access level for users joining with this link."}</p>
          </div>
          <SelectInput
            name="role"
            defaultValue="viewer"
            options={[
              { value: "viewer", label: "viewer" },
              { value: "editor", label: "editor" },
            ]}
          />
          <Button className="w-full border border-violet-300/30 bg-violet-500/20 text-violet-100 hover:bg-violet-500/30">
            <UserPlus2 className="h-4 w-4" />
            {locale === "ru" ? "Сгенерировать ссылку" : "Generate link"}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

