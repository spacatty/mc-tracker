"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { ArrowRight, CornerDownLeft, Languages, PanelLeft, Plus, Search, Tags } from "lucide-react";
import { getCaptureContextAction, setLanguageAction } from "@/app/actions";
import type { Locale } from "@/lib/i18n";
import type { Category, Workspace } from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";
import { useCapture } from "./capture/capture-provider";
import { Kbd, tx } from "./capture/shared";
import { AppIcon } from "./icons";

/** Anything can open the palette by dispatching this event on window. */
export const OPEN_PALETTE_EVENT = "mc-open-palette";

export type PaletteNavItem = { href: string; label: string; icon: string; accent: string };

type PaletteEntry = { id: number; name: string; vendorName: string; accountName: string; amount: number; currency: string; categoryId: number | null };

function withWorkspace(href: string, workspaceId: number | null) {
  if (!workspaceId) return href;
  return `${href}${href.includes("?") ? "&" : "?"}workspace=${workspaceId}`;
}

function isMac() {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
}

function Tile({ children, className, style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-md border border-white/[0.06] bg-white/[0.03] text-zinc-400 transition-colors group-data-[selected=true]:border-white/15 group-data-[selected=true]:bg-white/[0.08]", className)} style={style}>
      {children}
    </span>
  );
}

function Row({ value, keywords, onSelect, icon, label, detail }: { value: string; keywords?: string[]; onSelect: () => void; icon: ReactNode; label: ReactNode; detail?: ReactNode }) {
  return (
    <Command.Item
      value={value}
      keywords={keywords}
      onSelect={onSelect}
      className="group flex h-10 cursor-pointer select-none items-center gap-2.5 rounded-lg px-2 text-[13px] text-zinc-300 outline-none data-[selected=true]:bg-white/[0.06] data-[selected=true]:text-zinc-50"
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {detail ? <span className="max-w-[45%] shrink-0 truncate text-xs text-zinc-500">{detail}</span> : null}
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-600 opacity-0 transition group-data-[selected=true]:opacity-100" />
    </Command.Item>
  );
}

const groupClass =
  "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.16em] [&_[cmdk-group-heading]]:text-zinc-600";

/** Ctrl+/ (⌘/ on Mac) jump-anywhere palette: pages, actions, workspaces, categories and entries. */
export function CommandPalette({
  locale,
  pages,
  workspaces,
  categories,
  currentWorkspaceId,
  currentHref,
  canCreate,
  onToggleSidebar,
}: {
  locale: Locale;
  pages: PaletteNavItem[];
  workspaces: Workspace[];
  categories: Category[];
  currentWorkspaceId: number | null;
  currentHref: string;
  canCreate: boolean;
  onToggleSidebar: () => void;
}) {
  const router = useRouter();
  const { openCapture, openEntry } = useCapture();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<PaletteEntry[] | null>(null);
  const [mac, setMac] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMac(isMac()));
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && (event.key === "/" || event.code === "Slash")) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, []);

  // Entries are fetched on open for the current workspace, so the palette never ships them with every page.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getCaptureContextAction(currentWorkspaceId)
      .then((payload) => {
        if (!cancelled) setEntries(payload.entries);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, currentWorkspaceId]);

  const workspaceCategories = useMemo(() => categories.filter((category) => category.workspaceId === currentWorkspaceId), [categories, currentWorkspaceId]);
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);

  function run(action: () => void) {
    setOpen(false);
    setQuery("");
    action();
  }

  function go(href: string) {
    run(() => router.push(href));
  }

  function setLanguage(next: Locale) {
    run(() => {
      const form = new FormData();
      form.set("locale", next);
      form.set("next", currentHref);
      void setLanguageAction(form);
    });
  }

  const typing = query.trim().length > 0;

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(""); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="capture-overlay-in fixed inset-0 z-50 bg-black/60 backdrop-blur-md" />
        <Dialog.Content
          aria-describedby={undefined}
          className="capture-panel-in fixed inset-x-0 top-[16vh] z-50 mx-auto flex max-h-[64vh] w-[calc(100vw-1.5rem)] max-w-[600px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#101013] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.85)] outline-none"
        >
          <Dialog.Title className="sr-only">{tx(locale, "Go to", "Перейти")}</Dialog.Title>
          <Command loop className="flex min-h-0 flex-1 flex-col" label={tx(locale, "Go to", "Перейти")}>
            <div className="flex items-center gap-3 border-b border-white/[0.06] px-5">
              <Search className="h-4 w-4 shrink-0 text-zinc-500" />
              <Command.Input
                autoFocus
                value={query}
                onValueChange={setQuery}
                placeholder={tx(locale, "Jump to a page, workspace, category or entry…", "Перейти к странице, пространству, категории или записи…")}
                className="h-14 w-full bg-transparent text-[15px] font-medium text-zinc-50 outline-none placeholder:font-normal placeholder:text-zinc-600"
              />
              <Kbd className="shrink-0">Esc</Kbd>
            </div>

            <Command.List className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
              <Command.Empty className="py-10 text-center text-sm text-zinc-500">{tx(locale, "Nothing matches.", "Ничего не найдено.")}</Command.Empty>

              {canCreate ? (
                <Command.Group heading={tx(locale, "Actions", "Действия")} className={groupClass}>
                  <Row
                    value="action-new-entry"
                    keywords={["new", "create", "add", "entry", "новая", "запись", "добавить"]}
                    onSelect={() => run(() => openCapture())}
                    icon={<Tile className="btn-aurora border-white/10 text-zinc-50"><Plus className="h-3.5 w-3.5" /></Tile>}
                    label={tx(locale, "New Entry", "Новая запись")}
                    detail={<Kbd>N</Kbd>}
                  />
                  {!typing ? null : (
                    <>
                      <Row value="action-sidebar" keywords={["sidebar", "collapse", "expand", "меню"]} onSelect={() => run(onToggleSidebar)} icon={<Tile><PanelLeft className="h-3.5 w-3.5" /></Tile>} label={tx(locale, "Toggle sidebar", "Свернуть / развернуть меню")} />
                      <Row value="action-lang-en" keywords={["language", "english", "язык"]} onSelect={() => setLanguage("en")} icon={<Tile><Languages className="h-3.5 w-3.5" /></Tile>} label="English" detail={locale === "en" ? tx(locale, "current", "текущий") : undefined} />
                      <Row value="action-lang-ru" keywords={["language", "russian", "язык", "русский"]} onSelect={() => setLanguage("ru")} icon={<Tile><Languages className="h-3.5 w-3.5" /></Tile>} label="Русский" detail={locale === "ru" ? tx(locale, "current", "текущий") : undefined} />
                    </>
                  )}
                </Command.Group>
              ) : null}

              <Command.Group heading={tx(locale, "Pages", "Страницы")} className={groupClass}>
                {pages.map((page) => (
                  <Row
                    key={page.href}
                    value={`page-${page.href}`}
                    keywords={[page.label, page.href.replace("/app/", "")]}
                    onSelect={() => go(withWorkspace(page.href, currentWorkspaceId))}
                    icon={<Tile><AppIcon name={page.icon} className={cn("h-3.5 w-3.5", page.accent)} /></Tile>}
                    label={page.label}
                    detail={page.href.replace("/app", "") || "/"}
                  />
                ))}
              </Command.Group>

              {workspaces.length > 1 || typing ? (
                <Command.Group heading={tx(locale, "Workspaces", "Пространства")} className={groupClass}>
                  {workspaces.map((workspace) => (
                    <Row
                      key={workspace.id}
                      value={`workspace-${workspace.id}`}
                      keywords={[workspace.name, "workspace", "пространство"]}
                      onSelect={() => go(withWorkspace("/app", workspace.id))}
                      icon={<Tile className="text-sm">{workspace.emoji}</Tile>}
                      label={workspace.name}
                      detail={workspace.id === currentWorkspaceId ? tx(locale, "current", "текущее") : workspace.accessRole}
                    />
                  ))}
                </Command.Group>
              ) : null}

              {workspaceCategories.length ? (
                <Command.Group heading={tx(locale, "Categories", "Категории")} className={groupClass}>
                  {workspaceCategories.map((category) => (
                    <Row
                      key={category.id}
                      value={`category-${category.id}`}
                      keywords={[category.name, "category", "категория"]}
                      onSelect={() => go(withWorkspace(`/app/items?category=${category.id}`, currentWorkspaceId))}
                      icon={<Tile style={{ color: category.color, backgroundColor: `${category.color}14`, borderColor: `${category.color}26` }}><AppIcon name={category.icon} className="h-3.5 w-3.5" /></Tile>}
                      label={category.name}
                    />
                  ))}
                  {typing ? (
                    <Row value="category-manage" keywords={["manage", "categories", "категории"]} onSelect={() => go(withWorkspace("/app/categories", currentWorkspaceId))} icon={<Tile><Tags className="h-3.5 w-3.5" /></Tile>} label={tx(locale, "Manage categories", "Управление категориями")} />
                  ) : null}
                </Command.Group>
              ) : null}

              {/* Entries only show once you type, so the empty palette stays a short menu. */}
              {typing && entries?.length ? (
                <Command.Group heading={tx(locale, "Entries", "Записи")} className={groupClass}>
                  {entries.map((entry) => {
                    const category = entry.categoryId ? categoryById.get(entry.categoryId) : undefined;
                    return (
                      <Row
                        key={entry.id}
                        value={`entry-${entry.id}`}
                        keywords={[entry.name, entry.vendorName, entry.accountName, category?.name || ""].filter(Boolean)}
                        onSelect={() => run(() => openEntry(entry.id))}
                        icon={<Tile style={category ? { color: category.color } : undefined}><AppIcon name={category?.icon || "WalletCards"} className="h-3.5 w-3.5" /></Tile>}
                        label={<>{entry.name}{entry.vendorName ? <span className="text-zinc-600"> · {entry.vendorName}</span> : null}</>}
                        detail={<span className="tabular-nums">{formatMoney(entry.amount, entry.currency)}</span>}
                      />
                    );
                  })}
                </Command.Group>
              ) : null}
            </Command.List>

            <div className="flex items-center gap-4 border-t border-white/[0.06] px-5 py-2.5 text-[11px] text-zinc-500">
              <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd>{tx(locale, "move", "выбор")}</span>
              <span className="flex items-center gap-1"><Kbd><CornerDownLeft className="h-3 w-3" /></Kbd>{tx(locale, "open", "открыть")}</span>
              <span className="ml-auto flex items-center gap-1"><Kbd>{mac ? "⌘" : "Ctrl"}</Kbd><Kbd>/</Kbd>{tx(locale, "toggle", "открыть/закрыть")}</span>
            </div>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
