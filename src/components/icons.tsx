import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";

const excluded = new Set(["createLucideIcon", "default", "icons", "toKebabCase"]);

function isLucideComponent(value: unknown): value is LucideIcon {
  return (
    typeof value === "function" ||
    (typeof value === "object" && value !== null && "$$typeof" in value && "render" in value)
  );
}

const icons = Object.fromEntries(
  Object.entries(LucideIcons).filter(([name, value]) => {
    return !excluded.has(name) && /^[A-Z]/.test(name) && isLucideComponent(value);
  }),
) as Record<string, LucideIcon>;

export const iconNames = Object.keys(icons).sort();

export function AppIcon({ name, className }: { name?: string; className?: string }) {
  const Icon = icons[name || "Sparkles"] || (LucideIcons.Sparkles as LucideIcon);
  return <Icon className={className} />;
}

/** The stacked-cards mark: a pile of entries. Same drawing as src/app/icon.svg. */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} role="img" aria-label="MC Tracker">
      <defs>
        <linearGradient id="mc-brand-front" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset=".6" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
      <rect x="9" y="3" width="20" height="14" rx="4" fill="#0ea5e9" opacity=".55" />
      <rect x="6" y="8.5" width="20" height="14" rx="4" fill="#0891b2" opacity=".8" />
      <rect x="3" y="14" width="20" height="14" rx="4" fill="url(#mc-brand-front)" />
      <path d="M7.5 23.5h6" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity=".9" />
    </svg>
  );
}

/** "MC TRACKER" in small spaced capitals, Tracker quieter. */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={["whitespace-nowrap text-[11.5px] font-bold uppercase leading-none tracking-[0.2em] text-zinc-100", className].filter(Boolean).join(" ")}>
      MC <span className="font-semibold text-zinc-500">Tracker</span>
    </span>
  );
}
