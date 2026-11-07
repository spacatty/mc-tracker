"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams, type ReadonlyURLSearchParams } from "next/navigation";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Bell, Check, ChevronDown, ChevronsUpDown, GripVertical, Languages, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Plus, Search, Settings, Shield, UserPlus, Users, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { logoutAction, setLanguageAction } from "@/app/actions";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import type { Category, User, Workspace } from "@/lib/types";
import { cn, softColor, softFill } from "@/lib/utils";
import { QuickCaptureButton } from "./capture/quick-capture-button";
import { Kbd } from "./capture/shared";
import { TableStyleSync, TableStyleToggle } from "./table-style";
import { CommandPalette, OPEN_PALETTE_EVENT } from "./command-palette";
import { CaptureProvider } from "./capture/capture-provider";
import { AppIcon, BrandLogo, BrandWordmark } from "./icons";
import { JoinWorkspaceDialog } from "./join-workspace-dialog";
import { Button } from "./ui/button";
import { Command as CommandPrimitive } from "cmdk";
import { Command, CommandEmpty, CommandItem, CommandList } from "./ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Tooltip } from "./ui/tooltip";

type SidebarNavItem = {
  href: string;
  label: string;
  icon: string;
  accent: string;
};

function withWorkspace(href: string, workspaceId: number | null) {
  if (!workspaceId) return href;
  const hasQuery = href.includes("?");
  return `${href}${hasQuery ? "&" : "?"}workspace=${workspaceId}`;
}

function SidebarSection({
  title,
  collapsed,
  action,
  children,
}: {
  title: string;
  collapsed: boolean;
  /** A small icon control in the group header (e.g. "+" to manage categories). */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-1">
      {!collapsed ? (
        <div className="flex h-6 items-center justify-between pb-1 pl-2 pr-1">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{title}</p>
          {action}
        </div>
      ) : (
        <>
          <div className="mx-auto mb-1 h-px w-5 bg-white/[0.06]" aria-hidden="true" />
          {action ? <div className="flex justify-center pb-0.5">{action}</div> : null}
        </>
      )}
      <div className="space-y-px">{children}</div>
    </section>
  );
}

/** The "+" in the Categories group header: opens the categories page on the empty form. */
function ManageCategoriesAction({ workspaceId, locale }: { workspaceId: number | null; locale: Locale }) {
  const base = withWorkspace("/app/categories", workspaceId);
  return (
    <Tooltip label={t(locale, "manageCategories")}>
      <Link
        href={`${base}${base.includes("?") ? "&" : "?"}new=1`}
        aria-label={t(locale, "manageCategories")}
        className="grid h-5 w-5 place-items-center rounded text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </Tooltip>
  );
}

/** One row style for every sidebar link, so nav items, categories and notifications line up. */
const sidebarRowClass = (active: boolean, collapsed: boolean) =>
  cn(
    "group relative flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] text-zinc-400 transition hover:bg-white/[0.04] hover:text-zinc-100",
    active && "bg-white/[0.06] text-zinc-50",
    collapsed && "mx-auto w-8 justify-center px-0",
  );

function UserAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-md border border-white/[0.08] bg-white/[0.04] text-xs font-semibold uppercase text-zinc-200", className)}>
      {name.slice(0, 1) || "?"}
    </span>
  );
}

function SidebarNavLink({
  item,
  active,
  collapsed,
  workspaceId,
  onClick,
}: {
  item: SidebarNavItem;
  active: boolean;
  collapsed: boolean;
  workspaceId?: number | null;
  onClick?: () => void;
}) {
  return (
    <Link
      href={withWorkspace(item.href, workspaceId || null)}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={sidebarRowClass(active, collapsed)}
    >
      <AppIcon name={item.icon} className={cn("h-4 w-4 shrink-0 transition group-hover:brightness-125", item.accent || "text-zinc-400/80", active && "brightness-125")} />
      {!collapsed ? <span className="truncate">{item.label}</span> : null}
    </Link>
  );
}

function fuzzyMatch(value: string, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  let index = 0;
  const text = value.toLowerCase();
  for (const char of normalized) {
    index = text.indexOf(char, index);
    if (index === -1) return false;
    index += 1;
  }
  return true;
}

function WorkspaceSelect({
  workspaces,
  currentWorkspaceId,
  pathname,
  searchParams,
  collapsed,
  locale,
  onSelected,
  placement = "bottom",
  align = "start",
}: {
  placement?: "top" | "bottom";
  align?: "start" | "end";
  workspaces: Workspace[];
  currentWorkspaceId?: number;
  pathname: string;
  searchParams: ReadonlyURLSearchParams;
  collapsed: boolean;
  locale: Locale;
  onSelected?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const currentWorkspace = workspaces.find((workspace) => workspace.id === currentWorkspaceId) || workspaces[0];
  const filteredWorkspaces = useMemo(
    () =>
      workspaces.filter((workspace) =>
        fuzzyMatch(`${workspace.name} ${workspace.emoji} ${workspace.accessRole} ${workspace.ownerUsername || ""}`, query),
      ),
    [query, workspaces],
  );

  function getTargetHref(workspaceId: number) {
    const basePath = pathname === "/" ? "/app" : pathname;
    const params = new URLSearchParams(searchParams.toString());
    params.set("workspace", String(workspaceId));
    const nextParams = params.toString();
    return nextParams ? `${basePath}?${nextParams}` : basePath;
  }

  function selectWorkspace(workspaceId: number) {
    router.push(getTargetHref(workspaceId));
    setOpen(false);
    setQuery("");
    onSelected?.();
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={collapsed ? (currentWorkspace ? `${t(locale, "workspace")}: ${currentWorkspace.name}` : t(locale, "workspace")) : undefined}
          className={cn(
            // Plain text trigger: no box, just a tint on hover or while open.
            "group flex h-8 min-w-0 max-w-full items-center gap-2 rounded-md px-1.5 text-left text-[13px] font-medium text-zinc-200 transition hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40 data-[state=open]:bg-white/[0.05]",
            collapsed && "w-8 justify-center px-0",
          )}
        >
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-[5px] bg-violet-500/15 text-[11px] leading-none">
            {currentWorkspace?.emoji || "📦"}
          </span>
          {!collapsed ? (
            <>
              <span className="min-w-0 truncate">{currentWorkspace?.name || t(locale, "workspace")}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-500 transition group-hover:text-zinc-300 group-data-[state=open]:rotate-180" />
            </>
          ) : null}
        </button>
      </PopoverTrigger>
      {/* Same look as the Quick Capture suggestion menu: tinted glass, small caps header, tiled rows. */}
      <PopoverContent
        align={align}
        side={collapsed ? "right" : placement}
        sideOffset={6}
        className="suggest-in w-[248px] overflow-hidden rounded-xl border-white/10 bg-[#18181c] p-0 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)]"
      >
        <Command shouldFilter={false} className="rounded-none bg-transparent">
          <div className="flex items-center gap-2 px-3 pb-1 pt-2.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
            <span className="truncate">{t(locale, "switchWorkspace")}</span>
            <span className="ml-auto font-medium tabular-nums tracking-normal text-zinc-600">{workspaces.length}</span>
          </div>
          {workspaces.length > 5 ? (
            <div className="px-1.5 pb-1">
              <CommandPrimitive.Input
                value={query}
                onValueChange={setQuery}
                placeholder={t(locale, "searchWorkspace")}
                className="h-7 w-full rounded-md border border-white/10 bg-white/[0.03] px-2 text-xs text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-white/20 focus:ring-2 focus:ring-violet-400/25"
              />
            </div>
          ) : null}
          <CommandList className="max-h-64 px-1.5 pb-1.5">
            <CommandEmpty className="py-4 text-center text-xs text-zinc-500">{locale === "ru" ? "Ничего не найдено" : "No match"}</CommandEmpty>
            {filteredWorkspaces.map((workspace) => {
              const current = workspace.id === currentWorkspace?.id;
              return (
                <CommandItem
                  key={workspace.id}
                  value={`${workspace.name}-${workspace.id}`}
                  onSelect={() => selectWorkspace(workspace.id)}
                  title={workspace.accessRole !== "owner" ? `${workspace.ownerUsername ? `${workspace.ownerUsername} · ` : ""}${workspace.accessRole}` : undefined}
                  className={cn("h-8 gap-2.5 rounded-md px-2 py-0 text-[13px]", current && "text-zinc-50")}
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center text-[13px] leading-none">{workspace.emoji}</span>
                  <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
                  {current ? <Check className="h-3.5 w-3.5 shrink-0 text-violet-300" /> : workspace.accessRole !== "owner" ? <Users className="h-3 w-3 shrink-0 text-zinc-600" /> : null}
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
        <div className="border-t border-white/[0.06] p-1.5">
          <Link
            href={`/app/folders${currentWorkspace ? `?workspace=${currentWorkspace.id}` : ""}`}
            onClick={() => { setOpen(false); onSelected?.(); }}
            className="flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-left text-[13px] text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-100"
          >
            <span className="grid h-5 w-5 shrink-0 place-items-center"><Settings className="h-3.5 w-3.5" /></span>
            <span className="truncate">{t(locale, "shareAndSpace")}</span>
          </Link>
          <JoinWorkspaceDialog
            locale={locale}
            trigger={(
              <button type="button" className="flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-left text-[13px] text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-100">
                <span className="grid h-5 w-5 shrink-0 place-items-center"><UserPlus className="h-3.5 w-3.5" /></span>
                <span className="truncate">{t(locale, "joinWorkspace")}</span>
              </button>
            )}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SortableSidebarCategory({
  category,
  collapsed,
  active,
  workspaceId,
  reorderLabel,
}: {
  category: Category;
  collapsed: boolean;
  active: boolean;
  workspaceId?: number | null;
  reorderLabel: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: category.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <Link
        href={withWorkspace(`/app/items?category=${category.id}`, workspaceId || null)}
        title={collapsed ? category.name : undefined}
        className={sidebarRowClass(active, collapsed)}
      >
        <CategoryIcon category={category} />
        {!collapsed ? <span className="min-w-0 flex-1 truncate">{category.name}</span> : null}
        {!collapsed ? (
          <button {...attributes} {...listeners} className="-mr-1 cursor-grab rounded-sm p-0.5 text-zinc-600 opacity-0 transition hover:text-zinc-300 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40 group-hover:opacity-100" type="button" aria-label={reorderLabel}>
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </Link>
    </div>
  );
}

function CategoryIcon({ category }: { category: Pick<Category, "color" | "icon"> }) {
  return (
    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-[5px]" style={{ backgroundColor: softFill(category.color, 10), color: softColor(category.color, 70) }}>
      <AppIcon name={category.icon} className="h-3 w-3" />
    </span>
  );
}

/** Two-option language switch; posts straight to the locale cookie action and comes back to the same page. */
function LanguageSwitch({ locale, next }: { locale: Locale; next: string }) {
  return (
    <form action={setLanguageAction} className="flex items-center justify-between gap-3 px-2 py-1.5">
      <input type="hidden" name="next" value={next} />
      <span className="flex items-center gap-2 text-[13px] text-zinc-300">
        <Languages className="h-3.5 w-3.5 text-zinc-500" />
        {t(locale, "language")}
      </span>
      <span className="inline-flex gap-0.5 rounded-lg bg-white/[0.04] p-0.5">
        {(["en", "ru"] as const).map((option) => (
          <button
            key={option}
            type="submit"
            name="locale"
            value={option}
            aria-pressed={locale === option}
            className={cn(
              "h-6 rounded-md px-2 text-[11px] font-semibold uppercase transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40",
              locale === option ? "bg-white/[0.08] text-white" : "text-zinc-400 hover:text-zinc-200",
            )}
          >
            {option}
          </button>
        ))}
      </span>
    </form>
  );
}

function ProfileMenu({
  user,
  locale,
  collapsed,
  workspaceId,
  currentHref,
}: {
  user: User;
  locale: Locale;
  collapsed: boolean;
  workspaceId: number | null;
  currentHref: string;
}) {
  const isAdmin = user.role === "admin" || user.role === "superadmin";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={t(locale, "profile")}
          className={cn(
            "group flex h-8 w-full min-w-0 items-center gap-2 rounded-md px-1 text-left transition hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40 data-[state=open]:bg-white/[0.05]",
            collapsed && "mx-auto w-8 justify-center p-0",
          )}
        >
          <UserAvatar name={user.username} className="h-6 w-6 text-[10px]" />
          {!collapsed ? (
            <>
              <span className="min-w-0 flex-1 truncate text-xs text-zinc-300">{user.username}</span>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-zinc-600 transition group-hover:text-zinc-400" />
            </>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={collapsed ? "right" : "top"} align={collapsed ? "end" : "start"} sideOffset={6} className="w-52">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <UserAvatar name={user.username} className="h-8 w-8" />
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium text-zinc-100">{user.username}</span>
            <span className="block text-[11.5px] capitalize text-zinc-500">{user.role}</span>
          </span>
        </div>
        <DropdownMenuSeparator />
        {isAdmin ? (
          <DropdownMenuItem asChild>
            <Link href={withWorkspace("/app/admin", workspaceId)}>
              <Shield />
              {t(locale, "admin")}
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem asChild>
          <Link href={withWorkspace("/app/settings", workspaceId)}>
            <Settings />
            {t(locale, "settings")}
          </Link>
        </DropdownMenuItem>
        <LanguageSwitch locale={locale} next={currentHref} />
        <TableStyleToggle locale={locale} />
        <DropdownMenuSeparator />
        <form action={logoutAction}>
          <DropdownMenuItem asChild destructive onSelect={(event) => event.preventDefault()} className="w-full">
            <button type="submit">
              <LogOut />
              {t(locale, "logout")}
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({
  user,
  workspaces,
  categories,
  children,
  unreadCount,
  locale,
}: {
  user: User;
  workspaces: Workspace[];
  categories: Category[];
  unreadCount: number;
  locale: Locale;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileAsideRef = useRef<HTMLElement>(null);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);
  const [items, setItems] = useState(categories);
  const activeCategoryId = searchParams.get("category");
  const currentWorkspaceId = Number(searchParams.get("workspace") || workspaces[0]?.id || 0) || 0;
  const currentWorkspace = workspaces.find((workspace) => workspace.id === currentWorkspaceId) || workspaces[0];
  const workspaceCategories = items.filter((category) => category.workspaceId === currentWorkspace?.id);
  const primaryNav: SidebarNavItem[] = [
    { href: "/app", label: t(locale, "dashboard"), icon: "LayoutDashboard", accent: "text-violet-300/75" },
    { href: "/app/items", label: t(locale, "entries"), icon: "WalletCards", accent: "text-blue-300/75" },
    { href: "/app/invoices", label: t(locale, "invoices"), icon: "FileText", accent: "text-emerald-300/75" },
    { href: "/app/archive", label: t(locale, "archived"), icon: "Archive", accent: "text-stone-300/70" },
  ];
  const vaultNav: SidebarNavItem[] = [
    { href: "/app/vendors", label: locale === "ru" ? "Поставщики" : "Vendors", icon: "Building2", accent: "text-teal-300/75" },
    { href: "/app/accounts", label: locale === "ru" ? "Аккаунты" : "Accounts", icon: "KeyRound", accent: "text-amber-300/75" },
  ];
  const vaultTitle = locale === "ru" ? "Доступы" : "Vault";
  const workspaceNav: SidebarNavItem[] = [
    { href: "/app/folders", label: t(locale, "shareAndSpace"), icon: "Share2", accent: "text-indigo-300/75" },
  ];
  const extraNav: SidebarNavItem[] = [
    { href: "/app/telegram", label: t(locale, "telegramRoutes"), icon: "MessageCircle", accent: "text-cyan-300/75" },
    { href: "/app/import", label: t(locale, "importData"), icon: "FileUp", accent: "text-lime-300/70" },
  ];
  const workspaceItems = [...workspaceNav];
  const extraItems = [...extraNav];
  const ids = useMemo(() => workspaceCategories.map((item) => item.id), [workspaceCategories]);
  const currentHref = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  const isActive = (href: string) => (href === "/app" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setCollapsed(localStorage.getItem("mc-tracker-sidebar-collapsed") === "true");
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const mobileTrigger = mobileTriggerRef.current;
    mobileCloseRef.current?.focus();
    const handleDrawerKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
      if (event.key !== "Tab") return;
      const focusable = mobileAsideRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleDrawerKeys);
    return () => {
      window.removeEventListener("keydown", handleDrawerKeys);
      mobileTrigger?.focus();
    };
  }, [mobileOpen]);

  function toggleCollapsed() {
    setCollapsed((current) => {
      localStorage.setItem("mc-tracker-sidebar-collapsed", String(!current));
      return !current;
    });
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = workspaceCategories.findIndex((item) => item.id === active.id);
    const newIndex = workspaceCategories.findIndex((item) => item.id === over.id);
    const nextWorkspaceCategories = arrayMove(workspaceCategories, oldIndex, newIndex);
    const otherCategories = items.filter((item) => item.workspaceId !== currentWorkspace?.id);
    const next = [...otherCategories, ...nextWorkspaceCategories];
    setItems(next);
    await fetch("/api/categories/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: currentWorkspace?.id, ids: nextWorkspaceCategories.map((item) => item.id) }),
    });
  }

  const activeCategory = activeCategoryId ? workspaceCategories.find((category) => String(category.id) === activeCategoryId) : undefined;
  const currentPage =
    activeCategory?.name ||
    [...primaryNav, ...vaultNav, ...workspaceItems, ...extraItems]
      .concat([
        { href: "/app/notifications", label: t(locale, "notificationsCenter"), icon: "Bell", accent: "" },
        { href: "/app/categories", label: t(locale, "categories"), icon: "Tags", accent: "" },
        { href: "/app/settings", label: t(locale, "settings"), icon: "Settings", accent: "" },
        { href: "/app/admin", label: t(locale, "admin"), icon: "Shield", accent: "" },
      ])
      .find((item) => (item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href)))?.label;

  return (
    <CaptureProvider workspaceId={currentWorkspace?.id || null} locale={locale}>
    <TableStyleSync />
    <CommandPalette
      locale={locale}
      pages={[
        ...primaryNav,
        ...workspaceItems,
        ...extraItems,
        { href: "/app/notifications", label: t(locale, "notificationsCenter"), icon: "Bell", accent: "" },
        { href: "/app/categories", label: t(locale, "categories"), icon: "Tags", accent: "" },
        { href: "/app/settings", label: t(locale, "settings"), icon: "Settings", accent: "" },
        ...(user.role === "admin" || user.role === "superadmin" ? [{ href: "/app/admin", label: t(locale, "admin"), icon: "Shield", accent: "" }] : []),
      ]}
      workspaces={workspaces}
      categories={items}
      currentWorkspaceId={currentWorkspace?.id || null}
      currentHref={currentHref}
      canCreate={currentWorkspace?.accessRole !== "viewer"}
      onToggleSidebar={toggleCollapsed}
    />
    <div className="flex h-dvh overflow-hidden bg-background">
      <div className="fixed left-0 right-0 top-0 z-40 border-b border-white/[0.06] bg-background/90 px-3 py-2 backdrop-blur md:hidden">
        <div className="flex items-center justify-between">
          <Link href="/app" className="flex items-center gap-2 text-white">
            <span className="grid h-7 w-7 place-items-center">
              <BrandLogo className="h-[22px] w-[22px]" />
            </span>
            <BrandWordmark />
          </Link>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))} aria-label={locale === "ru" ? "Поиск" : "Search"} className="grid h-8 w-8 place-items-center rounded-md text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40">
              <Search className="h-4 w-4" />
            </button>
            <Link href={withWorkspace("/app/notifications", currentWorkspace?.id || null)} aria-label={t(locale, "notifications")} className="relative grid h-8 w-8 place-items-center rounded-md text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40">
              <Bell className="h-4 w-4" />
              {unreadCount ? <span className="absolute -right-1 -top-1 min-w-4 rounded-[4px] bg-red-500 px-1 text-center text-[10px] font-semibold leading-4 tabular-nums text-white">{unreadCount}</span> : null}
            </Link>
            <Button ref={mobileTriggerRef} type="button" variant="ghost" size="icon-sm" onClick={() => setMobileOpen(true)} aria-label={t(locale, "openSidebarMenu")}>
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" className="capture-overlay-in absolute inset-0 bg-black/60 backdrop-blur-sm" aria-label={t(locale, "closeSidebarMenu")} onClick={() => setMobileOpen(false)} />
          <aside ref={mobileAsideRef} role="dialog" aria-modal="true" aria-label={t(locale, "navigation")} className="absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col border-r border-white/[0.06] bg-surface-muted p-3 shadow-overlay">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[15px] font-semibold text-white">{t(locale, "navigation")}</p>
              <Button ref={mobileCloseRef} type="button" variant="ghost" size="icon-sm" onClick={() => setMobileOpen(false)} aria-label={t(locale, "closeSidebarMenu")}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
              <SidebarSection title={t(locale, "workspace")} collapsed={false}>
                <WorkspaceSelect
                  workspaces={workspaces}
                  currentWorkspaceId={currentWorkspace?.id}
                  pathname={pathname}
                  searchParams={searchParams}
                  collapsed={false}
                  locale={locale}
                  onSelected={() => setMobileOpen(false)}
                />
              </SidebarSection>
              <SidebarSection title={t(locale, "main")} collapsed={false}>
                {primaryNav.map((item) => (
                  <SidebarNavLink key={item.href} item={item} active={isActive(item.href) && !activeCategoryId} collapsed={false} workspaceId={currentWorkspace?.id} onClick={() => setMobileOpen(false)} />
                ))}
              </SidebarSection>
              <SidebarSection title={vaultTitle} collapsed={false}>
                {vaultNav.map((item) => (
                  <SidebarNavLink key={item.href} item={item} active={isActive(item.href)} collapsed={false} workspaceId={currentWorkspace?.id} onClick={() => setMobileOpen(false)} />
                ))}
              </SidebarSection>
              <SidebarSection title={t(locale, "workspaceTools")} collapsed={false}>
                {workspaceItems.map((item) => (
                  <SidebarNavLink key={item.href} item={item} active={isActive(item.href)} collapsed={false} workspaceId={currentWorkspace?.id} onClick={() => setMobileOpen(false)} />
                ))}
              </SidebarSection>
              <SidebarSection title={t(locale, "utilities")} collapsed={false}>
                {extraItems.map((item) => (
                  <SidebarNavLink key={item.href} item={item} active={isActive(item.href)} collapsed={false} workspaceId={currentWorkspace?.id} onClick={() => setMobileOpen(false)} />
                ))}
              </SidebarSection>
              <SidebarSection title={t(locale, "categories")} collapsed={false} action={<ManageCategoriesAction workspaceId={currentWorkspace?.id || null} locale={locale} />}>
                {workspaceCategories.map((category) => (
                  <Link
                    key={category.id}
                    href={withWorkspace(`/app/items?category=${category.id}`, currentWorkspace?.id || null)}
                    onClick={() => setMobileOpen(false)}
                    className={sidebarRowClass(pathname === "/app/items" && activeCategoryId === String(category.id), false)}
                  >
                    <CategoryIcon category={category} />
                    <span className="truncate">{category.name}</span>
                  </Link>
                ))}
              </SidebarSection>
            </div>
            <div className="mt-3 border-t border-white/[0.06] pt-2">
              <ProfileMenu user={user} locale={locale} collapsed={false} workspaceId={currentWorkspace?.id || null} currentHref={currentHref} />
            </div>
          </aside>
        </div>
      ) : null}

      <aside
        className={cn(
          "hidden h-full shrink-0 border-r border-white/[0.06] bg-surface-muted transition-[width] duration-200 md:flex md:flex-col",
          collapsed ? "w-[60px]" : "w-52",
        )}
      >
        <div className={cn("flex h-12 shrink-0 items-center gap-2 px-3", collapsed && "flex-col justify-center gap-1 px-0 pt-2 h-auto")}>
          <Link href={withWorkspace("/app", currentWorkspace?.id || null)} className={cn("flex min-w-0 flex-1 items-center gap-2 rounded-md py-1 text-zinc-100", collapsed && "flex-none")} title="MC Tracker">
            <BrandLogo className={cn("shrink-0", collapsed ? "h-[26px] w-[26px]" : "h-[22px] w-[22px]")} />
            {!collapsed ? <BrandWordmark className="truncate" /> : null}
          </Link>
          <Tooltip label={collapsed ? (locale === "ru" ? "Развернуть меню" : "Expand sidebar") : t(locale, "collapseSidebar")}>
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-expanded={!collapsed}
              aria-label={collapsed ? (locale === "ru" ? "Развернуть меню" : "Expand sidebar") : t(locale, "collapseSidebar")}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </Tooltip>
        </div>

        <div className={cn("flex shrink-0 flex-col gap-1.5 px-3 pb-4 pt-1", collapsed && "items-center px-0")}>
          {currentWorkspace?.accessRole !== "viewer" ? <QuickCaptureButton collapsed={collapsed} locale={locale} /> : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          <nav aria-label={t(locale, "primaryNavigation")} className="space-y-4">
            <SidebarSection title={t(locale, "main")} collapsed={collapsed}>
              {primaryNav.map((item) => (
                <SidebarNavLink key={item.href} item={item} active={isActive(item.href) && !activeCategoryId} collapsed={collapsed} workspaceId={currentWorkspace?.id} />
              ))}
            </SidebarSection>

            <SidebarSection title={vaultTitle} collapsed={collapsed}>
              {vaultNav.map((item) => (
                <SidebarNavLink key={item.href} item={item} active={isActive(item.href)} collapsed={collapsed} workspaceId={currentWorkspace?.id} />
              ))}
            </SidebarSection>

            <SidebarSection title={t(locale, "workspaceTools")} collapsed={collapsed}>
              {workspaceItems.map((item) => (
                <SidebarNavLink key={item.href} item={item} active={isActive(item.href)} collapsed={collapsed} workspaceId={currentWorkspace?.id} />
              ))}
            </SidebarSection>

            <SidebarSection title={t(locale, "utilities")} collapsed={collapsed}>
              {extraItems.map((item) => (
                <SidebarNavLink key={item.href} item={item} active={isActive(item.href)} collapsed={collapsed} workspaceId={currentWorkspace?.id} />
              ))}
              <Link
                href={withWorkspace("/app/notifications", currentWorkspace?.id || null)}
                title={collapsed ? t(locale, "notificationsCenter") : undefined}
                className={sidebarRowClass(pathname === "/app/notifications", collapsed)}
              >
                <span className="relative shrink-0">
                  <Bell className="h-4 w-4 text-rose-300/75 transition group-hover:brightness-125" />
                  {collapsed && unreadCount ? <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-red-400" aria-hidden="true" /> : null}
                </span>
                {!collapsed ? <span className="flex-1 truncate">{t(locale, "notificationsCenter")}</span> : null}
                {!collapsed && unreadCount ? (
                  <span className="rounded-md bg-red-500/10 px-1.5 text-[11px] font-semibold leading-[18px] tabular-nums text-red-200 ring-1 ring-inset ring-red-400/20">{unreadCount}</span>
                ) : null}
              </Link>
            </SidebarSection>

            <SidebarSection title={t(locale, "categories")} collapsed={collapsed} action={<ManageCategoriesAction workspaceId={currentWorkspace?.id || null} locale={locale} />}>
              <DndContext id="sidebar-categories" onDragEnd={handleDragEnd}>
                <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                  {workspaceCategories.map((category) => (
                    <SortableSidebarCategory
                      key={category.id}
                      category={category}
                      collapsed={collapsed}
                      workspaceId={currentWorkspace?.id}
                      reorderLabel={locale === "ru" ? "Изменить порядок" : "Reorder"}
                      active={pathname === "/app/items" && activeCategoryId === String(category.id)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </SidebarSection>
          </nav>
        </div>

        <div className={cn("shrink-0 border-t border-white/[0.06] px-3 py-2", collapsed && "flex justify-center px-0")}>
          <ProfileMenu user={user} locale={locale} collapsed={collapsed} workspaceId={currentWorkspace?.id || null} currentHref={currentHref} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 hidden h-12 shrink-0 items-center gap-1.5 border-b border-white/[0.06] bg-background/85 px-4 backdrop-blur md:flex xl:px-6">
          <WorkspaceSelect
            workspaces={workspaces}
            currentWorkspaceId={currentWorkspace?.id}
            pathname={pathname}
            searchParams={searchParams}
            collapsed={false}
            locale={locale}
          />
          {currentPage ? (
            <>
              <span className="text-zinc-600" aria-hidden="true">/</span>
              <span className="truncate px-1.5 text-[13px] text-zinc-400">{currentPage}</span>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
            aria-label={locale === "ru" ? "Поиск" : "Search"}
            className="ml-auto flex h-8 w-full max-w-[300px] items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 text-left text-[13px] text-zinc-500 transition hover:border-white/10 hover:bg-white/[0.05] hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 truncate">{locale === "ru" ? "Поиск записей, поставщиков…" : "Search entries, vendors…"}</span>
            <Kbd className="h-4 min-w-4 text-[9px]">Ctrl /</Kbd>
          </button>
        </header>
        <main id="main-content" className="relative min-h-0 min-w-0 flex-1 overflow-y-auto px-3 py-16 sm:px-5 md:px-6 md:py-6 xl:px-8">{children}</main>
      </div>
    </div>
    </CaptureProvider>
  );
}
