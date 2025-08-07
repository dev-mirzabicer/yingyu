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

// Selector to get all derived progress data, centralizing business logic.
export const useProgressData = () => {
  return useLiveSessionStore((state) => {
    const { progress, reviewCount, encounteredCards } = state;

    if (!progress || progress.type !== 'VOCABULARY_DECK') {
      return {
        totalCards: 0,
        completedCards: 0,
        remainingCards: 0,
        percentage: 0,
        currentCard: null,
        currentCardIndex: 0,
        queue: [],
        queueAnalysis: {
          totalInQueue: 0,
          newCards: 0,
          learningCards: 0,
          reviewCards: 0,
        },
        reviewsCompleted: 0,
        uniqueCardsEncountered: 0,
      };
    }

    const { queue, initialCardIds, currentCardData } = progress.payload;
    const totalCards = initialCardIds.length;
    const remainingCards = queue.length;
    const completedCards = totalCards > 0 ? totalCards - remainingCards : 0;
    const percentage = totalCards > 0 ? (completedCards / totalCards) * 100 : 0;
    const currentCardIndex = completedCards;

    const queueAnalysis = {
      totalInQueue: queue.length,
      newCards: queue.filter(c => c.state === 'NEW').length,
      learningCards: queue.filter(c => c.state === 'LEARNING' || c.state === 'RELEARNING').length,
      reviewCards: queue.filter(c => c.state === 'REVIEW').length,
    };

    return {
      totalCards,
      completedCards,
      remainingCards,
      percentage,
      currentCard: currentCardData as EnrichedStudentCardState | undefined,
      currentCardIndex,
      queue: queue as EnrichedStudentCardState[],
      queueAnalysis,
      reviewsCompleted: reviewCount,
      uniqueCardsEncountered: encounteredCards.size,
    };
  });
};
