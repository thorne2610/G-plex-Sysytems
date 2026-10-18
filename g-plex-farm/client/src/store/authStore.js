import { create } from 'zustand';
import api from '../api/client.js';

export const useAuthStore = create((set, get) => ({
  user: null,
  permissions: null,
  roleLabel: '',
  isAuthenticated: false,
  isLoading: true,
  error: null,

  // Which parts of the system the signed-in user may view or change (decided by the server).
  loadAccess: async () => {
    try {
      const res = await api.get('/access/me');
      set({ permissions: res.data.permissions, roleLabel: res.data.role_label });
    } catch {
      set({ permissions: null, roleLabel: '' });
    }
  },

  checkAuth: async () => {
    try {
      set({ isLoading: true });
      const res = await api.get('/auth/me');
      if (res.success && res.data) {
        await get().loadAccess();
        set({ user: res.data, isAuthenticated: true, isLoading: false, error: null });
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  login: async (email, password) => {
    try {
      set({ isLoading: true, error: null });
      const res = await api.post('/auth/login', { email, password });
      if (res.success && res.data) {
        await get().loadAccess();
        set({ user: res.data, isAuthenticated: true, isLoading: false, error: null });
        return { success: true };
      }
      throw new Error(res.message || 'Login failed');
    } catch (err) {
      set({ isLoading: false, error: err.message });
      return { success: false, error: err.message };
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      set({ user: null, permissions: null, roleLabel: '', isAuthenticated: false, error: null });
    }
  },
}));
