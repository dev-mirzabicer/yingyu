import { FullSessionState, AnswerPayload } from '@/lib/types';

/**
 * Defines the result of an answer submission.
 * This provides a structured way to give feedback to the frontend.
 */
export interface SubmissionResult {
  isCorrect: boolean;
  correctAnswer?: unknown; // e.g., the correct spelling or the full sentence
  feedback?: string; // e.g., "Good job!" or an explanation of the rule
}

/**
 * Defines the data required to render an exercise on the frontend.
 * This is prepared by the handler and passed along with the session state.
 */
export interface DisplayData {
  type: 'FSRS_REVIEW' | 'VOCABULARY_CARD' | 'GRAMMAR_FILL_IN_BLANK';
  payload: unknown; // e.g., an array of due cards, a single vocabulary card, or a sentence template
}

/**
 * The ExerciseHandler interface.
 * Every module that manages a specific exercise type (UnitItemType) MUST implement this interface.
 * This contract is the key to our modular and scalable session architecture.
 */
export interface ExerciseHandler {
  /**
   * Prepares the initial data needed for the frontend to display the current exercise.
   * This is called when the session transitions to a new UnitItem.
   *
   * @param sessionState The complete current state of the session.
   * @returns A promise that resolves to the DisplayData for the exercise.
   */
  getDisplayData(sessionState: FullSessionState): Promise<DisplayData>;

  /**
   * Processes a user's answer for the exercise.
   * This method contains the core logic for grading and handling a submission.
   *
   * @param sessionState The complete current state of the session.
   * @param payload The answer data submitted from the frontend.
   * @returns A promise that resolves to a SubmissionResult.
   */
  submitAnswer(
    sessionState: FullSessionState,
    payload: AnswerPayload
  ): Promise<SubmissionResult>;
}
