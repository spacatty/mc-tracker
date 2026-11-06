"use client";

/**
 * The two things every entry row shows next to its name:
 * - `CategoryMark`: the category icon in its (softened) colour, with the name in a tooltip. The default instead of
 *   a Category column; the entries table can switch to a column from its table config.
 * - `CopyHost`: the server IP or domain under the name (see lib/item-host). Click copies it without opening the row.
 *
 * @example
 * <p className="flex items-center gap-2"><CategoryMark category={category} /><span className="truncate">{name}</span></p>
 * {host ? <CopyHost value={host} locale={locale} /> : null}
 */
import { Copy } from "lucide-react";
import { toast } from "sonner";
import type { Locale } from "@/lib/i18n";
import { cn, softColor } from "@/lib/utils";
import { AppIcon } from "./icons";
import { Tooltip } from "./ui/tooltip";

function tx(locale: Locale, en: string, ru: string) {
  return locale === "ru" ? ru : en;
}

const IPV4 = /^(\d{1,3}\.){3}\d{1,3}/;

export function hostKindFor(host: string): "IP" | "domain" {
  return IPV4.test(host) ? "IP" : "domain";
}

/** Copies text, falling back to a hidden textarea where the Clipboard API is blocked (some embedded browsers). */
export async function copyToClipboard(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

export function CopyHost({ value, kind, locale, className }: { value: string; kind?: "IP" | "domain"; locale: Locale; className?: string }) {
  const resolvedKind = kind ?? hostKindFor(value);
  const label = tx(locale, `Copy ${resolvedKind}`, `Копировать ${resolvedKind === "IP" ? "IP" : "домен"}`);
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={`${label}: ${value}`}
        onClick={(event) => {
          event.stopPropagation();
          void copyToClipboard(value).then((ok) =>
            ok
              ? toast(resolvedKind === "IP" ? tx(locale, "IP copied", "IP скопирован") : tx(locale, "Domain copied", "Домен скопирован"))
              : toast.error(tx(locale, "Could not copy", "Не удалось скопировать")),
          );
        }}
        className={cn(
          "group/copy -mx-1 mt-0.5 inline-flex max-w-full items-center gap-1 rounded px-1 font-mono text-[11.5px] font-normal text-zinc-500 transition hover:bg-white/[0.05] hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40",
          className,
        )}
      >
        <span className="truncate">{value}</span>
        <Copy className="h-3 w-3 shrink-0 opacity-0 transition group-hover/copy:opacity-100 group-focus-visible/copy:opacity-100" aria-hidden="true" />
      </button>
    </Tooltip>
  );
}

export type CategoryMarkCategory = { name?: string | null; icon?: string | null; color?: string | null };

/** Category icon before an entry name; the name shows on hover. Renders nothing for uncategorized entries. */
export function CategoryMark({ category, className }: { category?: CategoryMarkCategory | null; className?: string }) {
  if (!category?.name) return null;
  return (
    <Tooltip label={category.name}>
      <span
        tabIndex={-1}
        aria-label={category.name}
        className={cn("inline-grid h-5 w-5 shrink-0 place-items-center rounded-[5px] bg-white/[0.04]", className)}
        style={{ color: softColor(category.color, 55) }}
      >
        <AppIcon name={category.icon || undefined} className="h-3 w-3" />
      </span>
    </Tooltip>
  );
}

/** "Vendor/account" on one line, the account muted: `bthost/sample@email.com`. */
export function VendorAccount({ vendor, account, className }: { vendor?: string | null; account?: string | null; className?: string }) {
  const v = (vendor || "").trim();
  const a = (account || "").trim();
  if (!v && !a) return <span className={cn("text-zinc-600", className)}>—</span>;
  return (
    <span className={cn("block min-w-0 truncate", className)} title={[v, a].filter(Boolean).join("/")}>
      {v ? <span className="text-zinc-300">{v}</span> : null}
      {a ? <span className="text-zinc-500">{v ? "/" : ""}{a}</span> : null}
    </span>
  );
}
