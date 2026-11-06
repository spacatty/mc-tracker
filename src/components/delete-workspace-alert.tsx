"use client";

import { Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteWorkspaceAction } from "@/app/actions";
import { tx } from "@/components/capture/shared";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { Button } from "./ui/button";
import { ConfirmDialog } from "./ui/dialog";

/** "Delete workspace" button + confirmation. Submits `deleteWorkspaceAction` with `workspaceId`. */
export function DeleteWorkspaceAlert({
  workspaceId,
  workspaceName,
  locale = "en",
}: {
  workspaceId: number;
  workspaceName: string;
  locale?: Locale;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const currentWorkspace = useSearchParams().get("workspace");

  function confirm() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("workspaceId", String(workspaceId));
      if (currentWorkspace) formData.set("currentWorkspace", currentWorkspace);
      await deleteWorkspaceAction(formData);
      setOpen(false);
    });
  }

  return (
    <>
      <Button type="button" size="sm" variant="destructive" onClick={() => setOpen(true)}>
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        {t(locale, "deleteWorkspace")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        destructive
        pending={pending}
        title={t(locale, "deleteWorkspaceConfirm")}
        description={
          locale === "ru" ? (
            <>
              Пространство <span className="font-medium text-zinc-200">{workspaceName}</span> и все его данные будут удалены навсегда. Это
              нельзя отменить.
            </>
          ) : (
            <>
              This permanently removes <span className="font-medium text-zinc-200">{workspaceName}</span> and all of its data. This cannot be
              undone.
            </>
          )
        }
        confirmLabel={t(locale, "deleteWorkspace")}
        cancelLabel={t(locale, "cancel")}
        closeLabel={tx(locale, "Close delete workspace dialog", "Закрыть окно удаления пространства")}
        onConfirm={confirm}
      />
    </>
  );
}
