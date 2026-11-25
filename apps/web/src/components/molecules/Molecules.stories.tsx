import type { Meta, StoryObj } from '@storybook/react';
import { ArrowDownRight, ArrowUpRight, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { CategoryTag } from './CategoryTag';
import { EmptyState } from './EmptyState';
import { FormField } from './FormField';
import { Modal } from './Modal';
import { MonthSwitcher } from './MonthSwitcher';
import { PageHeader } from './PageHeader';
import { PaymentBadge } from './PaymentBadge';
import { StatCard } from './StatCard';
import { TagInput } from './TagInput';

function MonthDemo() {
  const [m, setM] = useState('2026-11');
  return <MonthSwitcher value={m} onChange={setM} />;
}
function TagsDemo() {
  const [v, setV] = useState(['viagem', 'trabalho']);
  return <div className="max-w-md"><TagInput value={v} onChange={setV} suggestions={['casa', 'lazer']} /></div>;
}
function ModalDemo() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Abrir modal</Button>
      <Modal open={open} title="Nova categoria" onClose={() => setOpen(false)}>
        <FormField label="Nome"><Input autoFocus /></FormField>
      </Modal>
    </>
  );
}

const meta: Meta = { title: 'Molecules/Visão geral', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;

export const Campo: Story = {
  name: 'FormField',
  render: () => (
    <div className="grid max-w-sm gap-4">
      <FormField label="Descrição"><Input placeholder="Ex.: Supermercado" /></FormField>
      <FormField label="Valor" error="Valor deve ser positivo"><Input invalid defaultValue="-1" /></FormField>
      <FormField label="Senha" hint="Mínimo de 8 caracteres"><Input type="password" /></FormField>
    </div>
  ),
};

export const Cartoes: Story = {
  name: 'StatCard',
  render: () => (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard label="Receitas do mês" tone="income" icon={<ArrowUpRight className="h-5 w-5" />} footer="▲ 12% vs mês anterior">R$ 5.000,00</StatCard>
      <StatCard label="Despesas do mês" tone="expense" icon={<ArrowDownRight className="h-5 w-5" />} footer="▼ 4% vs mês anterior">R$ 595,70</StatCard>
      <StatCard label="Saldo" icon={<Wallet className="h-5 w-5" />}>R$ 4.404,30</StatCard>
    </div>
  ),
};

export const Vazio: Story = {
  name: 'EmptyState',
  render: () => <EmptyState title="Nenhuma transação neste mês" description="Adicione uma transação ou importe sua planilha." action={<Button>Nova transação</Button>} />,
};

export const Mes: Story = {
  name: 'MonthSwitcher',
  render: () => <MonthDemo />,
};

export const Etiquetas: Story = {
  name: 'CategoryTag e PaymentBadge',
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <CategoryTag name="Alimentação" color="#f97316" /><CategoryTag name="Transporte" color="#0ea5e9" /><CategoryTag />
      <PaymentBadge method="PIX" /><PaymentBadge method="DEBIT" /><PaymentBadge method="CREDIT" />
    </div>
  ),
};

export const Tags: Story = {
  name: 'TagInput',
  render: () => <TagsDemo />,
};

export const Cabecalho: Story = {
  name: 'PageHeader',
  render: () => <PageHeader title="Transações" subtitle="Todas as suas receitas e despesas em um só lugar." actions={<Button>Nova transação</Button>} />,
};

export const Janela: Story = {
  name: 'Modal',
  render: () => <ModalDemo />,
};
