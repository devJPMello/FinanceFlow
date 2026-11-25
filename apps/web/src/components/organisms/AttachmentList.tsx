import { Download, FileText, Image as ImageIcon, Paperclip, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { downloadAttachment, useDeleteAttachment, useUploadAttachment } from '@/features/hooks';
import type { Attachment } from '@/features/types';
import { toast } from '@/lib/toast-store';
import { Button, IconButton } from '../atoms/Button';
import { confirmDialog } from '../molecules/ConfirmHost';

const size = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Comprovantes de uma transação já salva: lista, envio, download e exclusão. */
export function AttachmentList({ transactionId, items }: { transactionId: string; items: Attachment[] }) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadAttachment();
  const del = useDeleteAttachment();

  const onPick = (file?: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error('O arquivo passa de 5 MB');
    upload.mutate({ transactionId, file });
    if (input.current) input.current.value = '';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Comprovantes</p>
        <Button type="button" variant="secondary" size="sm" loading={upload.isPending} disabled={items.length >= 5} onClick={() => input.current?.click()}>
          <Paperclip className="h-3.5 w-3.5" />Anexar
        </Button>
        <input ref={input} type="file" hidden accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(e) => onPick(e.target.files?.[0])} />
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-500">PDF, PNG, JPG ou WEBP, até 5 MB (máx. 5 arquivos).</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
          {items.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              {a.mime.startsWith('image/') ? <ImageIcon className="h-4 w-4 text-slate-400" /> : <FileText className="h-4 w-4 text-slate-400" />}
              <span className="min-w-0 flex-1 truncate">{a.fileName}</span>
              <span className="text-xs text-slate-400">{size(a.size)}</span>
              <IconButton label={`Baixar ${a.fileName}`} type="button" onClick={() => downloadAttachment(a.id, a.fileName)}><Download className="h-4 w-4" /></IconButton>
              <IconButton
                label={`Remover ${a.fileName}`} type="button"
                onClick={async () => (await confirmDialog({ title: 'Remover anexo', message: `Remover “${a.fileName}”?`, confirmLabel: 'Remover' })) && del.mutate(a.id)}
              ><Trash2 className="h-4 w-4" /></IconButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
