import type { AxiosError } from 'axios';

/** Mensagem legível para utilizador (PT), a partir de erros Axios ou desconhecidos. */
export function getFriendlyApiMessage(error: unknown): string {
  const ax = error as AxiosError<{
    message?: string | string[];
    requestId?: string;
  }>;
  const status = ax.response?.status;
  const body = ax.response?.data;
  const raw = body?.message ?? ax.message;

  if (raw) {
    if (Array.isArray(raw)) {
      const joined = raw.map(String).filter(Boolean).join(' · ');
      if (joined.length > 0) return joined;
    }
    if (typeof raw === 'string') {
      if (status === 400 && raw.length > 280) {
        return 'Dados inválidos. Verifique os campos e tente novamente.';
      }
      return raw;
    }
  }

  if (ax.code === 'ECONNABORTED') {
    return 'O pedido demorou demasiado. Tente novamente.';
  }
  if (!ax.response) {
    return 'Sem ligação ao servidor. Verifique a rede e tente de novo.';
  }

  switch (status) {
    case 401:
      return 'Sessão expirada ou inválida. Inicie sessão novamente.';
    case 403:
      return 'Não tem permissão para esta ação.';
    case 404:
      return 'Recurso não encontrado.';
    case 413:
      return 'Ficheiro demasiado grande para o servidor.';
    case 429:
      return 'Muitos pedidos. Aguarde um momento e tente de novo.';
    case 502:
    case 503:
      return 'Serviço temporariamente indisponível. Tente dentro de instantes.';
    default:
      return 'Ocorreu um erro. Se persistir, contacte o suporte.';
  }
}

export function getApiErrorWithRequestId(error: unknown): string {
  const ax = error as AxiosError<{ requestId?: string }>;
  const friendly = getFriendlyApiMessage(error);
  const rid = ax.response?.data?.requestId;
  if (rid) return `${friendly} (ref: ${rid})`;
  return friendly;
}
