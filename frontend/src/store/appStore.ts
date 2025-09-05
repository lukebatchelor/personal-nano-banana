import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Session } from '../types';

interface AppState {
  currentSession: Session | null;
  isGenerating: boolean;
  activeBatchId: number | null;
  
  // Actions
  setCurrentSession: (session: Session | null) => void;
  setIsGenerating: (generating: boolean) => void;
  setActiveBatchId: (batchId: number | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentSession: null,
      isGenerating: false,
      activeBatchId: null,
      
      setCurrentSession: (session) => set({ currentSession: session }),
      setIsGenerating: (generating) => set({ isGenerating: generating }),
      setActiveBatchId: (batchId) => set({ activeBatchId: batchId }),
    }),
    {
      name: 'nano-banana-app',
      partialize: (state) => ({
        currentSession: state.currentSession,
      }),
    }
  )
);