export interface Account {
  id: string; name: string; type: 'CHECKING' | 'CREDIT_CARD' | 'CASH' | 'INVESTMENT'; initialBalance: number; balance: number;
}
export interface Category { id: string; name: string; kind: 'INCOME' | 'EXPENSE'; color: string }
export interface Transaction {
  id: string; accountId: string; categoryId: string | null; type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  amount: number; date: string; description: string; notes?: string | null;
  category?: Category | null; account?: { id: string; name: string };
  tags?: string[]; installmentNo?: number | null; installmentTotal?: number | null; recurringId?: string | null;
  attachments?: Attachment[];
}
export interface Attachment { id: string; fileName: string; mime: string; size: number }
export interface CategoryRule {
  id: string; pattern: string; matchType: 'CONTAINS' | 'REGEX'; categoryId: string; priority: number; category: Category;
}
export interface RecurringRule {
  id: string; accountId: string; categoryId: string | null; type: 'INCOME' | 'EXPENSE'; amount: number; description: string;
  frequency: 'WEEKLY' | 'MONTHLY' | 'YEARLY'; startDate: string; endDate: string | null; nextDate: string; generatedCount: number; active: boolean;
  category?: Category | null; account?: { id: string; name: string };
}
export interface BudgetAlert extends Budget { level: 'warning' | 'danger' }
export interface TransactionList {
  items: Transaction[]; total: number; page: number; pageSize: number; totals: { income: number; expense: number };
}
export interface TxFilters {
  from?: string; to?: string; accountId?: string; categoryId?: string; type?: string; q?: string; tag?: string; page?: number; pageSize?: number;
}
export interface Budget {
  id: string; month: string; category: Category; amount: number; spent: number; remaining: number; percent: number;
}
export interface Summary {
  income: number; expense: number; balance: number;
  byCategory: { categoryId: string | null; name: string; color: string; total: number }[];
  topExpenses: { id: string; description: string; amount: number; date: string; category: string | null }[];
}
export interface CashflowPoint { month: string; income: number; expense: number }
export interface ImportMappingInput {
  date: string; description: string; amount?: string; credit?: string; debit?: string;
  dateFormat: 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY'; decimal: ',' | '.'; invertSign?: boolean;
}
export interface ImportUpload {
  id: string; format: string; fileName: string; totalRows: number; columns: string[];
  sample: Record<string, string>[]; suggestedMapping: Partial<ImportMappingInput>;
}
export interface ImportRow {
  id: string; index: number; date: string | null; description: string | null; amount: number | null;
  type: 'INCOME' | 'EXPENSE' | null; categoryId: string | null; status: 'PENDING' | 'DUPLICATE' | 'ERROR' | 'IMPORTED';
  error: string | null; skip: boolean;
}
export interface ImportDetail {
  id: string; fileName: string; status: string; accountId: string | null; rows: ImportRow[];
  counts: { pending: number; duplicate: number; error: number; imported: number };
}
export interface ImportListItem { id: string; fileName: string; format: string; status: string; totalRows: number; createdAt: string }
