import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Lock, Mail, User } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { loginSchema, LoginInput, registerSchema, RegisterInput } from '@financeflow/shared';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { FormField } from '../molecules/FormField';
import { AuthTemplate } from '../templates/Templates';

export function LoginPage() {
  const setSession = useAuth((s) => s.setSession);
  const login = useMutation({ mutationFn: (v: LoginInput) => api.post('/auth/login', v).then((r) => r.data), onSuccess: setSession });
  const { register, handleSubmit, formState: { errors } } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });
  return (
    <AuthTemplate title="Bem-vindo de volta" subtitle="Entre para acessar suas finanças">
      <form className="space-y-4" noValidate onSubmit={handleSubmit((v) => login.mutate(v))}>
        <FormField label="E-mail" error={errors.email?.message}>
          <Input type="email" autoComplete="email" placeholder="voce@email.com" icon={<Mail className="h-4 w-4" />} {...register('email')} />
        </FormField>
        <FormField label="Senha" error={errors.password?.message}>
          <Input type="password" autoComplete="current-password" placeholder="••••••••" icon={<Lock className="h-4 w-4" />} {...register('password')} />
        </FormField>
        {login.isError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10">{errorMessage(login.error)}</p>}
        <Button type="submit" size="lg" className="w-full" loading={login.isPending}>Entrar</Button>
      </form>
      <p className="text-center text-sm text-slate-500">Não tem conta? <Link className="font-medium text-brand-600 hover:underline" to="/register">Cadastre-se grátis</Link></p>
    </AuthTemplate>
  );
}

export function RegisterPage() {
  const setSession = useAuth((s) => s.setSession);
  const reg = useMutation({ mutationFn: (v: RegisterInput) => api.post('/auth/register', v).then((r) => r.data), onSuccess: setSession });
  const { register, handleSubmit, formState: { errors } } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });
  return (
    <AuthTemplate title="Crie sua conta" subtitle="Comece a organizar seus gastos agora">
      <form className="space-y-4" noValidate onSubmit={handleSubmit((v) => reg.mutate(v))}>
        <FormField label="Nome" error={errors.name?.message}><Input autoComplete="name" icon={<User className="h-4 w-4" />} {...register('name')} /></FormField>
        <FormField label="E-mail" error={errors.email?.message}><Input type="email" autoComplete="email" icon={<Mail className="h-4 w-4" />} {...register('email')} /></FormField>
        <FormField label="Senha" error={errors.password?.message} hint="Mínimo de 8 caracteres">
          <Input type="password" autoComplete="new-password" icon={<Lock className="h-4 w-4" />} {...register('password')} />
        </FormField>
        {reg.isError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10">{errorMessage(reg.error)}</p>}
        <Button type="submit" size="lg" className="w-full" loading={reg.isPending}>Criar conta</Button>
      </form>
      <p className="text-center text-sm text-slate-500">Já tem conta? <Link className="font-medium text-brand-600 hover:underline" to="/login">Entrar</Link></p>
    </AuthTemplate>
  );
}
