import { create } from 'zustand';
import {
  SessionProgress,
  VocabularyDeckProgress,
  FullSessionState,
} from '@/lib/types';
import { StudentCardState, VocabularyCard } from '@prisma/client';

type EnrichedStudentCardState = StudentCardState & { card: VocabularyCard };

interface LiveSessionState {
  isActionLoading: boolean;
  isPaused: boolean;
  elapsedTime: number; // in seconds
  reviewCount: number;
  encounteredCards: Set<string>;
  progress: VocabularyDeckProgress | null;

  // Actions
  startSession: (session: FullSessionState) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  endSession: () => void;
  setElapsedTime: (time: number) => void;
  incrementReviewCount: () => void;
  addEncounteredCard: (cardId: string) => void;
  setProgress: (progress: VocabularyDeckProgress) => void;
  setActionLoading: (isLoading: boolean) => void;
  reset: () => void;
}

const initialState = {
  isActionLoading: false,
  isPaused: false,
  elapsedTime: 0,
  reviewCount: 0,
  encounteredCards: new Set<string>(),
  progress: null,
};

export const useLiveSessionStore = create<LiveSessionState>((set, get) => ({
  ...initialState,

  startSession: (session) => {
    const progress = session.progress as VocabularyDeckProgress;
    set({
      progress,
      reviewCount: 0,
      encounteredCards: new Set(progress?.payload.initialCardIds || []),
      isPaused: false,
    });
  },
  pauseSession: () => set({ isPaused: true }),
  resumeSession: () => set({ isPaused: false }),
  endSession: () => set(initialState),
  setElapsedTime: (time) => set({ elapsedTime: time }),
  incrementReviewCount: () => set((state) => ({ reviewCount: state.reviewCount + 1 })),
  addEncounteredCard: (cardId) =>
    set((state) => ({
      encounteredCards: new Set(state.encounteredCards).add(cardId),
    })),
  setProgress: (progress) => set({ progress }),
  setActionLoading: (isLoading) => set({ isActionLoading: isLoading }),
  reset: () => set(initialState),
}));


