import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '../lib/api';
import { Category, TransactionType } from '../types';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import { categorySchema, type CategoryFormData } from '../lib/validations';

interface CategoryModalProps {
  category?: Category | null;
  onClose: () => void;
  onSave: () => void;
}

export default function CategoryModal({
  category,
  onClose,
  onSave,
}: CategoryModalProps) {
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      type: TransactionType.EXPENSE,
      color: '#16A34A',
    },
  });

  const watchedColor = watch('color');

  useEffect(() => {
    if (category) {
      reset({
        name: category.name,
        type: category.type,
        color: category.color,
      });
    } else {
      reset({
        name: '',
        type: TransactionType.EXPENSE,
        color: '#16A34A',
      });
    }
  }, [category, reset]);

  const onSubmit = async (data: CategoryFormData) => {
    setLoading(true);

    try {
      if (category) {
        await api.patch(`/categories/${category.id}`, data);
        toast.success('Categoria atualizada com sucesso');
      } else {
        await api.post('/categories', data);
        toast.success('Categoria criada com sucesso');
      }
      onSave();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao salvar categoria');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const colors = [
    '#16A34A', '#22C55E', '#1E3A8A', '#3B82F6', '#F59E0B',
    '#EF4444', '#06b6d4', '#84cc16', '#f97316', '#8b5cf6',
  ];

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-slide-up custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900">
            {category ? 'Editar Categoria' : 'Nova Categoria'}
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
              Nome
            </label>
            <input
              type="text"
              {...register('name')}
              className={`input-field ${errors.name ? 'border-red-500' : ''}`}
              placeholder="Ex: Alimentação"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

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
              Cor
            </label>
            <div className="flex items-center gap-3 mb-3">
              <input
                type="color"
                {...register('color')}
                className="w-16 h-10 rounded-lg border-2 border-gray-200 cursor-pointer"
              />
              <div className="flex-1 p-3 rounded-lg border-2 border-gray-200" style={{ backgroundColor: `${watchedColor}20` }}>
                <div className="text-sm font-medium" style={{ color: watchedColor }}>
                  Preview da cor
                </div>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setValue('color', color)}
                  className={`w-10 h-10 rounded-lg transition-all ${
                    watchedColor === color ? 'ring-2 ring-gray-400 scale-110' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

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
                category ? 'Atualizar' : 'Criar'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
