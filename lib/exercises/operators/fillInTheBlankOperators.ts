import { ProgressOperator, OperatorServices } from './base';
import { SessionProgress, SubmissionResult, FillInTheBlankProgress } from '@/lib/types';
import { z } from 'zod';

/**
 * Operator for revealing the answer in a Fill in the Blank exercise.
 * This transitions the session from 'PRESENTING_CARD' to 'AWAITING_CORRECTNESS' stage.
 */
class RevealAnswerOperator implements ProgressOperator {
  async execute(currentProgress: SessionProgress): Promise<[SessionProgress, SubmissionResult]> {
    if (currentProgress.type !== 'FILL_IN_THE_BLANK_EXERCISE') {
      throw new Error('Invalid progress type for RevealAnswerOperator.');
    }
    
    const newProgress: FillInTheBlankProgress = {
      ...currentProgress,
      stage: 'AWAITING_CORRECTNESS',
    };

    return [newProgress, { isCorrect: true, feedback: 'Answer revealed.' }];
  }
}

/**
 * Operator for submitting the correctness rating (Correct/Incorrect) for a Fill in the Blank card.
 * This is the core logic of the Fill in the Blank exercise - cards answered correctly are
 * marked as done forever, cards answered incorrectly go to the back of the queue.
 */
class SubmitCorrectnessOperator implements ProgressOperator {
  async execute(
    currentProgress: SessionProgress,
    payload: unknown,
    services: OperatorServices
  ): Promise<[SessionProgress, SubmissionResult]> {
    if (currentProgress.type !== 'FILL_IN_THE_BLANK_EXERCISE') {
      throw new Error('Invalid progress type for SubmitCorrectnessOperator.');
    }
    
    // Validate the payload - expecting { isCorrect: boolean }
    const validatedPayload = z.object({ 
      isCorrect: z.boolean() 
    }).parse(payload);
    
    const { queue } = currentProgress.payload;
    if (queue.length === 0) {
      throw new Error('Queue is empty - cannot submit correctness.');
    }

    const [currentCard, ...restOfQueue] = queue;
    let newQueue = restOfQueue;

    if (validatedPayload.isCorrect) {
      // Mark the card as permanently done for this student
      await services.tx.studentFillInTheBlankCardDone.create({
        data: { 
          studentId: services.studentId, 
          cardId: currentCard.id 
        },
      });
      
      // Card is removed from queue (already in restOfQueue)
    } else {
      // Add the card to the back of the queue for another attempt
      newQueue.push(currentCard);
    }

    // Create the new progress state
    const newProgress: FillInTheBlankProgress = {
      ...currentProgress,
      stage: 'PRESENTING_CARD', // Back to presenting the next card
      payload: {
        ...currentProgress.payload,
        queue: newQueue,
        currentCardData: newQueue.length > 0 ? newQueue[0] : undefined,
      },
    };

    const feedback = validatedPayload.isCorrect 
      ? 'Correct! Card completed.' 
      : 'Incorrect. Card added back to queue.';

    return [newProgress, { 
      isCorrect: validatedPayload.isCorrect, 
      feedback 
    }];
  }
}

// Export the operators
export const revealAnswerOperator = new RevealAnswerOperator();
export const submitCorrectnessOperator = new SubmitCorrectnessOperator();