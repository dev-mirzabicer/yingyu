import { create } from 'zustand';
import {
  FullSessionState,
  SessionProgress,
} from '@/lib/types';

interface LiveSessionState {
  sessionId: string | null;
  isActionLoading: boolean;
  isPaused: boolean;
  elapsedTime: number; // in seconds
  reviewCount: number;
  encounteredCards: Set<string>;
  progress: SessionProgress | null;

  // Actions
  initializeSession: (session: FullSessionState) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  setElapsedTime: (time: number) => void;
  incrementReviewCount: () => void;
  setProgress: (progress: SessionProgress) => void;
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
    const progress = session.progress as SessionProgress;
    set({
      sessionId: session.id,
      progress,
      reviewCount: 0,
      encounteredCards: new Set<string>(),
      isPaused: false,
      elapsedTime: session.startTime ? Math.floor((new Date().getTime() - new Date(session.startTime).getTime()) / 1000) : 0,
    });
  },
  
  pauseSession: () => set({ isPaused: true }),
  resumeSession: () => set({ isPaused: false }),
  setElapsedTime: (time) => set({ elapsedTime: time }),
  
  incrementReviewCount: () =>
    set((state) => {
      const currentCardData = state.progress?.payload?.currentCardData;
      const currentCardId = currentCardData && ('cardId' in currentCardData ? currentCardData.cardId : currentCardData.id);
      if (currentCardId) {
        const newEncounteredCards = new Set(state.encounteredCards);
        newEncounteredCards.add(String(currentCardId));
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