import { create } from 'zustand';
import {
  SessionProgress,
  VocabularyDeckProgress,
  FullSessionState,
} from '@/lib/types';
import { StudentCardState, VocabularyCard } from '@prisma/client';

type EnrichedStudentCardState = StudentCardState & { card: VocabularyCard };

interface LiveSessionState {
  sessionId: string | null;
  isActionLoading: boolean;
  isPaused: boolean;
  elapsedTime: number; // in seconds
  reviewCount: number;
  encounteredCards: Set<string>;
  progress: VocabularyDeckProgress | null;

  // Actions
  initializeSession: (session: FullSessionState) => void;
  updateProgress: (progress: VocabularyDeckProgress) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  setElapsedTime: (time: number) => void;
  incrementReviewCount: () => void;
  setProgress: (progress: VocabularyDeckProgress) => void;
  setActionLoading: (isLoading: boolean) => void;
  reset: () => void;
}

const initialState = {
  sessionId: null,
  isActionLoading: false,
  isPaused: false,
  elapsedTime: 0,
  reviewCount: 0,
  encounteredCards: new Set<string>(),
  progress: null,
};

export const useLiveSessionStore = create<LiveSessionState>((set, get) => ({
  ...initialState,

  initializeSession: (session) => {
    const progress = session.progress as VocabularyDeckProgress;
    set({
      sessionId: session.id,
      progress,
      reviewCount: 0,
      encounteredCards: new Set<string>(),
      isPaused: false,
      elapsedTime: session.startTime ? Math.floor((new Date().getTime() - new Date(session.startTime).getTime()) / 1000) : 0,
    });
  },

  updateProgress: (progress) => {
    set({ progress });
  },
  
  pauseSession: () => set({ isPaused: true }),
  resumeSession: () => set({ isPaused: false }),
  setElapsedTime: (time) => set({ elapsedTime: time }),
  
  incrementReviewCount: () =>
    set((state) => {
      const currentCardId = state.progress?.payload?.currentCardData?.cardId;
      if (currentCardId) {
        const newEncounteredCards = new Set(state.encounteredCards);
        newEncounteredCards.add(currentCardId);
        return {
          reviewCount: state.reviewCount + 1,
          encounteredCards: newEncounteredCards,
        };
      }
      return { reviewCount: state.reviewCount + 1 };
    }),

  setProgress: (progress) => set({ progress }),
  setActionLoading: (isLoading) => set({ isActionLoading: isLoading }),
  reset: () => set(initialState),
}));


