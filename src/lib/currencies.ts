export const SUPPORTED_CURRENCIES = [
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "RUB", name: "Russian Ruble" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "NZD", name: "New Zealand Dollar" },
  { code: "SEK", name: "Swedish Krona" },
  { code: "NOK", name: "Norwegian Krone" },
  { code: "DKK", name: "Danish Krone" },
  { code: "PLN", name: "Polish Zloty" },
  { code: "CZK", name: "Czech Koruna" },
  { code: "TRY", name: "Turkish Lira" },
  { code: "UAH", name: "Ukrainian Hryvnia" },
  { code: "KZT", name: "Kazakhstani Tenge" },
  { code: "AED", name: "UAE Dirham" },
  { code: "INR", name: "Indian Rupee" },
] as const;

export const DEFAULT_CURRENCY = "USD";

const supportedCurrencySet = new Set<string>(SUPPORTED_CURRENCIES.map((currency) => currency.code));

export function normalizeCurrencyCode(value: string | null | undefined) {
  return String(value || "").trim().toUpperCase();
}

export function isSupportedCurrency(value: string | null | undefined) {
  return supportedCurrencySet.has(normalizeCurrencyCode(value));
}

export function ensureSupportedCurrency(value: string | null | undefined, fallback = DEFAULT_CURRENCY) {
  const normalized = normalizeCurrencyCode(value);
  return isSupportedCurrency(normalized) ? normalized : fallback;
}

export function getCurrencySymbol(value: string | null | undefined) {
  const code = ensureSupportedCurrency(value);
  try {
    const parts = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 0,
    }).formatToParts(0);
    const currencyPart = parts.find((part) => part.type === "currency");
    return currencyPart?.value || code;
  } catch {
    return code;
  }
}
