"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams, type ReadonlyURLSearchParams } from "next/navigation";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Bell, Check, ChevronsLeft, ChevronsRight, ChevronsUpDown, GripVertical, Languages, LogOut, Menu, Settings, Shield, UserPlus, UserRound, X } from "lucide-react";
import { useMemo, useState } from "react";
import { logoutAction, setLanguageAction } from "@/app/actions";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import type { Category, User, WebsiteNotification, Workspace } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AppIcon } from "./icons";
import { JoinWorkspaceDialog } from "./join-workspace-dialog";
import { Button } from "./ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Badge } from "./ui/badge";
import { NotificationToasts } from "./notification-toasts";

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
  children,
}: {
  title: string;
  collapsed: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      {!collapsed ? (
        <p className="px-2 text-xs font-semibold uppercase tracking-[0.25em] text-zinc-600">{title}</p>
      ) : (
        <div className="mx-auto h-px w-8 bg-white/10" aria-hidden="true" />
      )}
      <div className="space-y-1">{children}</div>
    </section>
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
      className={cn(
        "group flex items-center gap-3 rounded-2xl px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/[0.07] hover:text-white",
        active && "bg-white/[0.09] text-white shadow-sm shadow-black/20",
        collapsed && "justify-center px-0",
      )}
    >
      <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-xl transition group-hover:scale-105", item.accent)}>
        <AppIcon name={item.icon} className="h-4 w-4" />
      </span>
      {!collapsed ? <span className="truncate font-medium">{item.label}</span> : null}
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
}: {
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
        <Button
          type="button"
          variant="outline"
          title={collapsed ? (currentWorkspace ? `${t(locale, "workspace")}: ${currentWorkspace.name}` : t(locale, "workspace")) : undefined}
          className={cn(
            "h-10 w-full justify-between rounded-2xl border-white/15 bg-gradient-to-r from-violet-500/10 via-indigo-500/5 to-transparent px-2.5 hover:bg-violet-500/15",
            collapsed && "h-10 w-full justify-center rounded-xl border-white/10 bg-transparent px-0 hover:bg-white/[0.08]",
          )}
        >
          {currentWorkspace ? (
            <span className={cn("flex min-w-0 items-center gap-2", collapsed && "justify-center")}>
              <span className={cn("grid h-6 w-6 place-items-center rounded-lg bg-white/10 text-sm", collapsed && "h-8 w-8 rounded-xl bg-violet-500/15 text-base")}>{currentWorkspace.emoji}</span>
              {!collapsed ? (
                <span className="min-w-0 text-left">
                  <span className="block truncate text-xs font-medium text-white">{currentWorkspace.name}</span>
                  <span className="block text-[10px] text-zinc-500">{currentWorkspace.accessRole}</span>
                </span>
              ) : null}
            </span>
          ) : (
            <span className={cn("text-zinc-500", collapsed && "text-lg")}>{collapsed ? "📦" : t(locale, "workspace")}</span>
          )}
          {!collapsed ? <ChevronsUpDown className="h-4 w-4 text-zinc-500" /> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-64 border-white/10 bg-zinc-950 p-0 shadow-2xl shadow-black/40">
        <Command shouldFilter={false}>
          <CommandInput placeholder={t(locale, "searchWorkspace")} value={query} onValueChange={setQuery} className="text-xs" />
          <CommandList>
            <CommandEmpty>{locale === "ru" ? "Пространство не найдено." : "No workspace found."}</CommandEmpty>
            <CommandGroup heading={t(locale, "switchWorkspace")}>
              {filteredWorkspaces.map((workspace) => (
                <CommandItem
                  key={workspace.id}
                  value={`${workspace.name}-${workspace.id}`}
                  onSelect={() => selectWorkspace(workspace.id)}
                  className="justify-between rounded-xl py-2 text-xs"
                >
                  <span className="min-w-0 truncate">{workspace.emoji} {workspace.name}</span>
                  <span className="ml-2 flex items-center gap-2">
                    {workspace.accessRole !== "owner" ? <Badge className="h-5 bg-violet-500/20 px-1.5 text-[10px] font-medium text-violet-200">{t(locale, "shared")}</Badge> : null}
                    {workspace.id === currentWorkspace?.id ? <Check className="h-4 w-4" /> : null}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        <div className="border-t border-white/10 p-1">
          <JoinWorkspaceDialog
            locale={locale}
            trigger={(
              <button
                type="button"
                className="group flex w-full items-center gap-2 rounded-lg border border-sky-400/20 bg-sky-500/[0.08] px-2 py-1.5 text-left text-xs text-sky-100 transition hover:border-sky-300/35 hover:bg-sky-500/[0.14]"
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-sky-500/20 text-sky-200">
                  <UserPlus className="h-3.5 w-3.5" />
                </span>
                <span className="truncate font-medium">{t(locale, "joinWorkspace")}</span>
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
}: {
  category: Category;
  collapsed: boolean;
  active: boolean;
  workspaceId?: number | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: category.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <Link
        href={withWorkspace(`/app/items?category=${category.id}`, workspaceId || null)}
        title={collapsed ? category.name : undefined}
        className={cn(
          "group relative flex items-center gap-2 rounded-2xl px-2 py-2 text-sm text-zinc-400 transition hover:bg-white/[0.06] hover:text-white",
          active && "bg-white/[0.08] text-white",
          collapsed && "justify-center px-0",
        )}
      >
        {!collapsed ? (
          <button {...attributes} {...listeners} className="ml-1 cursor-grab text-zinc-700 transition group-hover:text-zinc-400" type="button">
            <GripVertical className="h-4 w-4" />
          </button>
        ) : null}
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: `${category.color}25`, color: category.color }}>
          <AppIcon name={category.icon} className="h-4 w-4" />
        </span>
        {!collapsed ? <span className="truncate font-medium">{category.name}</span> : null}
      </Link>
    </div>
  );
}

function ProfileMenuLink({
  href,
  icon,
  label,
  accent,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  accent: string;
  children?: React.ReactNode;
}) {
  return (
    <DropdownMenuItem asChild className="gap-3 rounded-xl px-3 py-2.5">
      <Link href={href}>
        <span className={cn("grid h-8 w-8 place-items-center rounded-xl", accent)}>{icon}</span>
        <span className="flex flex-1 items-center justify-between font-medium">
          {label}
          {children}
        </span>
      </Link>
    </DropdownMenuItem>
  );
}

export function AppShell({
  user,
  workspaces,
  categories,
  children,
  unreadCount,
  unreadNotifications,
  locale,
}: {
  user: User;
  workspaces: Workspace[];
  categories: Category[];
  unreadCount: number;
  unreadNotifications: WebsiteNotification[];
  locale: Locale;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [items, setItems] = useState(categories);
  const activeCategoryId = searchParams.get("category");
  const currentWorkspaceId = Number(searchParams.get("workspace") || workspaces[0]?.id || 0) || 0;
  const currentWorkspace = workspaces.find((workspace) => workspace.id === currentWorkspaceId) || workspaces[0];
  const workspaceCategories = items.filter((category) => category.workspaceId === currentWorkspace?.id);
  const primaryNav: SidebarNavItem[] = [
    { href: "/app", label: t(locale, "dashboard"), icon: "LayoutDashboard", accent: "text-violet-200 bg-violet-500/10" },
    { href: "/app/items", label: t(locale, "entries"), icon: "WalletCards", accent: "text-emerald-200 bg-emerald-500/10" },
    { href: "/app/invoices", label: t(locale, "invoices"), icon: "FileText", accent: "text-sky-200 bg-sky-500/10" },
  ];
  const workspaceNav: SidebarNavItem[] = [
    { href: "/app/folders", label: t(locale, "shareAndSpace"), icon: "Share2", accent: "text-amber-200 bg-amber-500/10" },
  ];
  const premiumNav = user.premium
    ? [{ href: "/app/ai-import", label: t(locale, "aiMagic"), icon: "Sparkles", accent: "text-fuchsia-200 bg-fuchsia-500/10" }]
    : [];
  const workspaceItems = [...workspaceNav, ...premiumNav];
  const ids = useMemo(() => workspaceCategories.map((item) => item.id), [workspaceCategories]);
  const isActive = (href: string) => (href === "/app" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
  const currentHref = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

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

  return (
    <div className="flex min-h-screen bg-[#07070b]">
      <div className="fixed left-0 right-0 top-0 z-40 border-b border-white/10 bg-black/70 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center justify-between">
          <Link href="/app" className="flex items-center gap-2 text-white">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-500/20 text-violet-200">
              <AppIcon name="WalletCards" className="h-4 w-4" />
            </span>
            <span className="font-semibold">MC Tracker</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href={withWorkspace("/app/notifications", currentWorkspace?.id || null)} className="relative rounded-xl p-2 text-zinc-300 hover:bg-white/10 hover:text-white">
              <Bell className="h-4 w-4" />
              {unreadCount ? <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">{unreadCount}</span> : null}
            </Link>
            <Button type="button" variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label={locale === "ru" ? "Открыть меню" : "Open sidebar menu"}>
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" className="absolute inset-0 bg-black/70" aria-label={locale === "ru" ? "Закрыть меню" : "Close sidebar menu"} onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-80 max-w-[85vw] flex-col border-r border-white/10 bg-[#09090f] p-4">
            <div className="mb-5 flex items-center justify-between">
              <p className="font-semibold text-white">{locale === "ru" ? "Навигация" : "Navigation"}</p>
              <Button type="button" variant="ghost" size="icon" onClick={() => setMobileOpen(false)} aria-label={locale === "ru" ? "Закрыть меню" : "Close sidebar menu"}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto">
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
              <SidebarSection title={t(locale, "management")} collapsed={false}>
                {workspaceItems.map((item) => (
                  <SidebarNavLink key={item.href} item={item} active={isActive(item.href)} collapsed={false} workspaceId={currentWorkspace?.id} onClick={() => setMobileOpen(false)} />
                ))}
              </SidebarSection>
              <SidebarSection title={t(locale, "categories")} collapsed={false}>
                <div className="space-y-1">
                  <Link
                    href={withWorkspace("/app/categories", currentWorkspace?.id || null)}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "group relative flex items-center gap-2 rounded-2xl px-2 py-2 text-sm text-zinc-400 transition hover:bg-white/[0.06] hover:text-white",
                      pathname === "/app/categories" && "bg-white/[0.08] text-white",
                    )}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-200">
                      <AppIcon name="Tags" className="h-4 w-4" />
                    </span>
                    <span className="truncate font-medium">{t(locale, "manageCategories")}</span>
                  </Link>
                  {workspaceCategories.map((category) => (
                    <Link
                      key={category.id}
                      href={withWorkspace(`/app/items?category=${category.id}`, currentWorkspace?.id || null)}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "group relative flex items-center gap-2 rounded-2xl px-2 py-2 text-sm text-zinc-400 transition hover:bg-white/[0.06] hover:text-white",
                        pathname === "/app/items" && activeCategoryId === String(category.id) && "bg-white/[0.08] text-white",
                      )}
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: `${category.color}25`, color: category.color }}>
                        <AppIcon name={category.icon} className="h-4 w-4" />
                      </span>
                      <span className="truncate font-medium">{category.name}</span>
                    </Link>
                  ))}
                </div>
              </SidebarSection>
            </div>
            <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
              {(user.role === "admin" || user.role === "superadmin") ? (
                <Link href={withWorkspace("/app/admin", currentWorkspace?.id || null)} onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm text-zinc-300 hover:bg-white/10">
                  <Shield className="h-4 w-4" />
                  {t(locale, "admin")}
                </Link>
              ) : null}
              <Link href={withWorkspace("/app/settings", currentWorkspace?.id || null)} onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm text-zinc-300 hover:bg-white/10">
                <Settings className="h-4 w-4" />
                {t(locale, "settings")}
              </Link>
              <form action={logoutAction}>
                <button type="submit" className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm text-red-200 hover:bg-red-500/10">
                  <LogOut className="h-4 w-4" />
                  {t(locale, "logout")}
                </button>
              </form>
            </div>
          </aside>
        </div>
      ) : null}

      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 border-r border-white/10 bg-black/35 p-4 backdrop-blur transition-[width] duration-200 md:flex md:flex-col",
          collapsed ? "w-20" : "w-72",
        )}
      >
        <Link href="/app" className={cn("mb-6 flex items-center gap-3", collapsed && "justify-center")}>
          <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-500/20 text-violet-200", collapsed && "h-9 w-9 rounded-xl")}>
            <AppIcon name="WalletCards" className={cn("h-6 w-6", collapsed && "h-5 w-5")} />
          </span>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="font-bold text-white">MC Tracker</p>
              <p className="truncate text-xs text-zinc-500">{user.username} · {user.role}</p>
            </div>
          ) : null}
        </Link>

        <div className={cn("min-h-0 flex-1 overflow-y-auto", collapsed ? "pr-0" : "pr-1")}>
          <nav className="space-y-6">
            <SidebarSection title={t(locale, "workspace")} collapsed={collapsed}>
              <WorkspaceSelect
                workspaces={workspaces}
                currentWorkspaceId={currentWorkspace?.id}
                pathname={pathname}
                searchParams={searchParams}
                collapsed={collapsed}
                locale={locale}
              />
            </SidebarSection>
            <SidebarSection title={t(locale, "main")} collapsed={collapsed}>
              {primaryNav.map((item) => (
                <SidebarNavLink key={item.href} item={item} active={isActive(item.href) && !activeCategoryId} collapsed={collapsed} workspaceId={currentWorkspace?.id} />
              ))}
            </SidebarSection>

            <SidebarSection title={t(locale, "management")} collapsed={collapsed}>
              {workspaceItems.map((item) => (
                <SidebarNavLink key={item.href} item={item} active={isActive(item.href)} collapsed={collapsed} workspaceId={currentWorkspace?.id} />
              ))}
              <Link
                href={withWorkspace("/app/notifications", currentWorkspace?.id || null)}
                title={collapsed ? t(locale, "notifications") : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-2xl px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/[0.07] hover:text-white",
                  pathname === "/app/notifications" && "bg-white/[0.09] text-white shadow-sm shadow-black/20",
                  collapsed && "justify-center px-0",
                )}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-200 transition group-hover:scale-105">
                  <Bell className="h-4 w-4" />
                </span>
                {!collapsed ? <span className="flex-1 truncate font-medium">{t(locale, "notifications")}</span> : null}
                {unreadCount ? <Badge variant="destructive" className="px-2 py-0.5">{unreadCount}</Badge> : null}
              </Link>
            </SidebarSection>
          </nav>

          <div className="mt-6">
            <SidebarSection title={t(locale, "categories")} collapsed={collapsed}>
              <Link
                href={withWorkspace("/app/categories", currentWorkspace?.id || null)}
                title={collapsed ? t(locale, "manageCategories") : undefined}
                className={cn(
                  "group relative flex items-center gap-2 rounded-2xl px-2 py-2 text-sm text-zinc-400 transition hover:bg-white/[0.06] hover:text-white",
                  pathname === "/app/categories" && "bg-white/[0.08] text-white",
                  collapsed && "justify-center px-0",
                )}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-200">
                  <AppIcon name="Tags" className="h-4 w-4" />
                </span>
                {!collapsed ? <span className="truncate font-medium">{t(locale, "manageCategories")}</span> : null}
              </Link>
              <DndContext id="sidebar-categories" onDragEnd={handleDragEnd}>
                <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                  <div className="space-y-1">
                    {workspaceCategories.map((category) => (
                      <SortableSidebarCategory
                        key={category.id}
                        category={category}
                        collapsed={collapsed}
                        workspaceId={currentWorkspace?.id}
                        active={pathname === "/app/items" && activeCategoryId === String(category.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </SidebarSection>
          </div>
        </div>

        <div
          className={cn(
            "mt-4 border-t border-white/10 pt-4",
            collapsed ? "flex flex-col items-center gap-2" : "flex items-center gap-2",
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleCollapsed}
            title={collapsed ? (locale === "ru" ? "Развернуть меню" : "Expand sidebar") : t(locale, "collapseSidebar")}
            aria-expanded={!collapsed}
            aria-label={collapsed ? (locale === "ru" ? "Развернуть меню" : "Expand sidebar") : t(locale, "collapseSidebar")}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" className={cn("min-w-0 flex-1", collapsed && "h-10 w-10 flex-none px-0")} title={t(locale, "profile")}>
                <UserRound className="h-4 w-4" />
                {!collapsed ? <span className="truncate">{user.username}</span> : null}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-2">
              <DropdownMenuLabel className="rounded-xl bg-white/[0.04] p-3">
                <span className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-500/15 text-violet-200">
                    <UserRound className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-white">{user.username}</span>
                    <span className="block text-xs font-normal text-zinc-500">{user.role}</span>
                  </span>
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(user.role === "admin" || user.role === "superadmin") ? (
                <ProfileMenuLink href={withWorkspace("/app/admin", currentWorkspace?.id || null)} icon={<Shield className="h-4 w-4" />} label={t(locale, "admin")} accent="bg-red-500/10 text-red-200" />
              ) : null}
              <ProfileMenuLink href={withWorkspace("/app/settings", currentWorkspace?.id || null)} icon={<Settings className="h-4 w-4" />} label={t(locale, "settings")} accent="bg-sky-500/10 text-sky-200" />
              <ProfileMenuLink href={withWorkspace("/app/notifications", currentWorkspace?.id || null)} icon={<Bell className="h-4 w-4" />} label={t(locale, "notifications")} accent="bg-violet-500/10 text-violet-200">
                {unreadCount ? <Badge variant="destructive" className="ml-2 px-2 py-0.5">{unreadCount}</Badge> : null}
              </ProfileMenuLink>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={(event) => event.preventDefault()} className="rounded-xl p-0">
                <div className="w-full rounded-xl px-3 py-2.5">
                  <div className="mb-2 flex items-center gap-3 text-sm font-medium text-zinc-200">
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-500/10 text-violet-200">
                      <Languages className="h-4 w-4" />
                    </span>
                    {t(locale, "language")}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(["en", "ru"] as const).map((option) => (
                      <form key={option} action={setLanguageAction}>
                        <input type="hidden" name="locale" value={option} />
                        <input type="hidden" name="next" value={currentHref} />
                        <button
                          type="submit"
                          className={cn(
                            "w-full rounded-lg border px-2 py-1.5 text-xs font-semibold transition",
                            locale === option
                              ? "border-violet-300/35 bg-violet-500/[0.18] text-violet-100"
                              : "border-white/10 bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200",
                          )}
                        >
                          {option === "en" ? t(locale, "english") : t(locale, "russian")}
                        </button>
                      </form>
                    ))}
                  </div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={(event) => event.preventDefault()} className="rounded-xl p-0">
                <form action={logoutAction} className="w-full">
                  <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-red-200 transition hover:bg-red-500/10" type="submit">
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-red-500/10 text-red-200">
                      <LogOut className="h-4 w-4" />
                    </span>
                    <span className="font-medium">{t(locale, "logout")}</span>
                  </button>
                </form>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-20 md:px-8 md:py-8">{children}</main>
      <NotificationToasts notifications={unreadNotifications} />
    </div>
  );
}
