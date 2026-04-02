/** Limites centralizados (multer + validação). Sobrescrever via env em produção. */
const mb = (n: number) => n * 1024 * 1024;

export const IMPORT_MAX_FILE_BYTES = Math.min(
  50 * 1024 * 1024,
  Math.max(mb(1), Number(process.env.IMPORT_MAX_FILE_BYTES) || mb(15)),
);

export const ATTACHMENT_MAX_FILE_BYTES = Math.min(
  25 * 1024 * 1024,
  Math.max(mb(1), Number(process.env.ATTACHMENT_MAX_FILE_BYTES) || mb(10)),
);

export const ASYNC_JOB_PDF_MAX_BYTES = Math.min(
  IMPORT_MAX_FILE_BYTES,
  Math.max(mb(1), Number(process.env.ASYNC_JOB_PDF_MAX_BYTES) || mb(12)),
);
