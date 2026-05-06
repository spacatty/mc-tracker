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
