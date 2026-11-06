"use client";

/**
 * THE table action pattern: at most two inline quick actions plus a ⋯ menu for the rest.
 * Destructive menu items go last, after a separator; deletes confirm through ConfirmDialog.
 * The row must carry `group` (TableRow adds it) for `hidden="hover"` actions.
 *
 * @example
 * <TableCell align="right" className="w-[1%] whitespace-nowrap">
 *   <RowActions>
 *     <RowAction label="Mark paid" icon={<Check />} tone="accent" onClick={pay} />
 *     <RowAction label="Edit" icon={<Pencil />} hidden="hover" onClick={edit} />
 *     <RowActionMenu
 *       label={`More actions for ${item.name}`}
 *       items={[
 *         { label: "Duplicate", icon: <Copy />, onSelect: duplicate },
 *         { label: "Open page", icon: <ExternalLink />, href: `/app/entries/${item.id}` },
 *         "separator",
 *         { label: "Delete", icon: <Trash2 />, destructive: true, onSelect: () => setConfirm(item) },
 *       ]}
 *     />
 *   </RowActions>
 * </TableCell>
 */
import * as React from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "./tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "./dropdown-menu";

const stop = (event: React.SyntheticEvent) => event.stopPropagation();

export const RowActions = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, onClick, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center justify-end gap-0.5", className)}
      onClick={(event) => {
        // Keep clicks (including ones bubbling out of portalled menus/dialogs) from reaching the row.
        event.stopPropagation();
        onClick?.(event);
      }}
      onDoubleClick={stop}
      {...props}
    />
  ),
);
RowActions.displayName = "RowActions";

export type RowActionTone = "default" | "accent" | "danger" | "success" | "warning" | "info" | "neutral";

const ROW_ACTION_TONES: Record<RowActionTone, string> = {
  default: "text-zinc-400/80 hover:bg-white/[0.05] hover:text-zinc-300",
  neutral: "text-zinc-400/80 hover:bg-white/[0.05] hover:text-zinc-300",
  accent: "text-violet-300/75 hover:bg-violet-500/10 hover:text-violet-300",
  success: "text-emerald-300/75 hover:bg-emerald-500/10 hover:text-emerald-300",
  warning: "text-amber-300/75 hover:bg-amber-500/10 hover:text-amber-300",
  info: "text-sky-300/75 hover:bg-sky-500/10 hover:text-sky-300",
  danger: "text-red-300/70 hover:bg-red-500/10 hover:text-red-300",
};

/** A muted hue per action kind, picked from the lucide icon (pay = green, login = amber, edit = blue, open = violet). */
const ICON_TONES: Record<string, RowActionTone> = {
  WalletCards: "success", Check: "success", CheckCheck: "success", CalendarCheck: "success", ArchiveRestore: "success", ArchiveArrowUp: "success",
  KeyRound: "warning", LogIn: "warning",
  Pencil: "info", UserCog: "info", Settings2: "info",
  ArrowUpRight: "accent", ExternalLink: "accent", Eye: "accent",
  Trash: "danger", Trash2: "danger", X: "danger",
};

function toneForIcon(icon: React.ReactNode): RowActionTone {
  if (!React.isValidElement(icon)) return "neutral";
  const type = icon.type as { displayName?: string };
  const name = (type.displayName || "").replace(/Icon$/, "");
  return ICON_TONES[name] ?? "neutral";
}

export const rowActionClass =
  "inline-grid h-7 w-7 shrink-0 place-items-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40 disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40 [&_svg]:h-3.5 [&_svg]:w-3.5";

/** Hover-revealed on pointer devices; always visible on touch. */
export const rowActionHiddenClass =
  "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100";

export interface RowActionProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children" | "hidden"> {
  /** Accessible name and tooltip text. */
  label: string;
  icon: React.ReactNode;
  /** Renders a next/link instead of a button. */
  href?: string;
  /** For `href`: open in a new tab (plain `<a target="_blank">`). */
  external?: boolean;
  tone?: RowActionTone;
  /** "hover": only visible while the row is hovered or focused (always visible on touch screens). */
  hidden?: "hover";
}

export const RowAction = React.forwardRef<HTMLButtonElement, RowActionProps>(
  ({ label, icon, href, external, tone = "default", hidden, className, disabled, type = "button", ...props }, ref) => {
    const classes = cn(rowActionClass, ROW_ACTION_TONES[tone === "default" ? toneForIcon(icon) : tone], hidden === "hover" && rowActionHiddenClass, className);
    if (href && !disabled) {
      const anchorProps = props as unknown as React.AnchorHTMLAttributes<HTMLAnchorElement>;
      return (
        <Tooltip label={label}>
          {external ? (
            <a href={href} target="_blank" rel="noreferrer" aria-label={label} className={classes} {...anchorProps}>
              {icon}
            </a>
          ) : (
            <Link href={href} aria-label={label} className={classes} {...anchorProps}>
              {icon}
            </Link>
          )}
        </Tooltip>
      );
    }
    return (
      <Tooltip label={label}>
        <button ref={ref} type={type} aria-label={label} disabled={disabled} className={classes} {...props}>
          {icon}
        </button>
      </Tooltip>
    );
  },
);
RowAction.displayName = "RowAction";

export interface RowActionMenuItem {
  label: React.ReactNode;
  icon?: React.ReactNode;
  onSelect?: () => void;
  href?: string;
  /** Open `href` in a new tab. */
  external?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  shortcut?: React.ReactNode;
}

export type RowActionMenuEntry = RowActionMenuItem | "separator" | false | null | undefined;

export interface RowActionMenuProps {
  /** Accessible name and tooltip of the ⋯ button, e.g. "More actions for Hetzner". */
  label: string;
  /** Items and "separator"s; falsy entries are skipped, and stray separators are collapsed. */
  items: ReadonlyArray<RowActionMenuEntry>;
  icon?: React.ReactNode;
  align?: "start" | "center" | "end";
  hidden?: "hover";
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
}

function tidy(items: ReadonlyArray<RowActionMenuEntry>) {
  const out: Array<RowActionMenuItem | "separator"> = [];
  for (const item of items) {
    if (!item) continue;
    if (item === "separator" && (!out.length || out[out.length - 1] === "separator")) continue;
    out.push(item);
  }
  while (out[out.length - 1] === "separator") out.pop();
  return out;
}

export function RowActionMenu({ label, items, icon, align = "end", hidden, disabled, className, contentClassName }: RowActionMenuProps) {
  const entries = tidy(items);
  if (!entries.length) return null;
  return (
    <DropdownMenu modal={false}>
      <Tooltip label={label}>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <button
            type="button"
            aria-label={label}
            className={cn(
              rowActionClass,
              "text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-300 data-[state=open]:bg-white/[0.06] data-[state=open]:text-zinc-300",
              hidden === "hover" && rowActionHiddenClass,
              className,
            )}
          >
            {icon ?? <MoreHorizontal />}
          </button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align={align} sideOffset={4} className={cn("min-w-44", contentClassName)} onClick={stop}>
        {entries.map((item, index) => {
          if (item === "separator") return <DropdownMenuSeparator key={`separator-${index}`} />;
          const content = (
            <>
              {item.icon}
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.shortcut ? <DropdownMenuShortcut>{item.shortcut}</DropdownMenuShortcut> : null}
            </>
          );
          if (item.href && !item.disabled) {
            return (
              <DropdownMenuItem key={index} asChild destructive={item.destructive} onSelect={item.onSelect}>
                {item.external ? (
                  <a href={item.href} target="_blank" rel="noreferrer">
                    {content}
                  </a>
                ) : (
                  <Link href={item.href}>{content}</Link>
                )}
              </DropdownMenuItem>
            );
          }
          return (
            <DropdownMenuItem key={index} destructive={item.destructive} disabled={item.disabled} onSelect={() => item.onSelect?.()}>
              {content}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
RowActionMenu.displayName = "RowActionMenu";
