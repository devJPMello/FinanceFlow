import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Lock, Mail, User } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { forgotPasswordSchema, ForgotPasswordInput, loginSchema, LoginInput, registerSchema, RegisterInput } from '@financeflow/shared';
import { z } from 'zod';
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
        <div className="-mt-1 text-right"><Link className="text-sm font-medium text-brand-600 hover:underline" to="/forgot-password">Esqueci minha senha</Link></div>
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

export function ForgotPasswordPage() {
  const send = useMutation({ mutationFn: (v: ForgotPasswordInput) => api.post('/auth/forgot-password', v) });
  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });
  return (
    <AuthTemplate title="Recuperar senha" subtitle="Enviaremos um link para você criar uma nova senha">
      {send.isSuccess ? (
        <div role="status" className="space-y-3 rounded-2xl bg-emerald-50 p-5 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
          <CheckCircle2 className="h-6 w-6" />
          <p className="font-semibold">Pedido enviado</p>
          <p>Se houver uma conta com esse e-mail, você receberá o link em instantes. Ele vale por 1 hora.</p>
        </div>
      ) : (
        <form className="space-y-4" noValidate onSubmit={handleSubmit((v) => send.mutate(v))}>
          <FormField label="E-mail" error={errors.email?.message}>
            <Input type="email" autoComplete="email" placeholder="voce@email.com" icon={<Mail className="h-4 w-4" />} {...register('email')} />
          </FormField>
          {send.isError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10">{errorMessage(send.error)}</p>}
          <Button type="submit" size="lg" className="w-full" loading={send.isPending}>Enviar link</Button>
        </form>
      )}
      <p className="text-center text-sm text-slate-500"><Link className="font-medium text-brand-600 hover:underline" to="/login">Voltar para o login</Link></p>
    </AuthTemplate>
  );
}

const resetForm = z.object({ newPassword: z.string().min(8, 'Mínimo de 8 caracteres'), confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'As senhas não conferem' });
type ResetForm = z.infer<typeof resetForm>;

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const reset = useMutation({
    mutationFn: (v: ResetForm) => api.post('/auth/reset-password', { token, newPassword: v.newPassword }),
    onSuccess: () => setTimeout(() => navigate('/login', { replace: true }), 1800),
  });
  const { register, handleSubmit, formState: { errors } } = useForm<ResetForm>({ resolver: zodResolver(resetForm) });
  return (
    <AuthTemplate title="Nova senha" subtitle="Escolha uma senha forte com pelo menos 8 caracteres">
      {!token ? (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10">Link inválido. <Link className="font-medium underline" to="/forgot-password">Peça um novo</Link>.</p>
      ) : reset.isSuccess ? (
        <div role="status" className="space-y-2 rounded-2xl bg-emerald-50 p-5 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
          <CheckCircle2 className="h-6 w-6" /><p className="font-semibold">Senha alterada!</p><p>Redirecionando para o login…</p>
        </div>
      ) : (
        <form className="space-y-4" noValidate onSubmit={handleSubmit((v) => reset.mutate(v))}>
          <FormField label="Nova senha" error={errors.newPassword?.message}><Input type="password" autoComplete="new-password" icon={<Lock className="h-4 w-4" />} {...register('newPassword')} /></FormField>
          <FormField label="Confirmar senha" error={errors.confirm?.message}><Input type="password" autoComplete="new-password" icon={<Lock className="h-4 w-4" />} {...register('confirm')} /></FormField>
          {reset.isError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10">{errorMessage(reset.error)}</p>}
          <Button type="submit" size="lg" className="w-full" loading={reset.isPending}>Redefinir senha</Button>
        </form>
      )}
    </AuthTemplate>
  );
}
