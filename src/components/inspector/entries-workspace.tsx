"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";
import type { Category, PaymentItem, VendorSuggestion } from "@/lib/types";
import { useCapture } from "../capture/capture-provider";
import { EntriesTable } from "../entries-table";
import { EntryInspector } from "./entry-inspector";

/**
 * The entries table plus the inspector panel. The table keeps its layout; a row
 * click opens the entry in the side panel, where it is viewed and edited in place.
 */
export function EntriesWorkspace({
  items,
  categories,
  vendorSuggestions,
  workspaceId,
  workspaceRole,
  selectedCategoryId,
  initialAdd,
  locale,
  tableKey,
}: {
  items: PaymentItem[];
  categories: Category[];
  vendorSuggestions: VendorSuggestion[];
  workspaceId: number;
  workspaceRole: "owner" | "editor" | "viewer";
  selectedCategoryId?: number;
  initialAdd: boolean;
  locale: Locale;
  tableKey: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { registerEntryOpener, openCapture } = useCapture();
  const [openId, setOpenId] = useState<number | null>(() => Number(searchParams.get("entry") || 0) || null);
  const [visibleOrder, setVisibleOrder] = useState<number[]>(() => items.map((item) => item.id));

  const syncUrl = useCallback((id: number | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("entry", String(id));
    else params.delete("entry");
    const query = params.toString();
    window.history.replaceState(null, "", `${pathname}${query ? `?${query}` : ""}`);
  }, [pathname, searchParams]);

  const open = useCallback((id: number | null, order?: number[]) => {
    if (order?.length) setVisibleOrder(order);
    setOpenId(id);
    syncUrl(id);
  }, [syncUrl]);

  useEffect(() => {
    registerEntryOpener((id) => open(id));
    return () => registerEntryOpener(null);
  }, [open, registerEntryOpener]);

  const item = openId ? items.find((candidate) => candidate.id === openId) || null : null;
  const order = visibleOrder.filter((id) => items.some((candidate) => candidate.id === id));
  const index = openId ? order.indexOf(openId) : -1;

  const navigate = useCallback((direction: 1 | -1) => {
    if (!order.length) return;
    const nextIndex = index < 0 ? 0 : (index + direction + order.length) % order.length;
    open(order[nextIndex]);
  }, [index, open, order]);

  return (
    <>
      <EntriesTable
        key={tableKey}
        items={items}
        categories={categories}
        vendorSuggestions={vendorSuggestions}
        workspaceId={workspaceId}
        workspaceRole={workspaceRole}
        selectedCategoryId={selectedCategoryId}
        initialAdd={initialAdd}
        locale={locale}
        activeEntryId={openId}
        onOpenEntry={(id, visibleOrder) => open(id, visibleOrder)}
        onAddEntry={() => openCapture()}
      />
      <EntryInspector
        key={item?.id ?? "none"}
        item={item}
        categories={categories}
        vendorSuggestions={vendorSuggestions}
        workspaceId={workspaceId}
        readOnly={workspaceRole === "viewer"}
        locale={locale}
        position={index >= 0 ? { index, total: order.length } : null}
        onClose={() => open(null)}
        onNavigate={navigate}
      />
    </>
  );
}
