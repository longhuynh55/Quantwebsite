import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AssistantUIMode, Message, PageContext, ExperienceLevel } from '@/types/assistant';

const MAX_IN_MEMORY_MESSAGES = 50;
const MAX_PERSISTED_MESSAGES = 25;

interface AssistantState {
  // State
  isOpen: boolean;
  isLoading: boolean;
  messages: Message[];
  currentContext: PageContext | null;
  experienceLevel: ExperienceLevel;
  uiMode: AssistantUIMode;

  // Actions
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
  setContext: (context: PageContext) => void;
  setLoading: (loading: boolean) => void;
  setExperienceLevel: (level: ExperienceLevel) => void;
  setUIMode: (mode: AssistantUIMode) => void;
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
      uiMode: 'copilot',

      // Actions
      togglePanel: () => set((state) => ({ isOpen: !state.isOpen })),
      openPanel: () => set({ isOpen: true }),
      closePanel: () => set({ isOpen: false }),

      addMessage: (message) =>
        set((state) => {
          const nextMessage: Message = {
            ...message,
            id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
            timestamp: new Date(),
          };
          const boundedMessages = [...state.messages, nextMessage].slice(-MAX_IN_MEMORY_MESSAGES);
          return {
            messages: boundedMessages,
          };
        }),

      clearMessages: () => set({ messages: [] }),

      setContext: (context) => set({ currentContext: context }),

      setLoading: (loading) => set({ isLoading: loading }),

      setExperienceLevel: (level) => set({ experienceLevel: level }),
      setUIMode: (mode) => set({ uiMode: mode }),
    }),
    {
      name: 'quantvn-assistant',
      partialize: (state) => ({
        messages: state.messages.slice(-MAX_PERSISTED_MESSAGES).map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          timestamp: message.timestamp,
          grounded: message.grounded,
          policyStatus: message.policyStatus,
          policyReason: message.policyReason,
          dataConfidence: message.dataConfidence,
        })),
        experienceLevel: state.experienceLevel,
        uiMode: state.uiMode,
      }),
    }
  )
);

// Helper hook to get messages for API
export const useConversationHistory = () => {
  const messages = useAssistantStore((state) => state.messages);
  return messages.slice(-10); // Last 10 messages for context
};
