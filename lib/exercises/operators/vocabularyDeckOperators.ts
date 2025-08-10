import {
  ProgressOperator,
  OperatorServices,
} from '@/lib/exercises/operators/base';
import {
  SubmissionResult,
  VocabularyDeckProgress,
  SessionProgress,
} from '@/lib/types';
import { StudentCardState, VocabularyCard, ReviewType } from '@prisma/client';
import { FsrsRating } from '@/lib/fsrs/engine';
import { z } from 'zod';

class RevealAnswerOperator implements ProgressOperator {
  async execute(
    currentProgress: SessionProgress
  ): Promise<[SessionProgress, SubmissionResult]> {
    if (currentProgress.type !== 'VOCABULARY_DECK')
      throw new Error('Invalid progress type.');
    if (currentProgress.stage !== 'PRESENTING_CARD')
      throw new Error('Invalid stage for revealing answer.');

    const newProgress: VocabularyDeckProgress = {
      ...currentProgress,
      stage: 'AWAITING_RATING',
    };
    const result: SubmissionResult = {
      isCorrect: true,
      feedback: 'Answer revealed.',
    };
    return [newProgress, result];
  }
}

class SubmitRatingOperator implements ProgressOperator {
  async execute(
    currentProgress: SessionProgress,
    payload: unknown,
    services: OperatorServices
  ): Promise<[SessionProgress, SubmissionResult]> {
    if (currentProgress.type !== 'VOCABULARY_DECK')
      throw new Error('Invalid progress type.');
    if (currentProgress.stage !== 'AWAITING_RATING')
      throw new Error('Cannot submit rating now.');

    const validation = z
      .object({ rating: z.number().min(1).max(4) })
      .safeParse(payload);
    if (!validation.success)
      throw new Error(`Invalid payload: ${validation.error.message}`);
    const { rating } = validation.data;

    const currentQueueItem = currentProgress.payload.queue[0];
    if (!currentQueueItem)
      throw new Error('Cannot submit rating for an empty queue.');

    await services.fsrsService.recordReview(
      services.studentId,
      currentQueueItem.cardId,
      rating as FsrsRating,
      ReviewType.VOCABULARY,
      services.sessionId // Pass the sessionId
    );

    // FIXED: Query all cards from the current deck, not just initialCardIds
    // This allows truly dynamic queue expansion during the session
    const currentDeckId = currentProgress.payload.config.deckId;
    
    // DEBUG: Verify deck-based querying is working
    console.log('Session Queue Rebuild:', {
      deckId: currentDeckId,
      studentId: services.studentId.substring(0, 8)
    });
    
    let cardStatesQuery;
    if (currentDeckId) {
      // If we have a specific deck ID, query only that deck
      cardStatesQuery = services.tx.studentCardState.findMany({
        where: {
          studentId: services.studentId,
          card: { deckId: currentDeckId },
        },
        include: { card: true },
      });
    } else {
      // Fallback: use initial card IDs (preserves existing behavior for mixed units)
      cardStatesQuery = services.tx.studentCardState.findMany({
        where: {
          studentId: services.studentId,
          cardId: { in: currentProgress.payload.initialCardIds },
        },
        include: { card: true },
      });
    }

    const allSessionStates = await cardStatesQuery;

    // DEBUG: Log query results
    console.log('Query results DEBUG:', {
      foundStates: allSessionStates.length,
      stateDetails: allSessionStates.map(s => ({
        cardId: s.cardId.substring(0, 8),
        due: s.due,
        state: s.state,
        isDueNow: s.due <= new Date()
      }))
    });

    // Build the new queue with all due cards (new cards + review cards)
    const now = new Date();
    
    // DEBUG: Check timezone handling
    console.log('TIMEZONE DEBUG:', {
      serverTime: now.toISOString(),
      serverTimeUTC: now.getTime(),
      serverTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      firstRelearningDue: allSessionStates.find(s => s.state === 'RELEARNING')?.due?.toISOString(),
      timeDiffMinutes: allSessionStates.find(s => s.state === 'RELEARNING') 
        ? Math.round((allSessionStates.find(s => s.state === 'RELEARNING')!.due.getTime() - now.getTime()) / (1000 * 60))
        : 'no relearning cards'
    });
    // Build the new queue with simple state-based isNew classification
    const newQueue = allSessionStates
      .filter((state) => state.due <= now)
      .sort((a, b) => a.due.getTime() - b.due.getTime());

    // DEBUG: Log the final queue
    console.log('Final queue DEBUG:', {
      totalFound: allSessionStates.length,
      queueLength: newQueue.length,
      newCards: newQueue.filter(q => q.state === 'NEW').length,
      reviewCards: newQueue.filter(q => q.state !== 'NEW').length
    });

    const newProgress: VocabularyDeckProgress = {
      ...currentProgress,
      stage: 'PRESENTING_CARD',
      payload: {
        ...currentProgress.payload,
        queue: newQueue,
        currentCardData: newQueue.length > 0 ? newQueue[0] : undefined,
      },
    };

    const result: SubmissionResult = {
      isCorrect: true,
      feedback: 'Review recorded.',
    };
    return [newProgress, result];
  }
}

export const revealAnswerOperator = new RevealAnswerOperator();
export const submitRatingOperator = new SubmitRatingOperator();

