import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { getFriendlyApiMessage } from './apiErrors';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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
