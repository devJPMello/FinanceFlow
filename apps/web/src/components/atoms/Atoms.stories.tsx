import type { Meta, StoryObj } from '@storybook/react';
import { ArrowRight, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { Button, IconButton } from './Button';
import { Input, Select } from './Input';
import { Money } from './Money';
import { Segmented } from './Segmented';
import { Skeleton } from './Skeleton';
import { Spinner } from './Spinner';
import { Card, ColorDot, Heading, SectionTitle, Text } from './Typography';

function SegmentedDemo() {
  const [v, setV] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  return <Segmented label="Tipo" value={v} onChange={setV} options={[{ value: 'EXPENSE', label: 'Despesa', tone: 'expense' }, { value: 'INCOME', label: 'Receita', tone: 'income' }]} />;
}

const meta: Meta = { title: 'Atoms/Visão geral', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;

export const Botoes: Story = {
  name: 'Button',
  render: () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button>Primário</Button>
        <Button variant="secondary">Secundário</Button>
        <Button variant="soft">Suave</Button>
        <Button variant="ghost">Fantasma</Button>
        <Button variant="danger">Perigo</Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm">Pequeno</Button>
        <Button size="lg">Grande<ArrowRight className="h-4 w-4" /></Button>
        <Button><Plus className="h-4 w-4" />Com ícone</Button>
        <Button loading>Salvando</Button>
        <Button disabled>Desabilitado</Button>
        <IconButton label="Excluir"><Trash2 className="h-4 w-4" /></IconButton>
      </div>
    </div>
  ),
};

export const Campos: Story = {
  name: 'Input e Select',
  render: () => (
    <div className="grid max-w-md gap-3">
      <Input placeholder="Texto" />
      <Input placeholder="Com erro" invalid />
      <Input placeholder="Desabilitado" disabled />
      <Select defaultValue="PIX"><option value="PIX">Pix</option><option value="DEBIT">Débito</option><option value="CREDIT">Crédito</option></Select>
    </div>
  ),
};

export const Selos: Story = {
  name: 'Badge, Avatar e ColorDot',
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Badge>Neutro</Badge><Badge tone="success">Sucesso</Badge><Badge tone="warning">Atenção</Badge><Badge tone="danger">Estourado</Badge><Badge tone="info">Info</Badge>
      <Avatar name="João Pedro" /><Avatar name="Maria" className="!h-14 !w-14 text-lg" />
      <ColorDot color="#f97316" /><ColorDot color="#6366f1" />
    </div>
  ),
};

export const Dinheiro: Story = {
  name: 'Money',
  render: () => (
    <div className="space-y-1 text-lg font-semibold">
      <div><Money value={1234.5} type="INCOME" /></div>
      <div><Money value={89.9} type="EXPENSE" /></div>
      <div><Money value={-150} /></div>
      <div><Money value={5000} plain /></div>
    </div>
  ),
};

export const Controle: Story = {
  name: 'Segmented',
  render: () => <SegmentedDemo />,
};

export const Carregando: Story = {
  name: 'Skeleton e Spinner',
  render: () => (
    <div className="max-w-sm space-y-3">
      <Skeleton className="h-6 w-40" /><Skeleton className="h-12 w-full" /><Spinner className="h-6 w-6 text-brand-600" />
    </div>
  ),
};

export const Tipografia: Story = {
  name: 'Typography e Card',
  render: () => (
    <Card className="max-w-md">
      <SectionTitle action={<Button size="sm" variant="soft">Ação</Button>}>Título da seção</SectionTitle>
      <Heading className="text-2xl">Heading</Heading>
      <Text>Texto padrão do aplicativo.</Text>
      <Text muted>Texto secundário, em cinza.</Text>
    </Card>
  ),
};
