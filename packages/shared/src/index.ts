import { z } from 'zod';

export const TransactionType = { INCOME: 'INCOME', EXPENSE: 'EXPENSE', TRANSFER: 'TRANSFER' } as const;
export type TransactionTypeValue = (typeof TransactionType)[keyof typeof TransactionType];

export const AccountType = { CHECKING: 'CHECKING', CREDIT_CARD: 'CREDIT_CARD', CASH: 'CASH', INVESTMENT: 'INVESTMENT' } as const;
export const CategoryKind = { INCOME: 'INCOME', EXPENSE: 'EXPENSE' } as const;
export const ImportFormat = { CSV: 'CSV', XLSX: 'XLSX', OFX: 'OFX' } as const;
export const ImportStatus = { UPLOADED: 'UPLOADED', MAPPED: 'MAPPED', CONFIRMED: 'CONFIRMED', REVERTED: 'REVERTED' } as const;
export const ImportRowStatus = { PENDING: 'PENDING', DUPLICATE: 'DUPLICATE', ERROR: 'ERROR', IMPORTED: 'IMPORTED' } as const;

export const registerSchema = z.object({
  name: z.string().min(2, 'Informe seu nome'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Mínimo de 8 caracteres'),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Informe a senha'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const accountSchema = z.object({
  name: z.string().min(1, 'Informe o nome'),
  type: z.enum(['CHECKING', 'CREDIT_CARD', 'CASH', 'INVESTMENT']),
  initialBalance: z.coerce.number().default(0),
});
export type AccountInput = z.infer<typeof accountSchema>;

export const categorySchema = z.object({
  name: z.string().min(1, 'Informe o nome'),
  kind: z.enum(['INCOME', 'EXPENSE']),
  color: z.string().default('#6366f1'),
});
export type CategoryInput = z.infer<typeof categorySchema>;

export const PaymentMethod = { PIX: 'PIX', DEBIT: 'DEBIT', CREDIT: 'CREDIT' } as const;
export type PaymentMethodValue = (typeof PaymentMethod)[keyof typeof PaymentMethod];
const paymentMethodField = z.preprocess((v) => (v === '' ? null : v), z.enum(['PIX', 'DEBIT', 'CREDIT']).nullable().optional());

export const transactionSchema = z.object({
  accountId: z.string().min(1, 'Selecione a conta'),
  categoryId: z.string().nullable().optional(),
  type: z.enum(['INCOME', 'EXPENSE']),
  amount: z.coerce.number().positive('Valor deve ser positivo'),
  date: z.string().min(1, 'Informe a data'),
  description: z.string().min(1, 'Informe a descrição'),
  notes: z.string().optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
  paymentMethod: paymentMethodField,
  /** Só na criação: gera N parcelas mensais, cada uma com o valor informado. */
  installments: z.coerce.number().int().min(1).max(60).optional(),
});
export type TransactionInput = z.infer<typeof transactionSchema>;

export const recurringSchema = z.object({
  accountId: z.string().min(1, 'Selecione a conta'),
  categoryId: z.string().nullable().optional(),
  type: z.enum(['INCOME', 'EXPENSE']),
  amount: z.coerce.number().positive('Valor deve ser positivo'),
  description: z.string().min(1, 'Informe a descrição'),
  paymentMethod: paymentMethodField,
  frequency: z.enum(['WEEKLY', 'MONTHLY', 'YEARLY']),
  startDate: z.string().min(1, 'Informe a data de início'),
  endDate: z.string().nullable().optional(),
});
export type RecurringInput = z.infer<typeof recurringSchema>;

export const ruleSchema = z.object({
  pattern: z.string().trim().min(1, 'Informe o texto').max(100),
  matchType: z.enum(['CONTAINS', 'REGEX']).default('CONTAINS'),
  categoryId: z.string().min(1, 'Selecione a categoria'),
  priority: z.coerce.number().int().min(0).max(1000).default(0),
});
export type RuleInput = z.infer<typeof ruleSchema>;

export const profileSchema = z.object({ name: z.string().trim().min(2, 'Informe seu nome') });
export type ProfileInput = z.infer<typeof profileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual'),
  newPassword: z.string().min(8, 'Mínimo de 8 caracteres'),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const budgetSchema = z.object({
  categoryId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  amount: z.coerce.number().positive(),
});
export type BudgetInput = z.infer<typeof budgetSchema>;

export interface ImportMapping {
  date: string;
  description: string;
  amount?: string;
  credit?: string;
  debit?: string;
  dateFormat: 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY';
  decimal: ',' | '.';
  invertSign?: boolean;
}

export const forgotPasswordSchema = z.object({ email: z.string().email('E-mail inválido') });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(8, 'Mínimo de 8 caracteres'),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
