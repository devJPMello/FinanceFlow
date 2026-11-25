import { create } from 'zustand';
import { Button } from '../atoms/Button';
import { Modal } from './Modal';

interface Options { title: string; message: string; confirmLabel?: string; danger?: boolean }
interface State { opts: Options | null; resolve: ((v: boolean) => void) | null }

const useConfirmStore = create<State>(() => ({ opts: null, resolve: null }));

/** Substitui window.confirm: `if (await confirmDialog({...})) ...` */
export function confirmDialog(opts: Options): Promise<boolean> {
  return new Promise((resolve) => useConfirmStore.setState({ opts, resolve }));
}

export function ConfirmHost() {
  const { opts, resolve } = useConfirmStore();
  const close = (v: boolean) => {
    resolve?.(v);
    useConfirmStore.setState({ opts: null, resolve: null });
  };
  return (
    <Modal open={!!opts} title={opts?.title ?? ''} onClose={() => close(false)}>
      <p className="mb-6 text-sm text-slate-600 dark:text-slate-300">{opts?.message}</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => close(false)}>Cancelar</Button>
        <Button variant={opts?.danger === false ? 'primary' : 'danger'} onClick={() => close(true)}>{opts?.confirmLabel ?? 'Confirmar'}</Button>
      </div>
    </Modal>
  );
}
