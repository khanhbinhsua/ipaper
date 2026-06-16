import { create } from 'zustand';
import { api } from '../lib/api';

interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  orgUnit: string;
  avatar: string;
  role: string;
  notifyWeb: boolean;
  notifyEmail: boolean;
  isDomainUser: boolean;
  tenantId: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  login: (username: string, password: string, tenantSlug: string) => Promise<void>;
  logout: () => void;
  updateUser: (data: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),

  login: async (username, password, tenantSlug) => {
    const { data } = await api.post('/auth/login', { username, password, tenantSlug });
    localStorage.setItem('token', data.accessToken);
    set({ user: data.user, token: data.accessToken });
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },

  updateUser: (data) =>
    set((state) => ({ user: state.user ? { ...state.user, ...data } : null })),
}));
