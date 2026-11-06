import type { CategoryField } from "./types";

/*
 * The one detail worth showing under an entry's name: the server IP for Servers, the domain for Domains.
 * Other categories show nothing. Categories are matched by name (English or Russian).
 */
const SERVERS = /^(servers?|серверы?|сервера)$/i;
const DOMAINS = /^(domains?|домены?)$/i;
const IP_FIELD = /\b(ip|ipv4|ipv6|ip address|server ip|host|hostname)\b/i;
const DOMAIN_FIELD = /\b(domain|domain name)\b|домен/i;
const IPV4 = /^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/;
const DOMAIN = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

export function hostKind(categoryName?: string | null): "ip" | "domain" | null {
  const name = (categoryName || "").trim();
  if (SERVERS.test(name)) return "ip";
  if (DOMAINS.test(name)) return "domain";
  return null;
}

/**
 * The field a category uses as its entries' identifier when none is chosen yet: the IP field of a Servers category,
 * the Domain field of a Domains category (or any category with such a field). Empty string = none.
 */
export function defaultIdentifierField(categoryName: string | null | undefined, fields: CategoryField[] = []) {
  const kind = hostKind(categoryName)
    ?? (fields.some((field) => IP_FIELD.test(field.label)) ? "ip" : fields.some((field) => DOMAIN_FIELD.test(field.label)) ? "domain" : null);
  if (!kind) return "";
  const pattern = kind === "ip" ? IP_FIELD : DOMAIN_FIELD;
  return fields.find((field) => pattern.test(field.label) || pattern.test(field.id.replace(/_/g, " ")))?.id || "";
}

/**
 * The entry's identifier (server IP, domain…). `identifierField` is the category setting: a field id, "" for none,
 * or null/undefined when never set, which falls back to the IP/Domain detection below.
 */
export function itemHost(
  customFields: Record<string, unknown> | null | undefined,
  fields: CategoryField[] = [],
  categoryName?: string | null,
  identifierField?: string | null,
) {
  if (typeof identifierField === "string") return identifierField ? text((customFields || {})[identifierField]) : "";
  // By category name first; otherwise a category with an IP or Domain field counts too (e.g. "VPS", "Хостинг").
  const kind = hostKind(categoryName)
    ?? (fields.some((field) => IP_FIELD.test(field.label)) ? "ip" : fields.some((field) => DOMAIN_FIELD.test(field.label)) ? "domain" : null);
  if (!kind) return "";
  const values = customFields || {};
  const fieldPattern = kind === "ip" ? IP_FIELD : DOMAIN_FIELD;
  for (const field of fields) {
    if (!fieldPattern.test(field.label) && !fieldPattern.test(field.id.replace(/_/g, " "))) continue;
    const value = text(values[field.id]);
    if (value) return value;
  }
  const valuePattern = kind === "ip" ? IPV4 : DOMAIN;
  for (const raw of Object.values(values)) {
    const value = text(raw);
    if (valuePattern.test(value)) return value;
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
