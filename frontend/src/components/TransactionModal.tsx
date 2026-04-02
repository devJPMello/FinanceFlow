import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '../lib/api';
import { Transaction, TransactionType, Category, TransactionAttachmentMeta } from '../types';
import toast from 'react-hot-toast';
import { X, Paperclip, Download, Upload } from 'lucide-react';
import { transactionSchema, type TransactionFormData } from '../lib/validations';

interface TransactionModalProps {
  transaction?: Transaction | null;
  categories: Category[];
  onClose: () => void;
  onSave: () => void;
}

export default function TransactionModal({
  transaction,
  categories,
  onClose,
  onSave,
}: TransactionModalProps) {
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState<TransactionAttachmentMeta[]>([]);
  const [attachLoading, setAttachLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: TransactionType.EXPENSE,
      amount: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      categoryId: '',
      deductiblePotential: false,
    },
  });

  const watchedType = watch('type');
  const watchedCategoryId = watch('categoryId');
  const deductibleWatch = watch('deductiblePotential');

  useEffect(() => {
    if (transaction) {
      reset({
        type: transaction.type,
        amount: transaction.amount.toString(),
        description: transaction.description || '',
        date: transaction.date.split('T')[0],
        categoryId: transaction.categoryId,
        deductiblePotential: transaction.deductiblePotential ?? false,
      });
    } else {
      reset({
        type: TransactionType.EXPENSE,
        amount: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        categoryId: '',
        deductiblePotential: false,
      });
    }
  }, [transaction, reset]);

  useEffect(() => {
    if (transaction) return;
    const cat = categories.find((c) => c.id === watchedCategoryId);
    if (watchedType === TransactionType.INCOME) {
      setValue('deductiblePotential', false);
      return;
    }
    if (watchedType === TransactionType.EXPENSE && cat?.suggestTaxDeductible) {
      setValue('deductiblePotential', true);
    } else if (watchedType === TransactionType.EXPENSE && cat && watchedCategoryId) {
      setValue('deductiblePotential', false);
    }
  }, [watchedCategoryId, watchedType, categories, transaction, setValue]);

  useEffect(() => {
    if (!transaction?.id) {
      setAttachments([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<TransactionAttachmentMeta[]>(
          `/transactions/${transaction.id}/attachments`,
        );
        if (!cancelled) setAttachments(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setAttachments([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [transaction?.id]);

  useEffect(() => {
    if (transaction) return;
    setValue('categoryId', '');
  }, [watchedType, setValue, transaction]);

  const filteredCategories = categories.filter(
    (cat) => cat.type === watchedType
  );

  const onSubmit = async (data: TransactionFormData) => {
    setLoading(true);

    const payload = {
      ...data,
      deductiblePotential:
        data.type === TransactionType.EXPENSE ? !!data.deductiblePotential : false,
    };

    try {
      if (transaction) {
        await api.patch(`/transactions/${transaction.id}`, payload);
        toast.success('Transação atualizada com sucesso');
      } else {
        await api.post('/transactions', payload);
        toast.success('Transação criada com sucesso');
      }
      onSave();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao salvar transação');
    } finally {
      setLoading(false);
    }
  };

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !transaction?.id) return;
    setAttachLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.post(`/transactions/${transaction.id}/attachments`, fd);
      toast.success('Anexo guardado');
      const { data } = await api.get<TransactionAttachmentMeta[]>(
        `/transactions/${transaction.id}/attachments`,
      );
      setAttachments(Array.isArray(data) ? data : []);
      onSave();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao enviar anexo');
    } finally {
      setAttachLoading(false);
    }
  };

  const downloadAttachment = async (attachmentId: string, fileName: string) => {
    if (!transaction?.id) return;
    try {
      const res = await api.get(
        `/transactions/${transaction.id}/attachments/${attachmentId}/download`,
        { responseType: 'blob' },
      );
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Erro ao descarregar');
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-slide-up custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900">
            {transaction ? 'Editar Transação' : 'Nova Transação'}
          </h2>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Tipo
            </label>
            <select
              {...register('type')}
              className={`input-field ${errors.type ? 'border-red-500' : ''}`}
            >
              <option value={TransactionType.INCOME}>Receita</option>
              <option value={TransactionType.EXPENSE}>Despesa</option>
            </select>
            {errors.type && (
              <p className="mt-1 text-sm text-red-600">{errors.type.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Categoria
            </label>
            <select
              {...register('categoryId')}
              className={`input-field ${errors.categoryId ? 'border-red-500' : ''}`}
            >
              <option value="">Selecione uma categoria</option>
              {filteredCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            {errors.categoryId && (
              <p className="mt-1 text-sm text-red-600">{errors.categoryId.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Valor
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              {...register('amount')}
              className={`input-field ${errors.amount ? 'border-red-500' : ''}`}
              placeholder="0.00"
            />
            {errors.amount && (
              <p className="mt-1 text-sm text-red-600">{errors.amount.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Data
            </label>
            <input
              type="date"
              {...register('date')}
              className={`input-field ${errors.date ? 'border-red-500' : ''}`}
            />
            {errors.date && (
              <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Descrição (opcional)
            </label>
            <textarea
              {...register('description')}
              className="input-field resize-none"
              rows={3}
              placeholder="Adicione uma descrição..."
            />
          </div>

          {transaction?.id && (
            <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-100 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Paperclip className="w-4 h-4 text-amber-700" />
                Baú fiscal (anexos)
              </div>
              <p className="text-xs text-gray-600">
                Notas fiscais e recibos ligados a este lançamento. Use após importar o extrato ou criar a transação.
              </p>
              <label className="inline-flex items-center gap-2 text-sm text-[#16A34A] font-medium cursor-pointer">
                <Upload className="w-4 h-4" />
                {attachLoading ? 'A enviar…' : 'Adicionar ficheiro (máx. 5 MB)'}
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf,application/pdf"
                  disabled={attachLoading}
                  onChange={handleAttachmentUpload}
                />
              </label>
              {attachments.length > 0 && (
                <ul className="space-y-2 text-sm border-t border-amber-100 pt-3">
                  {attachments.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-2 text-gray-700"
                    >
                      <span className="truncate">{a.fileName}</span>
                      <button
                        type="button"
                        onClick={() => downloadAttachment(a.id, a.fileName)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg flex-shrink-0"
                        title="Descarregar"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {watchedType === TransactionType.EXPENSE && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <input
                type="checkbox"
                id="deductiblePotential"
                className="mt-1 rounded border-gray-300 text-[#16A34A] focus:ring-[#16A34A]"
                checked={!!deductibleWatch}
                onChange={(e) => setValue('deductiblePotential', e.target.checked)}
              />
              <label htmlFor="deductiblePotential" className="text-sm text-gray-800 cursor-pointer">
                <span className="font-semibold text-gray-900">Potencial dedução no IR</span>
                <span className="block text-gray-600 mt-0.5">
                  Marque despesas que podem reduzir imposto (ex.: saúde, educação), conforme regras da Receita.
                  Apenas informativo — confirme com seu contador.
                </span>
              </label>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Salvando...
                </span>
              ) : (
                transaction ? 'Atualizar' : 'Criar'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
