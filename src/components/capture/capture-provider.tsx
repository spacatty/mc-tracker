"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Toaster, toast } from "sonner";
import { deleteItemsAction, getCaptureContextAction, type CaptureContextPayload } from "@/app/actions";
import type { Locale } from "@/lib/i18n";
import { QuickCapture, type CaptureSaveResult } from "./quick-capture";
import { tx } from "./shared";

type CaptureApi = {
  openCapture: (options?: { text?: string }) => void;
  /** Pages that show the inspector register here so "open" links from anywhere reach it. */
  registerEntryOpener: (opener: ((id: number) => void) | null) => void;
  openEntry: (id: number) => void;
};

const CaptureContext = createContext<CaptureApi | null>(null);

export function useCapture() {
  const api = useContext(CaptureContext);
  if (!api) throw new Error("useCapture must be used inside CaptureProvider");
  return api;
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || Boolean(target.closest("[role=dialog]"));
}

export function CaptureProvider({ workspaceId, locale, children }: { workspaceId: number | null; locale: Locale; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [initialText, setInitialText] = useState("");
  const [openCount, setOpenCount] = useState(0);
  const [loaded, setLoaded] = useState<{ workspaceId: number | null; payload: CaptureContextPayload } | null>(null);
  const [loading, setLoading] = useState(false);
  const entryOpener = useRef<((id: number) => void) | null>(null);
  const categoryParam = Number(searchParams.get("category") || 0) || null;
  const defaultCategoryId = pathname === "/app/items" ? categoryParam : null;

  const loadContext = useCallback(async () => {
    setLoading(true);
    try {
      setLoaded({ workspaceId, payload: await getCaptureContextAction(workspaceId) });
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);
  const payload = loaded?.workspaceId === workspaceId ? loaded.payload : null;

  // Fetch ahead of time so the panel opens with its final content instead of growing mid-animation.
  useEffect(() => {
    let live = true;
    void getCaptureContextAction(workspaceId).then((next) => { if (live) setLoaded({ workspaceId, payload: next }); });
    return () => { live = false; };
  }, [workspaceId]);

  const openCapture = useCallback((options?: { text?: string }) => {
    setInitialText(options?.text || "");
    setOpenCount((count) => count + 1);
    setOpen(true);
    void loadContext();
  }, [loadContext]);

  const openEntry = useCallback((id: number) => {
    if (entryOpener.current) entryOpener.current(id);
    else router.push(`/app/items?workspace=${workspaceId || ""}&entry=${id}`);
  }, [router, workspaceId]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === "k") {
        event.preventDefault();
        openCapture();
        return;
      }
      if (key === "n" && !event.metaKey && !event.ctrlKey && !event.altKey && !isTypingTarget(event.target)) {
        event.preventDefault();
        openCapture();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openCapture]);

  function onSaved(result: CaptureSaveResult) {
    setOpen(false);
    router.refresh();
    const parts = [
      result.created.length ? tx(locale, `${result.created.length} added`, `добавлено: ${result.created.length}`) : "",
      result.updated ? tx(locale, `${result.updated} updated`, `изменено: ${result.updated}`) : "",
      result.paid ? tx(locale, `${result.paid} payments recorded`, `оплат: ${result.paid}`) : "",
    ].filter(Boolean);
    const created = result.created;
    toast.success(parts.join(" · ") || tx(locale, "Saved", "Сохранено"), {
      description: created.length === 1 ? tx(locale, "Press N to add another.", "Нажмите N, чтобы добавить ещё.") : undefined,
      action: created.length && workspaceId
        ? {
            label: tx(locale, "Undo", "Отменить"),
            onClick: async () => {
              const formData = new FormData();
              formData.set("workspaceId", String(workspaceId));
              created.forEach((id) => formData.append("ids", String(id)));
              await deleteItemsAction(formData);
              router.refresh();
              toast(tx(locale, "Removed again", "Удалено"));
            },
          }
        : undefined,
    });
  }

  const api = useMemo<CaptureApi>(() => ({
    openCapture,
    openEntry,
    registerEntryOpener: (opener) => { entryOpener.current = opener; },
  }), [openCapture, openEntry]);

  return (
    <CaptureContext.Provider value={api}>
      {children}
      <QuickCapture
        key={openCount}
        open={open}
        onOpenChange={setOpen}
        payload={payload}
        loading={loading}
        initialText={initialText}
        defaultCategoryId={defaultCategoryId}
        locale={locale}
        onSaved={onSaved}
        onOpenEntry={openEntry}
      />
      <Toaster theme="dark" position="bottom-center" richColors closeButton toastOptions={{ className: "!rounded-xl !border-white/10 !bg-zinc-950/95 !backdrop-blur-xl" }} />
    </CaptureContext.Provider>
  );
}
