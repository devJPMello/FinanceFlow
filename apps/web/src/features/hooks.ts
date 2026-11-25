import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AccountInput, BudgetInput, CategoryInput, ChangePasswordInput, ProfileInput, RecurringInput, RuleInput, TransactionInput } from '@financeflow/shared';
import { useAuth } from '@/lib/auth-store';
import { api, errorMessage } from '@/lib/api';
import { toast } from '@/lib/toast-store';
import type {
  Account, Budget, BudgetAlert, CashflowPoint, CategoryRule, RecurringRule, Category, ImportDetail, ImportListItem, ImportMappingInput, ImportUpload,
  Summary, TransactionList, TxFilters,
} from './types';

const get = <T,>(url: string, params?: object) => api.get<T>(url, { params }).then((r) => r.data);

// ---- contas
export const useAccounts = () => useQuery({ queryKey: ['accounts'], queryFn: () => get<Account[]>('/accounts') });

// ---- categorias
export const useCategories = () => useQuery({ queryKey: ['categories'], queryFn: () => get<Category[]>('/categories') });

// ---- transações
export const useTransactions = (f: TxFilters) =>
  useQuery({ queryKey: ['transactions', f], queryFn: () => get<TransactionList>('/transactions', f), placeholderData: (p) => p });

export const useTags = () => useQuery({ queryKey: ['tags'], queryFn: () => get<string[]>('/transactions/tags') });

// ---- regras de categorização
export const useRules = () => useQuery({ queryKey: ['rules'], queryFn: () => get<CategoryRule[]>('/category-rules') });

// ---- recorrentes
export const useRecurring = () => useQuery({ queryKey: ['recurring'], queryFn: () => get<RecurringRule[]>('/recurring') });

// ---- orçamentos / relatórios
export const useBudgetAlerts = (month: string) =>
  useQuery({ queryKey: ['budgets', 'alerts', month], queryFn: () => get<BudgetAlert[]>('/budgets/alerts', { month }) });
export const useBudgets = (month: string) => useQuery({ queryKey: ['budgets', month], queryFn: () => get<Budget[]>('/budgets', { month }) });
export const useSummary = (from: string, to: string) =>
  useQuery({ queryKey: ['summary', from, to], queryFn: () => get<Summary>('/reports/summary', { from, to }) });
export const useCashflow = (months = 6) =>
  useQuery({ queryKey: ['cashflow', months], queryFn: () => get<CashflowPoint[]>('/reports/cashflow', { months }) });

// ---- importações
export const useImports = () => useQuery({ queryKey: ['imports'], queryFn: () => get<ImportListItem[]>('/imports') });
export const useImportDetail = (id?: string) =>
  useQuery({ queryKey: ['import', id], queryFn: () => get<ImportDetail>(`/imports/${id}`), enabled: !!id });

/** Mutation que invalida chaves, avisa sucesso (opcional) e sempre avisa erro via toast. */
function useApiMutation<V, R = unknown>(fn: (v: V) => Promise<R>, invalidate: string[][] = [], success?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      invalidate.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      if (success) toast.success(success);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

const money = [['transactions'], ['accounts'], ['summary'], ['cashflow'], ['budgets'], ['tags']];

export const useSaveAccount = () =>
  useApiMutation(({ id, ...d }: AccountInput & { id?: string }) => (id ? api.put(`/accounts/${id}`, d) : api.post('/accounts', d)), [['accounts']], 'Conta salva');
export const useDeleteAccount = () => useApiMutation((id: string) => api.delete(`/accounts/${id}`), [['accounts'], ...money], 'Conta excluída');

export const useSaveCategory = () =>
  useApiMutation(({ id, ...d }: CategoryInput & { id?: string }) => (id ? api.put(`/categories/${id}`, d) : api.post('/categories', d)), [['categories']], 'Categoria salva');
export const useDeleteCategory = () => useApiMutation((id: string) => api.delete(`/categories/${id}`), [['categories'], ...money], 'Categoria excluída');

export const useSaveTransaction = () =>
  useApiMutation(({ id, ...d }: TransactionInput & { id?: string }) => (id ? api.put(`/transactions/${id}`, d) : api.post('/transactions', d)), money, 'Transação salva');
export const useDeleteTransaction = () => useApiMutation((id: string) => api.delete(`/transactions/${id}`), money, 'Transação excluída');
export const useBulkCategory = () =>
  useApiMutation((v: { ids: string[]; categoryId: string | null }) => api.post('/transactions/bulk-category', v), money, 'Categoria aplicada');

export const useSaveRule = () => useApiMutation((d: RuleInput) => api.post('/category-rules', d), [['rules']], 'Regra criada');
export const useDeleteRule = () => useApiMutation((id: string) => api.delete(`/category-rules/${id}`), [['rules']], 'Regra removida');
export const useApplyRules = () =>
  useApiMutation(() => api.post<{ updated: number }>('/category-rules/apply').then((r) => r.data), money);

export const useSaveRecurring = () =>
  useApiMutation(({ id, ...d }: RecurringInput & { id?: string }) => (id ? api.put(`/recurring/${id}`, d) : api.post('/recurring', d)), [['recurring'], ...money], 'Recorrência salva');
export const useToggleRecurring = () =>
  useApiMutation((v: { id: string; active: boolean }) => api.patch(`/recurring/${v.id}/active`, { active: v.active }), [['recurring'], ...money]);
export const useDeleteRecurring = () => useApiMutation((id: string) => api.delete(`/recurring/${id}`), [['recurring']], 'Recorrência excluída');
export const useRunRecurring = () => useApiMutation(() => api.post<{ created: number }>('/recurring/run').then((r) => r.data), [['recurring'], ...money]);

export const useUploadAttachment = () =>
  useApiMutation((v: { transactionId: string; file: File }) => {
    const fd = new FormData();
    fd.append('file', v.file);
    return api.post(`/transactions/${v.transactionId}/attachments`, fd).then((r) => r.data);
  }, [['transactions']], 'Anexo enviado');
export const useDeleteAttachment = () => useApiMutation((id: string) => api.delete(`/attachments/${id}`), [['transactions']], 'Anexo removido');

export async function downloadAttachment(id: string, fileName: string) {
  try {
    const { data } = await api.get(`/attachments/${id}/download`, { responseType: 'blob' });
    const url = URL.createObjectURL(data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    toast.error(errorMessage(e));
  }
}

// ---- perfil
export const useUpdateProfile = () => {
  const setUser = useAuth((s) => s.setUser);
  return useMutation({
    mutationFn: (d: ProfileInput) => api.patch<{ id: string; name: string; email: string }>('/auth/me', d).then((r) => r.data),
    onSuccess: (u) => { setUser(u); toast.success('Perfil atualizado'); },
    onError: (e) => toast.error(errorMessage(e)),
  });
};
export const useChangePassword = () => {
  const setSession = useAuth((s) => s.setSession);
  return useMutation({
    mutationFn: (d: ChangePasswordInput) => api.post('/auth/change-password', d).then((r) => r.data),
    onSuccess: (session) => { setSession(session); toast.success('Senha alterada'); },
    onError: (e) => toast.error(errorMessage(e)),
  });
};
export const useDeleteMyAccount = () => useApiMutation((password: string) => api.delete('/auth/me', { data: { password } }));

export const useSaveBudget = () => useApiMutation((d: BudgetInput) => api.post('/budgets', d), [['budgets']], 'Orçamento definido');
export const useDeleteBudget = () => useApiMutation((id: string) => api.delete(`/budgets/${id}`), [['budgets']], 'Orçamento removido');

export const useUploadImport = () =>
  useApiMutation((file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post<ImportUpload>('/imports', fd).then((r) => r.data);
  }, [['imports']]);
export const useApplyMapping = (id: string) =>
  useApiMutation((v: { accountId: string; mapping: ImportMappingInput }) => api.post<ImportDetail>(`/imports/${id}/mapping`, v).then((r) => r.data), [['import', id]]);
export const usePatchImportRow = (id: string) =>
  useApiMutation((v: { rowId: string; categoryId?: string | null; skip?: boolean }) => {
    const { rowId, ...body } = v;
    return api.patch(`/imports/${id}/rows/${rowId}`, body);
  }, [['import', id]]);
export const useConfirmImport = (id: string) =>
  useApiMutation(() => api.post<{ imported: number }>(`/imports/${id}/confirm`).then((r) => r.data), [['imports'], ['import', id], ...money]);
export const useRevertImport = () => useApiMutation((id: string) => api.delete(`/imports/${id}`), [['imports'], ...money], 'Importação desfeita');

export async function downloadTransactionsCsv(f: TxFilters) {
  try {
    const { data } = await api.get('/transactions/export.csv', { params: f, responseType: 'blob' });
    const url = URL.createObjectURL(data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transacoes.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado');
  } catch (e) {
    toast.error(errorMessage(e));
  }
}
