import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Message, PageContext, ExperienceLevel } from '@/types/assistant';

interface AssistantState {
  // State
  isOpen: boolean;
  isLoading: boolean;
  messages: Message[];
  currentContext: PageContext | null;
  experienceLevel: ExperienceLevel;

  // Actions
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
  setContext: (context: PageContext) => void;
  setLoading: (loading: boolean) => void;
  setExperienceLevel: (level: ExperienceLevel) => void;
}

export const useAssistantStore = create<AssistantState>()(
  persist(
    (set) => ({
      // Initial state
      isOpen: false,
      isLoading: false,
      messages: [],
      currentContext: null,
      experienceLevel: 'intermediate',

      // Actions
      togglePanel: () => set((state) => ({ isOpen: !state.isOpen })),
      openPanel: () => set({ isOpen: true }),
      closePanel: () => set({ isOpen: false }),

      addMessage: (message) =>
        set((state) => ({
          messages: [
            ...state.messages,
            {
              ...message,
              id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
              timestamp: new Date(),
            },
          ],
        })),

      clearMessages: () => set({ messages: [] }),

      setContext: (context) => set({ currentContext: context }),

      setLoading: (loading) => set({ isLoading: loading }),

      setExperienceLevel: (level) => set({ experienceLevel: level }),
    }),
    {
      name: 'quantvn-assistant',
      partialize: (state) => ({
        messages: state.messages.slice(-50), // Keep last 50 messages
        experienceLevel: state.experienceLevel,
      }),
    }
  )
);

// Helper hook to get messages for API
export const useConversationHistory = () => {
  const messages = useAssistantStore((state) => state.messages);
  return messages.slice(-10); // Last 10 messages for context
};
