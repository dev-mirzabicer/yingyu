import {
  ProgressOperator,
  OperatorServices,
} from '@/lib/exercises/operators/base';
import {
  SubmissionResult,
  FillInBlankExerciseProgress,
  SessionProgress,
} from '@/lib/types';
import { z } from 'zod';

/**
 * Helper function to fetch vocabulary card data for the current card.
 * Used when setting currentCardData for the next card in the queue.
 */
async function fetchCardData(cardId: string, tx: any) {
  const card = await tx.vocabularyCard.findUnique({
    where: { id: cardId },
    select: {
      id: true,
      englishWord: true,
      chineseTranslation: true,
      pinyin: true,
    },
  });
  
  if (!card) {
    throw new Error(`Card with ID ${cardId} not found.`);
  }
  
  return {
    cardId: card.id,
    englishWord: card.englishWord,
    chineseTranslation: card.chineseTranslation,
    pinyin: card.pinyin,
  };
}

/**
 * Handles the SUBMIT_STUDENT_ANSWER action.
 * Transitions from SHOWING_QUESTION to SHOWING_ANSWER stage.
 * Stores the student's typed answer in the progress state.
 */
class SubmitStudentAnswerOperator implements ProgressOperator {
  async execute(
    currentProgress: SessionProgress,
    payload: unknown
  ): Promise<[SessionProgress, SubmissionResult]> {
    // Validate progress type and stage
    if (currentProgress.type !== 'FILL_IN_BLANK_EXERCISE') {
      throw new Error('Invalid progress type for fill-in-blank exercise.');
    }
    if (currentProgress.stage !== 'SHOWING_QUESTION') {
      throw new Error('Cannot submit student answer in current stage.');
    }

    // Validate payload
    const validation = z.object({ answer: z.string() }).safeParse(payload);
    if (!validation.success) {
      throw new Error(`Invalid payload: ${validation.error.message}`);
    }
    const { answer } = validation.data;

    // Create new progress state with the student's answer
    const newProgress: FillInBlankExerciseProgress = {
      ...currentProgress,
      stage: 'SHOWING_ANSWER',
      payload: {
        ...currentProgress.payload,
        studentAnswer: answer,
      },
    };

    const result: SubmissionResult = {
      isCorrect: false, // Not determined yet
      feedback: 'Answer submitted. Teacher can now reveal the correct answer.',
    };

    return [newProgress, result];
  }
}

/**
 * Handles the REVEAL_ANSWER action for fill-in-blank exercises.
 * Transitions from SHOWING_ANSWER to AWAITING_TEACHER_JUDGMENT stage.
 * This is a simple state transition with no database operations.
 */
class RevealAnswerOperator implements ProgressOperator {
  async execute(
    currentProgress: SessionProgress
  ): Promise<[SessionProgress, SubmissionResult]> {
    // Validate progress type and stage
    if (currentProgress.type !== 'FILL_IN_BLANK_EXERCISE') {
      throw new Error('Invalid progress type for fill-in-blank exercise.');
    }
    if (currentProgress.stage !== 'SHOWING_ANSWER') {
      throw new Error('Cannot reveal answer in current stage.');
    }

    // Create new progress state
    const newProgress: FillInBlankExerciseProgress = {
      ...currentProgress,
      stage: 'AWAITING_TEACHER_JUDGMENT',
    };

    const result: SubmissionResult = {
      isCorrect: true,
      feedback: 'Answer revealed. Teacher can now mark as correct or incorrect.',
    };

    return [newProgress, result];
  }
}

/**
 * Handles the MARK_CORRECT action.
 * Marks the card as seen forever and removes it from the queue.
 * Advances to the next card or completes the exercise if queue is empty.
 */
class MarkCorrectOperator implements ProgressOperator {
  async execute(
    currentProgress: SessionProgress,
    payload: unknown,
    services: OperatorServices
  ): Promise<[SessionProgress, SubmissionResult]> {
    // Validate progress type and stage
    if (currentProgress.type !== 'FILL_IN_BLANK_EXERCISE') {
      throw new Error('Invalid progress type for fill-in-blank exercise.');
    }
    if (currentProgress.stage !== 'AWAITING_TEACHER_JUDGMENT') {
      throw new Error('Cannot mark correct in current stage.');
    }

    // Ensure there's a current card
    const currentQueue = currentProgress.payload.queue;
    if (currentQueue.length === 0) {
      throw new Error('Cannot mark correct for an empty queue.');
    }

    const currentCardId = currentQueue[0].cardId;

    // Mark the card as seen (correct) in the database
    await services.tx.fillInBlankCardState.upsert({
      where: {
        studentId_cardId: {
          studentId: services.studentId,
          cardId: currentCardId,
        },
      },
      update: {
        isSeen: true,
        completedAt: new Date(),
        lastResult: true, // true = correct
      },
      create: {
        studentId: services.studentId,
        cardId: currentCardId,
        isSeen: true,
        completedAt: new Date(),
        lastResult: true, // true = correct
      },
    });

    // Remove the current card from the queue (it's been marked as seen)
    const newQueue = currentQueue.slice(1);
    
    // Get the next card data if there are more cards
    let nextCardData = null;
    if (newQueue.length > 0) {
      nextCardData = await fetchCardData(newQueue[0].cardId, services.tx);
    }

    // Create new progress state
    const newProgress: FillInBlankExerciseProgress = {
      ...currentProgress,
      stage: 'SHOWING_QUESTION', // Return to showing question for next card
      payload: {
        ...currentProgress.payload,
        queue: newQueue,
        currentCardData: nextCardData,
        studentAnswer: undefined, // Clear previous answer
      },
    };

    const result: SubmissionResult = {
      isCorrect: true,
      feedback: newQueue.length > 0 
        ? 'Marked correct! Moving to next card.' 
        : 'Marked correct! Exercise completed.',
    };

    return [newProgress, result];
  }
}

/**
 * Handles the MARK_INCORRECT action.
 * Moves the current card to the end of the queue to be retried later.
 * Advances to the next card in the queue.
 */
class MarkIncorrectOperator implements ProgressOperator {
  async execute(
    currentProgress: SessionProgress,
    payload: unknown,
    services: OperatorServices
  ): Promise<[SessionProgress, SubmissionResult]> {
    // Validate progress type and stage
    if (currentProgress.type !== 'FILL_IN_BLANK_EXERCISE') {
      throw new Error('Invalid progress type for fill-in-blank exercise.');
    }
    if (currentProgress.stage !== 'AWAITING_TEACHER_JUDGMENT') {
      throw new Error('Cannot mark incorrect in current stage.');
    }

    // Ensure there's a current card
    const currentQueue = currentProgress.payload.queue;
    if (currentQueue.length === 0) {
      throw new Error('Cannot mark incorrect for an empty queue.');
    }

    // Optional: Record the incorrect attempt in the database
    const currentCardId = currentQueue[0].cardId;
    await services.tx.fillInBlankCardState.upsert({
      where: {
        studentId_cardId: {
          studentId: services.studentId,
          cardId: currentCardId,
        },
      },
      update: {
        lastResult: false, // false = incorrect
      },
      create: {
        studentId: services.studentId,
        cardId: currentCardId,
        isSeen: false, // Not seen yet since it was incorrect
        lastResult: false, // false = incorrect
      },
    });

    // Move the current card to the end of the queue
    const currentCard = currentQueue[0];
    const newQueue = [...currentQueue.slice(1), currentCard];
    
    // Get the next card data
    let nextCardData = null;
    if (newQueue.length > 0) {
      nextCardData = await fetchCardData(newQueue[0].cardId, services.tx);
    }

    // Create new progress state
    const newProgress: FillInBlankExerciseProgress = {
      ...currentProgress,
      stage: 'SHOWING_QUESTION', // Return to showing question for next card
      payload: {
        ...currentProgress.payload,
        queue: newQueue,
        currentCardData: nextCardData,
        studentAnswer: undefined, // Clear previous answer
      },
    };

    const result: SubmissionResult = {
      isCorrect: false,
      feedback: newQueue.length > 0 
        ? 'Marked incorrect. Card moved to end of queue for retry.' 
        : 'Marked incorrect. No more cards available.',
    };

    return [newProgress, result];
  }
}

// Export all operators
export const submitStudentAnswerOperator = new SubmitStudentAnswerOperator();
export const revealAnswerOperator = new RevealAnswerOperator();
export const markCorrectOperator = new MarkCorrectOperator();
export const markIncorrectOperator = new MarkIncorrectOperator();