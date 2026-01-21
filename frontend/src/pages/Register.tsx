import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { UserPlus } from 'lucide-react';
import { registerSchema, type RegisterFormData } from '../lib/validations';

export default function Register() {
  const [loading, setLoading] = useState(false);
  const register = useAuthStore((state) => state.register);
  const navigate = useNavigate();

  const {
    register: registerField,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setLoading(true);

    try {
      await register(data.name, data.email, data.password);
      toast.success('Conta criada com sucesso!');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] p-4">
      
      <div className="max-w-lg w-full relative z-10 animate-fade-in">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-10">
          <div className="text-center">
            <div className="flex justify-center mb-2">
              <img 
                src="/FinanceFlow.png" 
                alt="FinanceFlow" 
                className="h-44 w-auto"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <div className="inline-flex items-center justify-center w-32 h-32 bg-[#16A34A] rounded-2xl shadow-lg shadow-[#16A34A]/50 hidden">
                <UserPlus className="w-16 h-16 text-white" />
              </div>
            </div>
            <p className="text-gray-600 text-xl font-medium">Crie sua conta gratuitamente</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-3">
                Nome
              </label>
              <input
                id="name"
                type="text"
                {...registerField('name')}
                className={`input-field text-base py-3.5 ${errors.name ? 'border-red-500' : ''}`}
                placeholder="Seu nome"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-3">
                Email
              </label>
              <input
                id="email"
                type="email"
                {...registerField('email')}
                className={`input-field text-base py-3.5 ${errors.email ? 'border-red-500' : ''}`}
                placeholder="seu@email.com"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-3">
                Senha
              </label>
              <input
                id="password"
                type="password"
                {...registerField('password')}
                className={`input-field text-base py-3.5 ${errors.password ? 'border-red-500' : ''}`}
                placeholder="••••••••"
              />
              {errors.password ? (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">Mínimo de 6 caracteres</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-8 py-4 text-base"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Criando conta...
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <UserPlus className="w-5 h-5 mr-2" />
                  Criar conta
                </span>
              )}
            </button>
          </form>

          <p className="mt-10 text-center text-base text-gray-600">
            Já tem uma conta?{' '}
            <Link to="/login" className="text-[#16A34A] hover:text-[#15803d] font-semibold transition-colors">
              Faça login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
