import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuth } from '@/lib/auth-store';

/** Em dev e no Docker a API fica atrás do mesmo domínio (/api). Na Render o front é um site estático
 *  separado: defina VITE_API_URL=https://sua-api.onrender.com no build. */
const API_BASE = `${((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/+$/, '')}/api`;

export const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = useAuth.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function refreshToken(): Promise<string | null> {
  const { refreshToken, setSession, logout } = useAuth.getState();
  if (!refreshToken) return null;
  try {
    const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken });
    setSession(data);
    return data.accessToken as string;
  } catch {
    logout();
    return null;
  }
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const isAuthCall = original?.url?.startsWith('/auth/');
    if (error.response?.status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true;
      refreshing ??= refreshToken().finally(() => (refreshing = null));
      const token = await refreshing;
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);

export function errorMessage(e: unknown): string {
  const data = (e as AxiosError<{ message?: string | string[] }>)?.response?.data;
  const m = data?.message;
  if (Array.isArray(m)) return m.join('; ');
  return m ?? 'Algo deu errado. Tente novamente.';
}
