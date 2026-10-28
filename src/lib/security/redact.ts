/**
 * Leak prevention for anything that leaves the server: JSON from /api routes,
 * error strings handed back to the browser, and payloads sent to the AI provider.
 *
 * Two modes share one detector:
 *   maskText / maskDeep   irreversible, for API responses ("[ip]", "[secret]", ...)
 *   createRedactor()      reversible placeholders (<<IP_1>>) for AI requests, so the
 *                         model sees the shape of the data but never the value, and
 *                         its answer can be mapped back locally.
 *
 * Environment:
 *   REDACT_KINDS     comma list of kinds to detect; default all of
 *                    secret,email,url_credentials,ip,domain,denylist
 *   REDACT_DENYLIST  comma separated literal terms (case-insensitive) or /regex/flags
 *                    entries that must never leave the server, e.g. internal codenames.
 */

export type RedactionKind = "secret" | "email" | "url_credentials" | "ip" | "domain" | "denylist";

const ALL_KINDS: RedactionKind[] = ["secret", "email", "url_credentials", "ip", "domain", "denylist"];

type Detector = { kind: RedactionKind; label: string; pattern: RegExp; groups?: number[] };

// File extensions and similar dotted tokens that look like domains but are not.
const NON_TLDS = new Set([
  "js", "jsx", "ts", "tsx", "mjs", "cjs", "json", "css", "scss", "html", "htm", "md", "mdx", "txt", "csv", "tsv", "xml",
  "yml", "yaml", "toml", "ini", "env", "log", "lock", "sql", "sqlite", "db", "png", "jpg", "jpeg", "gif", "svg", "webp",
  "ico", "pdf", "zip", "gz", "tar", "exe", "dll", "so", "py", "rb", "go", "rs", "java", "php", "sh", "bat", "ps1", "map",
  "min", "test", "spec", "d", "config", "local", "example", "prototype", "length", "then", "catch", "value", "name", "id",
]);

const SECRET_PATTERNS: RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\bsk-(?:or-v1-|proj-|ant-)?[A-Za-z0-9_-]{20,}\b/g, // OpenAI / OpenRouter / Anthropic style
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, // AWS access key id
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g, // GitHub
  /\bgithub_pat_[A-Za-z0-9_]{40,}\b/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g, // Slack
  /\bAIza[0-9A-Za-z_-]{35}\b/g, // Google API key
  /\b\d{8,10}:AA[A-Za-z0-9_-]{30,}\b/g, // Telegram bot token
  /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, // JWT
  /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g, // Stripe
];

const IPV4 = /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\/\d{1,2})?\b/g;
// Full or "::"-compressed IPv6. Requires either "::" or eight groups so clock times never match.
const IPV6 = /(?<![\w:])(?:(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}|(?:[0-9a-f]{1,4}:){1,7}:|(?:[0-9a-f]{1,4}:){1,6}:[0-9a-f]{1,4}|(?:[0-9a-f]{1,4}:){1,5}(?::[0-9a-f]{1,4}){1,2}|(?:[0-9a-f]{1,4}:){1,4}(?::[0-9a-f]{1,4}){1,3}|(?:[0-9a-f]{1,4}:){1,3}(?::[0-9a-f]{1,4}){1,4}|(?:[0-9a-f]{1,4}:){1,2}(?::[0-9a-f]{1,4}){1,5}|[0-9a-f]{1,4}:(?::[0-9a-f]{1,4}){1,6}|::(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})(?:\/\d{1,3})?(?![\w:])/gi;
const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,24}\b/g;
const URL_CREDENTIALS = /\b([a-z][a-z0-9+.-]*:\/\/)([^\s:@/]+):([^\s@/]+)@/gi;
// Assignment-style secrets: "password=hunter2", "api_key: abc", "token = xyz".
const KEY_VALUE_SECRET = /(?<![\p{L}\d_-])((?:pass(?:word|wd)?|pwd|pw|пароль|secret|token|api[_-]?key|apikey|access[_-]?key|auth|private[_-]?key|client[_-]?secret)\s*[:=]\s*)(?:"([^"\n]{1,200})"|'([^'\n]{1,200})'|([^\s"',;]{3,}))/giu;
const DOMAIN = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,24}|xn--[a-z0-9-]{2,59})\b\.?/gi;

function enabledKinds() {
  const raw = process.env.REDACT_KINDS?.trim();
  if (!raw) return new Set(ALL_KINDS);
  return new Set(raw.split(",").map((kind) => kind.trim()).filter((kind): kind is RedactionKind => ALL_KINDS.includes(kind as RedactionKind)));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function denylistPatterns(): RegExp[] {
  const raw = process.env.REDACT_DENYLIST || "";
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      const regex = entry.match(/^\/(.+)\/([a-z]*)$/);
      try {
        if (regex) return [new RegExp(regex[1], regex[2].includes("g") ? regex[2] : `${regex[2]}g`)];
        return [new RegExp(`(?<![\\w-])${escapeRegExp(entry)}(?![\\w-])`, "gi")];
      } catch {
        return [];
      }
    });
}

function detectors(): Detector[] {
  const kinds = enabledKinds();
  const list: Detector[] = [];
  // Order matters: specific secrets and credentials before the broad ip/domain passes.
  if (kinds.has("denylist")) denylistPatterns().forEach((pattern) => list.push({ kind: "denylist", label: "REDACTED", pattern }));
  if (kinds.has("secret")) {
    SECRET_PATTERNS.forEach((pattern) => list.push({ kind: "secret", label: "SECRET", pattern }));
    list.push({ kind: "secret", label: "SECRET", pattern: KEY_VALUE_SECRET, groups: [2, 3, 4] });
  }
  if (kinds.has("url_credentials")) list.push({ kind: "url_credentials", label: "CREDENTIALS", pattern: URL_CREDENTIALS });
  if (kinds.has("email")) list.push({ kind: "email", label: "EMAIL", pattern: EMAIL });
  if (kinds.has("ip")) {
    list.push({ kind: "ip", label: "IP", pattern: IPV4 });
    list.push({ kind: "ip", label: "IP", pattern: IPV6 });
  }
  if (kinds.has("domain")) list.push({ kind: "domain", label: "DOMAIN", pattern: DOMAIN });
  return list;
}

const PLACEHOLDER = /<<[A-Z]+_\d+>>|\[(?:secret|ip|email|domain|credentials|redacted)\]/g;

function replaceOutsidePlaceholders(text: string, pattern: RegExp, replace: (match: RegExpExecArray) => string | null) {
  // Never re-mask an existing placeholder (e.g. "<<IP_1>>" must not become a domain).
  const protectedRanges: Array<[number, number]> = [];
  for (const match of text.matchAll(PLACEHOLDER)) protectedRanges.push([match.index, match.index + match[0].length]);

  let result = "";
  let last = 0;
  pattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match[0] === "") {
      pattern.lastIndex += 1;
      continue;
    }
    const start = match.index;
    const end = start + match[0].length;
    if (protectedRanges.some(([from, to]) => start < to && end > from)) continue;
    const replacement = replace(match);
    if (replacement === null) continue;
    result += text.slice(last, start) + replacement;
    last = end;
  }
  return result + text.slice(last);
}

function redactWith(text: string, onValue: (detector: Detector, value: string) => string) {
  let output = text;
  for (const detector of detectors()) {
    output = replaceOutsidePlaceholders(output, detector.pattern, (match) => {
      if (detector.kind === "domain") {
        const tld = (match[1] || "").toLowerCase();
        if (NON_TLDS.has(tld) || /^\d/.test(match[0])) return null;
      }
      if (detector.kind === "url_credentials") {
        return `${match[1]}${onValue(detector, `${match[2]}:${match[3]}`)}@`;
      }
      if (detector.groups) {
        const value = detector.groups.map((group) => match[group]).find((candidate) => candidate !== undefined) || "";
        const offset = match[0].lastIndexOf(value);
        return match[0].slice(0, offset) + onValue(detector, value) + match[0].slice(offset + value.length);
      }
      return onValue(detector, match[0]);
    });
  }
  return output;
}

/** Irreversibly masks sensitive values in a string. */
export function maskText(text: string) {
  return redactWith(text, (detector) => `[${detector.label.toLowerCase()}]`);
}

/** Irreversibly masks every string (keys and values) in a JSON-like value. */
export function maskDeep<T>(value: T): T {
  if (typeof value === "string") return maskText(value) as T;
  if (Array.isArray(value)) return value.map((entry) => maskDeep(entry)) as T;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [maskText(key), maskDeep(entry)])) as T;
  }
  return value;
}

/**
 * Reversible redaction. The same value always maps to the same placeholder within
 * one redactor, so relationships between rows survive ("both servers share <<IP_1>>").
 */
export function createRedactor() {
  const byValue = new Map<string, string>();
  const byToken = new Map<string, string>();
  const counters = new Map<string, number>();

  function tokenFor(label: string, value: string) {
    const key = `${label}:${value.toLowerCase()}`;
    const existing = byValue.get(key);
    if (existing) return existing;
    const next = (counters.get(label) || 0) + 1;
    counters.set(label, next);
    const token = `<<${label}_${next}>>`;
    byValue.set(key, token);
    byToken.set(token, value);
    return token;
  }

  function redact(text: string) {
    return redactWith(text, (detector, value) => tokenFor(detector.label, value));
  }

  function redactDeep<T>(value: T): T {
    if (typeof value === "string") return redact(value) as T;
    if (Array.isArray(value)) return value.map((entry) => redactDeep(entry)) as T;
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, redactDeep(entry)])) as T;
    }
    return value;
  }

  function restore(text: string) {
    return text.replace(/<<[A-Z]+_\d+>>/g, (token) => byToken.get(token) ?? token);
  }

  function restoreDeep<T>(value: T): T {
    if (typeof value === "string") return restore(value) as T;
    if (Array.isArray(value)) return value.map((entry) => restoreDeep(entry)) as T;
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, restoreDeep(entry)])) as T;
    }
    return value;
  }

  return {
    redact,
    redactDeep,
    restore,
    restoreDeep,
    /** Counts of placeholders issued per kind, for logging without values. */
    stats: () => Object.fromEntries(counters),
  };
}
