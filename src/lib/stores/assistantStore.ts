import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AssistantContextSnapshot,
  AssistantUIMode,
  Message,
  PageContext,
  ExperienceLevel,
} from '@/types/assistant';

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
  conversationScope: Partial<
    Pick<AssistantContextSnapshot, 'symbol' | 'symbols' | 'filters' | 'timeframe'>
  > | null;

  // Actions
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
  setContext: (context: PageContext) => void;
  setLoading: (loading: boolean) => void;
  setExperienceLevel: (level: ExperienceLevel) => void;
  setConversationScope: (
    scope: Partial<Pick<AssistantContextSnapshot, 'symbol' | 'symbols' | 'filters' | 'timeframe'>> | null
  ) => void;
  clearConversationScope: () => void;
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
      conversationScope: null,

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

      clearMessages: () => set({ messages: [], conversationScope: null }),

      setContext: (context) => set({ currentContext: context }),

      setLoading: (loading) => set({ isLoading: loading }),

      setExperienceLevel: (level) => set({ experienceLevel: level }),
      setConversationScope: (scope) => set({ conversationScope: scope ? { ...scope } : null }),
      clearConversationScope: () => set({ conversationScope: null }),
      setUIMode: (mode) => set({ uiMode: mode }),
    }),
    {
      name: 'quantvn-assistant',
      partialize: (state) => ({
        messages: state.messages.slice(-MAX_PERSISTED_MESSAGES).map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          // Serialize Date to ISO string for localStorage persistence
          timestamp: message.timestamp instanceof Date ? message.timestamp.toISOString() : message.timestamp,
          grounded: message.grounded,
          policyStatus: message.policyStatus,
          policyReason: message.policyReason,
          dataConfidence: message.dataConfidence,
        })),
        experienceLevel: state.experienceLevel,
        uiMode: state.uiMode,
      }),
      // Rehydrate timestamp strings back to Date objects
      onRehydrateStorage: () => (state) => {
        if (!state?.messages) return;
        state.messages = state.messages.map((message) => ({
          ...message,
          timestamp: typeof message.timestamp === 'string' ? new Date(message.timestamp) : message.timestamp,
        }));
      },
    }
  )
);

// Helper hook to get messages for API
export const useConversationHistory = () => {
  const messages = useAssistantStore((state) => state.messages);
  return messages.slice(-10); // Last 10 messages for context
};
