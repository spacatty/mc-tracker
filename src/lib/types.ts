export type UserRole = "superadmin" | "admin" | "user";
export type ShareRole = "viewer" | "editor";
export type WorkspaceRole = "owner" | "editor" | "viewer";
export type NotificationChannelType = "website" | "telegram";
export type PaymentType = "single" | "recurring";
export type BillingPeriod = "7d" | "1m" | "3m" | "1y" | "custom";
export type FieldType =
  | "text"
  | "url"
  | "number"
  | "date"
  | "checkbox"
  | "select"
  | "textarea";

export type CategoryField = {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  bold: boolean;
  color: string;
  showInTable: boolean;
  copyable?: boolean;
  options?: string[];
};

export type User = {
  id: number;
  username: string;
  role: UserRole;
  totpEnabled: boolean;
  premium: boolean;
  displayCurrency: string;
  createdAt: string;
};

export type Category = {
  id: number;
  workspaceId: number | null;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
  fields: CategoryField[];
  createdAt: string;
  updatedAt: string;
};

export type PaymentItem = {
  id: number;
  workspaceId: number | null;
  name: string;
  categoryId: number | null;
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
  paymentType: PaymentType;
  amount: number;
  currency: string;
  billingStartAt: string | null;
  billingEndAt: string | null;
  period: BillingPeriod | null;
  customPeriodDays: number | null;
  vendorName: string;
  vendorUrl: string;
  accountName: string;
  notes: string;
  customFields: Record<string, unknown>;
  ownerId: number | null;
  createdAt: string;
  updatedAt: string;
};

export type Folder = {
  id: number;
  workspaceId?: number | null;
  name: string;
  ownerId: number;
  ownerUsername?: string;
  accessRole?: ShareRole | "owner";
  createdAt: string;
  itemCount: number;
  categoryCount: number;
  memberCount: number;
};

export type DashboardStats = {
  displayCurrency: string;
  totalExpenses: number;
  monthlyRecurring: number;
  monthlyRecurringCount: number;
  approxMonthlySpend: number;
  approxYearlySpend: number;
  yearlyRecurring: number;
  recurringCount: number;
  oneMonthChangeAmount: number;
  oneMonthChangePercent: number;
  upcoming: Array<PaymentItem & { nextPaymentAt: string; daysUntilPayment: number }>;
  upcomingDueByCategory: Array<{
    categoryId: number | null;
    name: string;
    icon: string;
    color: string;
    week: number;
    month: number;
    quarter: number;
    year: number;
  }>;
  categoryItemSplit: Array<{ name: string; icon: string; color: string; count: number }>;
  categoryBreakdown: Array<{ name: string; icon: string; color: string; monthly: number }>;
  workspaceObjectDominance: Array<{ name: string; color: string; count: number }>;
  workspaceCostDominance: Array<{ name: string; color: string; monthly: number }>;
  trend: Array<{ label: string; amount: number }>;
};

export type NotificationChannel = {
  id: number;
  workspaceId: number | null;
  type: NotificationChannelType;
  title: string;
  botToken: string;
  chatId: string;
  topicId: string;
  proxyUrl: string;
  createdAt: string;
};

export type WebsiteNotification = {
  id: number;
  workspaceId: number | null;
  title: string;
  body: string;
  itemId: number | null;
  categoryId: number | null;
  createdAt: string;
  readAt: string | null;
};

export type VendorSuggestion = {
  vendorName: string;
  vendorUrl: string;
  accountName: string;
};

export type Invoice = {
  id: number;
  workspaceId: number | null;
  itemId: number | null;
  itemName?: string;
  categoryId: number | null;
  categoryName?: string;
  vendorName: string;
  vendorUrl: string;
  accountName: string;
  amount: number;
  currency: string;
  paymentDate: string | null;
  dueDate: string | null;
  period: BillingPeriod | null;
  customPeriodDays: number | null;
  shiftDates: boolean;
  shiftPaymentPeriod: boolean;
  createdAt: string;
};

export type Workspace = {
  id: number;
  name: string;
  emoji: string;
  ownerId: number;
  ownerUsername?: string;
  accessRole: WorkspaceRole;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceMember = {
  userId: number;
  username: string;
  role: WorkspaceRole;
  userRole: UserRole;
};
