export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
  icon?: string;
  suggestTaxDeductible?: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  description?: string;
  bankMemo?: string | null;
  deductiblePotential?: boolean;
  userNote?: string | null;
  date: string;
  userId: string;
  categoryId: string;
  category: Category;
  createdAt: string;
  updatedAt: string;
  _count?: { attachments: number };
}

export interface TransactionAttachmentMeta {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
}

export interface ExpenseForecastRow {
  categoryId: string;
  categoryName: string;
  color: string | null;
  totalInPeriod: number;
  monthsWithMovement: number;
  averageMonthlyExpense: number;
  projectedNextMonthExpense: number;
  transactionCount: number;
}

export interface TaxVisionSummary {
  year: number;
  totalPotentialDeductibleExpenses: number;
  flaggedExpenseCount: number;
  disclaimer: string;
}

/** Resposta de POST /ai-insights/*-commentary (Gemini) */
export interface AiInsightResult {
  text: string;
  model: string;
}

export interface TaxClassificationSuggestion {
  transactionId: string;
  date: string;
  amount: number;
  description: string;
  categoryName: string;
  suggestedDeductible: boolean;
  confidence: number;
  reason: string;
  explainWhy?: string;
}

export interface TaxChecklistItem {
  key: string;
  title: string;
  status: 'ok' | 'attention';
  detail: string;
  count?: number;
}

export interface TaxDocumentTimelineItem {
  transactionId: string;
  transactionDate: string;
  description: string;
  amount: number;
  categoryName: string;
  deductiblePotential: boolean;
  attachmentCount: number;
  attachments: Array<{ id: string; fileName: string }>;
  status: 'ok' | 'missing' | 'duplicate' | 'illegible';
}

export interface OcrAttachmentResult {
  attachmentId: string;
  transactionId: string;
  ocr: {
    documentType: string;
    merchant: string;
    amount: number | null;
    date: string | null;
    confidence: number;
  };
  suggestedMatches: Array<{
    transactionId: string;
    date: string;
    amount: number;
    description: string;
    score: number;
  }>;
}

export interface WeeklySummaryResult {
  weekStart: string;
  weekEnd: string;
  insights: string[];
  actions: string[];
}

export interface RecurringHint {
  transactionId: string;
  signature: string;
  score: number;
  intervalDays: number;
  description: string;
}

export interface Goal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  description?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardSummary {
  balance: number;
  totalIncome: number;
  totalExpense: number;
  transactionCount: number;
}

export interface MonthlyData {
  month: number;
  income: number;
  expense: number;
}

export interface CategoryStat {
  name: string;
  amount: number;
}

export interface DashboardMonthSummary extends DashboardSummary {
  month: string;
  previousMonthBalance: number;
  balanceVariationPercent: number | null;
}

export interface PendingPanelItem {
  id: string;
  label: string;
  count: number;
  actionPath: string;
}

export interface PendingPanel {
  total: number;
  items: PendingPanelItem[];
}

export interface BudgetOverviewRow {
  categoryId: string;
  categoryName: string;
  color: string | null;
  limit: number;
  spent: number;
  usagePercent: number;
  projectedSpent: number;
  projectedUsagePercent: number;
  status: 'green' | 'yellow' | 'red';
}

export interface CategoryBudget {
  id: string;
  categoryId: string;
  month: string;
  limit: string | number;
  category: Pick<Category, 'id' | 'name' | 'color'>;
}

export interface MonthlyClosingStep {
  key: string;
  title: string;
  detail: string;
  count: number;
  actionPath: string;
  /** When false, the step is not evaluated for the selected month (e.g. no movements). */
  applicable: boolean;
  done: boolean;
}

export interface MonthlyClosing {
  month: string;
  /** Transactions dated in the selected month (for empty-month UX). */
  monthTransactionCount: number;
  completedSteps: number;
  totalSteps: number;
  percent: number;
  steps: MonthlyClosingStep[];
}

export interface ImportPreviewRow {
  tempId?: string;
  date: string;
  amount: number;
  type: TransactionType;
  description: string;
  bankMemo?: string;
  categoryId?: string;
  categoryName?: string;
  aiSuggestedCategory?: string;
  duplicateInDb?: boolean;
  invalid?: boolean;
  /** Alinhado ao campo “potencial dedução IR” do modal de transação */
  deductiblePotential?: boolean;
}
