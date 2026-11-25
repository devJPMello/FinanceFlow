import clsx from 'clsx';
import { FileSpreadsheet, UploadCloud } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Spinner } from '../atoms/Spinner';

interface Props {
  onFile: (file: File) => void;
  loading?: boolean;
}

export function FileDropzone({ onFile, loading }: Props) {
  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    accept: {
      'text/csv': ['.csv'],
      'text/plain': ['.txt'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/x-ofx': ['.ofx'],
      'application/octet-stream': ['.ofx'],
    },
    maxSize: 5 * 1024 * 1024,
    multiple: false,
    disabled: loading,
    onDropAccepted: (files) => onFile(files[0]),
  });
  return (
    <div>
      <div
        {...getRootProps()}
        className={clsx(
          'group flex cursor-pointer flex-col items-center gap-3 rounded-3xl border-2 border-dashed p-12 text-center transition-all',
          isDragActive
            ? 'scale-[1.01] border-brand-500 bg-brand-50 dark:bg-brand-500/10'
            : 'border-slate-300 bg-white hover:border-brand-400 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-900/50',
        )}
      >
        <input {...getInputProps()} aria-label="Selecionar arquivo" />
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 transition-transform group-hover:scale-110 dark:bg-brand-500/15">
          {loading ? <Spinner /> : isDragActive ? <FileSpreadsheet className="h-7 w-7" /> : <UploadCloud className="h-7 w-7" />}
        </span>
        <p className="text-base font-semibold">
          {loading ? 'Lendo arquivo…' : isDragActive ? 'Solte para importar' : 'Arraste sua planilha aqui'}
        </p>
        {!loading && <p className="text-sm text-slate-500">ou <span className="font-medium text-brand-600">clique para escolher</span> — CSV, XLSX ou OFX até 5 MB</p>}
      </div>
      {fileRejections.length > 0 && (
        <p role="alert" className="mt-3 text-sm text-rose-600">Arquivo inválido. Use CSV, XLSX ou OFX de até 5 MB.</p>
      )}
    </div>
  );
}
