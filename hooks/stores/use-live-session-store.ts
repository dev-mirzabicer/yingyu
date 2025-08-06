"use client"

import { create } from "zustand"
import { FullSessionState, VocabularyDeckProgress } from "@/lib/types"

interface LiveSessionUiState {
  isActionLoading: boolean
  isPaused: boolean
  elapsedTime: number
  reviewCount: number
  encounteredCards: Set<string>
  timerInterval: NodeJS.Timeout | null
}

interface LiveSessionUiActions {
  startAction: () => void
  endAction: () => void
  togglePause: () => void
  incrementReviewCount: () => void
  addEncounteredCard: (cardId: string) => void
  setElapsedTime: (time: number) => void
  startTimer: () => void
  stopTimer: () => void
  reset: () => void
}

const initialState: LiveSessionUiState = {
  isActionLoading: false,
  isPaused: false,
  elapsedTime: 0,
  reviewCount: 0,
  encounteredCards: new Set(),
  timerInterval: null,
}

export const useLiveSessionStore = create<LiveSessionUiState & LiveSessionUiActions>((set, get) => ({
  ...initialState,

  startAction: () => set({ isActionLoading: true }),
  endAction: () => set({ isActionLoading: false }),

  togglePause: () => set((state) => ({ isPaused: !state.isPaused })),

  incrementReviewCount: () => set((state) => ({ reviewCount: state.reviewCount + 1 })),

  addEncounteredCard: (cardId: string) =>
    set((state) => ({
      encounteredCards: new Set(state.encounteredCards).add(cardId),
    })),

  setElapsedTime: (time: number) => set({ elapsedTime: time }),

  startTimer: () => {
    get().stopTimer() // Ensure no multiple timers are running
    const interval = setInterval(() => {
      set((state) => ({ elapsedTime: state.elapsedTime + 1 }))
    }, 1000)
    set({ timerInterval: interval })
  },

  stopTimer: () => {
    const { timerInterval } = get()
    if (timerInterval) {
      clearInterval(timerInterval)
      set({ timerInterval: null })
    }
  },

  reset: () => set(initialState),
}))

/**
 * A selector-based hook to get progress data.
 * This encapsulates the complex progress calculation logic and prevents
 * unnecessary re-renders in the main component.
 */
export const useProgressData = (session: FullSessionState | undefined | null) => {
    const { reviewCount, encounteredCards } = useLiveSessionStore(state => ({
        reviewCount: state.reviewCount,
        encounteredCards: state.encounteredCards
    }));

    if (!session?.progress || !session.currentUnitItem) {
        return { 
          current: 0, 
          total: 1, 
          percentage: 0,
          reviewsCompleted: reviewCount,
          uniqueCardsEncountered: encounteredCards.size,
          queueAnalysis: { newCards: 0, learningCards: 0, reviewCards: 0, totalInQueue: 0 }
        }
    }

    if (session.progress.type === 'VOCABULARY_DECK') {
        const progress = session.progress as VocabularyDeckProgress
        const initialCardCount = progress.payload.initialCardIds.length
        const currentQueueLength = progress.payload.queue.length
        
        const newCards = progress.payload.queue.filter(item => item.state === 'NEW').length
        const learningCards = progress.payload.queue.filter(item => item.state === 'LEARNING' || item.state === 'RELEARNING').length
        const reviewCards = progress.payload.queue.filter(item => item.state === 'REVIEW').length
        
        const cardsProcessedFromQueue = Math.max(0, initialCardCount - currentQueueLength)
        const progressPercentage = initialCardCount > 0 ? (cardsProcessedFromQueue / initialCardCount) * 100 : 0

        return {
            current: cardsProcessedFromQueue,
            total: initialCardCount,
            percentage: progressPercentage,
            reviewsCompleted: reviewCount,
            uniqueCardsEncountered: encounteredCards.size,
            queueAnalysis: {
                newCards,
                learningCards,
                reviewCards,
                totalInQueue: currentQueueLength
            }
        }
    }

    const currentItemIndex = session.unit.items.findIndex(
        item => item.id === session.currentUnitItemId
    )
    const current = currentItemIndex + 1
    const total = session.unit.items.length
    const percentage = (current / total) * 100

    return { 
        current, 
        total, 
        percentage,
        reviewsCompleted: reviewCount,
        uniqueCardsEncountered: encounteredCards.size,
        queueAnalysis: { newCards: 0, learningCards: 0, reviewCards: 0, totalInQueue: 0 }
    }
}
