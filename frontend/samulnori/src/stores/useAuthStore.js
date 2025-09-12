import { create } from 'zustand';
import { persist } from 'zustand/middleware';
// useAuthStore.js
export const useAuthStore = create(persist(
  (set) => ({
    user: null,
    setUser: (user) => set({ user }), 
    clearUser: () => set({ user: null }),
  }),
  {
    name: 'auth-storage',
    getStorage: () => localStorage,
  }
));
