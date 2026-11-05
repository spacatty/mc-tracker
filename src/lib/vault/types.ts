export type Vendor = {
  id: number;
  workspaceId: number;
  name: string;
  url: string;
  notes: string;
  accountCount: number;
  entryCount: number;
  createdAt: string;
  updatedAt: string;
};

/** An account as listed: its credentials stay sealed until they are revealed one at a time. */
export type VaultAccount = {
  id: number;
  workspaceId: number;
  vendorId: number | null;
  vendorName: string;
  vendorUrl: string;
  name: string;
  loginUrl: string;
  hasLogin: boolean;
  hasPassword: boolean;
  hasNotes: boolean;
  entryCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AccountCredentials = {
  login: string;
  password: string;
  notes: string;
};

/** What the Quick login dialog needs about one entry, before anything secret is shown. */
export type QuickLoginInfo = {
  itemId: number;
  itemName: string;
  vendorName: string;
  /** The account name typed on the entry. */
  entryAccountName: string;
  /** The URL to open: the account's login URL, else the vendor's URL, else the entry's vendor URL. */
  url: string;
  account: VaultAccount | null;
  /** True when the account could be created from the entry (an account name exists but no saved account). */
  canCreateAccount: boolean;
  canReveal: boolean;
  twoFactor: CredentialGate;
};

export type CredentialGate = {
  /** TWO_FACTOR_CREDENTIALS is on. */
  required: boolean;
  /** The user has an authenticator set up. */
  configured: boolean;
  /** A recent code is still valid, so no prompt is needed. */
  unlocked: boolean;
};

export type RevealResult =
  | { ok: true; credentials: AccountCredentials }
  | { ok: false; reason: "two_factor_required" | "two_factor_not_configured" | "invalid_code" | "forbidden" | "not_found"; message: string };
