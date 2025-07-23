import {
  FullSessionState,
  AnswerPayload,
  SubmissionResult,
  SessionProgress,
} from '@/lib/types';
import { TransactionClient } from './operators/base';

/**
 * The definitive ExerciseHandler interface (v6.0).
 * A handler is a high-level orchestrator for a specific UnitItemType. It does not
 * contain complex business logic itself. Instead, it initializes the progress state
 * and dispatches user actions to the appropriate, granular ProgressOperators.
 */
export interface ExerciseHandler {
  /**
   * Initializes the progress state for a new UnitItem. This is called by the
   * SessionService when it first encounters a new item in the lesson flow.
   *
   * @param sessionState The complete current state of the session.
   * @param tx REFINEMENT: An optional Prisma transaction client. If provided, all
   *           database operations within initialize MUST use this client to ensure
   *           the entire session state transition is atomic.
   * @returns A promise that resolves to the updated FullSessionState, which now
   *          contains the newly created 'progress' object for this UnitItem.
   */
  initialize(
    sessionState: FullSessionState,
    tx?: TransactionClient
  ): Promise<FullSessionState>;

  /**
   * Processes a user's answer by dispatching to the correct ProgressOperator.
   * This method is now a pure state-transition function. It does NOT write to the
   * database; instead, it returns the new progress state to the SessionService.
   *
   * @param sessionState The complete current state of the session.
   * @param payload The complete AnswerPayload from the user, including the 'action'.
   * @returns A promise that resolves to a tuple: [SubmissionResult, SessionProgress].
   */
  submitAnswer(
    sessionState: FullSessionState,
    payload: AnswerPayload
  ): Promise<[SubmissionResult, SessionProgress]>;

  /**
   * Checks if the work for the current UnitItem is complete, based on its
   * internal progress state. This is called by the SessionService after each
   * action to determine if it should transition to the next UnitItem.
   *
   * @param sessionState The complete current state of the session.
   * @returns A promise that resolves to a boolean indicating completion.
   */
  isComplete(sessionState: FullSessionState): Promise<boolean>;
}
