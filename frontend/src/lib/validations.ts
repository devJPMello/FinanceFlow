import { z } from 'zod';

// Schema de Login
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email é obrigatório')
    .email('Email inválido'),
  password: z
    .string()
    .min(1, 'Senha é obrigatória')
    .min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

// Schema de Registro
export const registerSchema = z.object({
  name: z
    .string()
    .min(1, 'Nome é obrigatório')
    .min(3, 'Nome deve ter no mínimo 3 caracteres'),
  email: z
    .string()
    .min(1, 'Email é obrigatório')
    .email('Email inválido'),
  password: z
    .string()
    .min(1, 'Senha é obrigatória')
    .min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

export type RegisterFormData = z.infer<typeof registerSchema>;

// Schema de Transação
export const transactionSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']).refine((val) => val !== undefined, {
    message: 'Tipo é obrigatório',
  }),
  amount: z
    .string()
    .min(1, 'Valor é obrigatório')
    .refine((val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    }, 'Valor deve ser maior que zero'),
  description: z.string().optional(),
  date: z.string().min(1, 'Data é obrigatória'),
  categoryId: z.string().min(1, 'Categoria é obrigatória'),
});

export type TransactionFormData = z.infer<typeof transactionSchema>;

// Schema de Categoria
export const categorySchema = z.object({
  name: z
    .string()
    .min(1, 'Nome é obrigatório')
    .min(2, 'Nome deve ter no mínimo 2 caracteres'),
  type: z.enum(['INCOME', 'EXPENSE']).refine((val) => val !== undefined, {
    message: 'Tipo é obrigatório',
  }),
  color: z.string().optional(),
});

export type CategoryFormData = z.infer<typeof categorySchema>;

// Schema de Meta
export const goalSchema = z.object({
  title: z
    .string()
    .min(1, 'Título é obrigatório')
    .min(3, 'Título deve ter no mínimo 3 caracteres'),
  targetAmount: z
    .string()
    .min(1, 'Valor-alvo é obrigatório')
    .refine((val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    }, 'Valor-alvo deve ser maior que zero'),
  deadline: z
    .string()
    .min(1, 'Data limite é obrigatória')
    .refine((val) => {
      const date = new Date(val);
      return date > new Date();
    }, 'Data limite deve ser uma data futura'),
  description: z.string().optional(),
});

export type GoalFormData = z.infer<typeof goalSchema>;
