import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { User } from '@/lib/api';

type AuthState = {
  access: string | null;
  refresh: string | null;
  user: User | null;
  signIn: (data: { access: string; refresh: string; user: User }) => void;
  setAccess: (access: string) => void;
  updateUser: (patch: Partial<User>) => void;
  signOut: () => void;
};

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      access: null,
      refresh: null,
      user: null,
      signIn: ({ access, refresh, user }) => set({ access, refresh, user }),
      setAccess: (access) => set({ access }),
      updateUser: (patch) => set((s) => ({ user: s.user ? { ...s.user, ...patch } : s.user })),
      signOut: () => set({ access: null, refresh: null, user: null }),
    }),
    { name: 'rkr-auth', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
