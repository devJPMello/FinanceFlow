import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Download, KeyRound, Moon, Sun, User } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { changePasswordSchema, ChangePasswordInput, profileSchema, ProfileInput } from '@financeflow/shared';
import { useAuth } from '@/lib/auth-store';
import { downloadTransactionsCsv, useChangePassword, useDeleteMyAccount, useUpdateProfile } from '@/features/hooks';
import { Avatar } from '../atoms/Avatar';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Card, SectionTitle } from '../atoms/Typography';
import { FormField } from '../molecules/FormField';
import { Modal } from '../molecules/Modal';
import { PageHeader } from '../molecules/PageHeader';
import { useDarkMode } from '../organisms/Sidebar';

function ProfileCard() {
  const user = useAuth((s) => s.user);
  const update = useUpdateProfile();
  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema) as never, defaultValues: { name: user?.name ?? '' },
  });
  return (
    <Card>
      <SectionTitle><span className="flex items-center gap-2"><User className="h-4 w-4 text-slate-400" />Perfil</span></SectionTitle>
      <div className="mb-5 flex items-center gap-4">
        <Avatar name={user?.name} className="!h-14 !w-14 text-lg" />
        <div className="min-w-0"><p className="truncate font-semibold">{user?.name}</p><p className="truncate text-sm text-slate-500">{user?.email}</p></div>
      </div>
      <form className="space-y-4" noValidate onSubmit={handleSubmit((v) => update.mutate(v))}>
        <FormField label="Nome" error={errors.name?.message}><Input {...register('name')} /></FormField>
        <FormField label="E-mail"><Input value={user?.email ?? ''} disabled readOnly /></FormField>
        <div className="flex justify-end"><Button type="submit" loading={update.isPending} disabled={!isDirty}>Salvar</Button></div>
      </form>
    </Card>
  );
}

function PasswordCard() {
  const change = useChangePassword();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) as never });
  return (
    <Card>
      <SectionTitle><span className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-slate-400" />Senha</span></SectionTitle>
      <form className="space-y-4" noValidate onSubmit={handleSubmit((v) => change.mutate(v, { onSuccess: () => reset() }))}>
        <FormField label="Senha atual" error={errors.currentPassword?.message}><Input type="password" autoComplete="current-password" {...register('currentPassword')} /></FormField>
        <FormField label="Nova senha" error={errors.newPassword?.message}><Input type="password" autoComplete="new-password" {...register('newPassword')} /></FormField>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">Mínimo de 8 caracteres.</p>
          <Button type="submit" loading={change.isPending}>Alterar senha</Button>
        </div>
      </form>
    </Card>
  );
}

function DangerCard() {
  const logout = useAuth((s) => s.logout);
  const del = useDeleteMyAccount();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  return (
    <Card className="!border-rose-200 dark:!border-rose-500/30">
      <SectionTitle><span className="flex items-center gap-2 text-rose-600"><AlertTriangle className="h-4 w-4" />Zona de perigo</span></SectionTitle>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-slate-500">Excluir sua conta apaga permanentemente contas, transações, orçamentos, anexos e importações. Não dá para desfazer.</p>
        <Button variant="danger" onClick={() => setOpen(true)}>Excluir minha conta</Button>
      </div>
      <Modal open={open} title="Excluir conta" onClose={() => { setOpen(false); setPassword(''); }}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); del.mutate(password, { onSuccess: () => logout() }); }}>
          <p className="text-sm text-slate-600 dark:text-slate-300">Para confirmar, digite sua senha. Todos os seus dados serão apagados.</p>
          <FormField label="Senha"><Input type="password" autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => { setOpen(false); setPassword(''); }}>Cancelar</Button>
            <Button type="submit" variant="danger" disabled={!password} loading={del.isPending}>Excluir para sempre</Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

export function SettingsPage() {
  const { dark, toggle } = useDarkMode();
  return (
    <>
      <PageHeader title="Configurações" subtitle="Seu perfil, segurança e preferências." />
      <div className="grid gap-4 lg:grid-cols-2">
        <ProfileCard />
        <PasswordCard />
      </div>
      <Card>
        <SectionTitle>Preferências e dados</SectionTitle>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={toggle}>{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}{dark ? 'Usar tema claro' : 'Usar tema escuro'}</Button>
          <Button variant="secondary" onClick={() => downloadTransactionsCsv({})}><Download className="h-4 w-4" />Exportar todas as transações (CSV)</Button>
        </div>
      </Card>
      <DangerCard />
    </>
  );
}
