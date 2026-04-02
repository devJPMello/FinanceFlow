import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '../lib/api';
import { Goal } from '../types';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import { goalSchema, type GoalFormData } from '../lib/validations';

interface GoalModalProps {
  goal?: Goal | null;
  onClose: () => void;
  onSave: () => void;
}

export default function GoalModal({ goal, onClose, onSave }: GoalModalProps) {
  const [loading, setLoading] = useState(false);

  const defaultDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d;
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<GoalFormData>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      title: '',
      targetAmount: '',
      deadline: defaultDate.toISOString().split('T')[0],
      description: '',
    },
  });

  useEffect(() => {
    if (goal) {
      reset({
        title: goal.title,
        targetAmount: goal.targetAmount.toString(),
        deadline: goal.deadline.split('T')[0],
        description: goal.description || '',
      });
    } else {
      reset({
        title: '',
        targetAmount: '',
        deadline: defaultDate.toISOString().split('T')[0],
        description: '',
      });
    }
  }, [goal, reset, defaultDate]);

  const onSubmit = async (data: GoalFormData) => {
    setLoading(true);

    try {
      if (goal) {
        await api.patch(`/goals/${goal.id}`, data);
        toast.success('Meta atualizada com sucesso');
      } else {
        await api.post('/goals', data);
        toast.success('Meta criada com sucesso');
      }
      onSave();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao salvar meta');
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
            {goal ? 'Editar Meta' : 'Nova Meta'}
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
              Título
            </label>
            <input
              type="text"
              {...register('title')}
              className={`input-field ${errors.title ? 'border-red-500' : ''}`}
              placeholder="Ex: Reserva de emergência"
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Valor-alvo
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              {...register('targetAmount')}
              className={`input-field ${errors.targetAmount ? 'border-red-500' : ''}`}
              placeholder="0.00"
            />
            {errors.targetAmount && (
              <p className="mt-1 text-sm text-red-600">{errors.targetAmount.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Data limite
            </label>
            <input
              type="date"
              {...register('deadline')}
              className={`input-field ${errors.deadline ? 'border-red-500' : ''}`}
            />
            {errors.deadline && (
              <p className="mt-1 text-sm text-red-600">{errors.deadline.message}</p>
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
                goal ? 'Atualizar' : 'Criar'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
