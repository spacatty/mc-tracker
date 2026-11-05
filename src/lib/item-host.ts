import type { CategoryField } from "./types";

// Category fields whose label (or id) names a server address or domain.
const HOST_FIELD = /\b(ip|ipv4|ipv6|ip address|domain|domain name|domains|host|hostname|server ip)\b/i;
const IPV4 = /^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/;
const DOMAIN = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

/**
 * The server IP or domain of an entry, taken from its category's IP/Domain/Host field.
 * Falls back to the first custom value that looks like an IPv4 address or a domain.
 */
export function itemHost(customFields: Record<string, unknown> | null | undefined, fields: CategoryField[] = []) {
  const values = customFields || {};
  for (const field of fields) {
    if (!HOST_FIELD.test(field.label) && !HOST_FIELD.test(field.id.replace(/_/g, " "))) continue;
    const value = text(values[field.id]);
    if (value) return value;
  }
  for (const raw of Object.values(values)) {
    const value = text(raw);
    if (IPV4.test(value) || DOMAIN.test(value)) return value;
  }
  return "";
}

/** "Name (127.0.0.1)", or just the name when there is no host or the name already holds it. */
export function titleWithHost(name: string, host?: string | null) {
  const cleanHost = (host || "").trim();
  if (!cleanHost || name.toLowerCase().includes(cleanHost.toLowerCase())) return name;
  return `${name} (${cleanHost})`;
}

/** Adds the host after the entry name inside a stored notification title. */
export function notificationTitleWithHost(title: string, itemName?: string | null, host?: string | null) {
  const cleanHost = (host || "").trim();
  if (!cleanHost || title.toLowerCase().includes(cleanHost.toLowerCase())) return title;
  if (itemName && title.includes(itemName)) return title.replace(itemName, titleWithHost(itemName, cleanHost));
  return `${title} (${cleanHost})`;
}
