import { SessionProgress, AnswerPayload, SubmissionResult } from '@/lib/types';
import { FSRSService } from '@/lib/actions/fsrs';
import { AppPrismaClient } from '@/lib/db';

/**
 * A type alias for our application's specific Prisma transactional client.
 * By deriving this from our exported AppPrismaClient, we ensure it includes
 * all extensions and has the exact type signature required.
 */
export type TransactionClient = Omit<
  AppPrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * A service bundle passed to each operator, providing access to necessary
 * application services and the database transaction context. This ensures
 * operators have the tools they need while remaining decoupled.
 */
export interface OperatorServices {
  /**
   * A Prisma transaction client. All database operations within an operator
   * MUST use this client to ensure the entire operation is atomic.
   */
  tx: TransactionClient;
  /**
   * The FSRS service for any spaced repetition calculations.
   */
  fsrsService: typeof FSRSService;
  /**
   * The ID of the student for whom the operation is being performed.
   */
  studentId: string;
}

/**
 * The ProgressOperator interface (v6.0).
 * This is the contract for the most granular piece of business logic in an exercise.
 * Each operator is responsible for a single, atomic state transition within a
 * UnitItem's progress. For example, revealing an answer or grading a submission.
 */
export interface ProgressOperator {
  /**
   * Executes a single, atomic state transition for an exercise.
   *
   * @param currentProgress The current progress state object from the active Session.
   * @param payload The validated data from the user's AnswerPayload.
   * @param services An object containing necessary services and the Prisma transaction client.
   * @returns A promise that resolves to a tuple containing:
   *          1. The *new* progress state object. The operator should return a new
   *             object and not mutate the input directly to adhere to functional principles.
   *          2. A SubmissionResult for UI feedback.
   */
  execute(
    currentProgress: SessionProgress,
    payload: AnswerPayload['data'],
    services: OperatorServices
  ): Promise<[SessionProgress, SubmissionResult]>;
}
