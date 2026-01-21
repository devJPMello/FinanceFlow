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
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  description?: string;
  date: string;
  userId: string;
  categoryId: string;
  category: Category;
  createdAt: string;
  updatedAt: string;
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
