"use client";

import { Link2 } from "lucide-react";
import { createInviteAction } from "@/app/actions";
import { tx } from "@/components/capture/shared";
import type { Locale } from "@/lib/i18n";
import { roleLabel, t } from "@/lib/i18n";
import { CurrentWorkspaceInput } from "./current-workspace-input";
import { Button } from "./ui/button";
import { Field } from "./ui/field";
import { SelectInput } from "./ui/hidden-input";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export function CreateInvitePopover({ workspaceId, locale = "en" }: { workspaceId: number; locale?: Locale }) {
  const triggerId = `invite-role-${workspaceId}`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="accent">
          <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
          {t(locale, "createInvite")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <form action={createInviteAction}>
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <CurrentWorkspaceInput />
          <div className="border-b border-white/[0.06] px-4 py-3">
            <p className="text-[13px] font-semibold text-zinc-100">{t(locale, "createInvite")}</p>
            <p className="mt-0.5 text-[11.5px] leading-[1.125rem] text-zinc-500">
              {tx(locale, "People who join with this link get the role below.", "Все, кто присоединится по этой ссылке, получат выбранную роль.")}
            </p>
          </div>
          <div className="px-4 py-3">
            <Field label={tx(locale, "Role", "Роль")} htmlFor={triggerId}>
              <SelectInput
                name="role"
                defaultValue="viewer"
                triggerId={triggerId}
                options={[
                  { value: "viewer", label: roleLabel(locale, "viewer") },
                  { value: "editor", label: roleLabel(locale, "editor") },
                ]}
              />
            </Field>
          </div>
          <div className="flex justify-end border-t border-white/[0.06] px-4 py-3">
            <Button type="submit" size="sm">
              {tx(locale, "Generate link", "Создать ссылку")}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
