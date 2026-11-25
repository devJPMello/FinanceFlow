import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User { id: string; name: string; email: string }
interface Session { accessToken: string; refreshToken: string; user: User }

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  setSession: (s: Session) => void;
  setUser: (u: User) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setSession: (s) => set({ accessToken: s.accessToken, refreshToken: s.refreshToken, user: s.user }),
      setUser: (user) => set({ user }),
      logout: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: 'financeflow-auth' },
  ),
);
