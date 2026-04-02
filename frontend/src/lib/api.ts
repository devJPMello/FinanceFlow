import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { getFriendlyApiMessage } from './apiErrors';

const DEFAULT_DEV_API = 'http://localhost:3000';

function resolveApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL?.trim();
  const base = raw && raw.length > 0 ? raw : DEFAULT_DEV_API;
  return base.replace(/\/+$/, '');
}

const API_URL = resolveApiBaseUrl();

if (import.meta.env.PROD && API_URL === DEFAULT_DEV_API) {
  // Sem VITE_API_URL no build do Render, o browser tenta localhost → "Network Error"
  console.error(
    '[FinanceFlow] VITE_API_URL não está definida no build de produção. No Render (Static Site), defina VITE_API_URL com a URL pública da API, sem /api no fim (ex. https://financeflow-api.onrender.com) e faça um novo deploy.',
  );
}

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

export type ApiAxiosError = AxiosError & { friendlyMessage?: string };

let getClerkToken: (() => Promise<string | null>) | null = null;

/** Chamado a partir de um componente dentro do ClerkProvider (ver ClerkApiBridge). */
export function configureApiAuth(getToken: () => Promise<string | null>) {
  getClerkToken = getToken;
}

api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    if (!config.headers['X-Request-ID']) {
      config.headers['X-Request-ID'] = crypto.randomUUID();
    }
    if (getClerkToken) {
      const token = await getClerkToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const friendly = getFriendlyApiMessage(error);
    (error as ApiAxiosError).friendlyMessage = friendly;
    return Promise.reject(error);
  },
);

export default api;
