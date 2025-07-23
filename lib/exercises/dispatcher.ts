import { UnitItemType } from '@prisma/client';
import { ExerciseHandler } from './handler';
// import { fsrsReviewHandler } from './fsrsReviewHandler';
import { vocabularyDeckHandler } from './vocabularyDeckHandler';
// Import other handlers here as they are created.
// import { grammarExerciseHandler } from './grammarExerciseHandler';

// A map that associates each UnitItemType with its corresponding handler instance.
// This is the heart of the dispatcher pattern.
const handlerMap: Partial<Record<UnitItemType, ExerciseHandler>> = {
  //   [UnitItemType.FSRS_REVIEW_SESSION]: fsrsReviewHandler,
  [UnitItemType.VOCABULARY_DECK]: vocabularyDeckHandler,

  // Unimplemented handlers are now simply omitted from the map.
};

/**
 * Retrieves the appropriate ExerciseHandler for a given UnitItemType.
 *
 * @param type The UnitItemType from the current session's unit item.
 * @returns The corresponding ExerciseHandler instance.
 * @throws {Error} if no handler is registered for the given type. This is a critical
 *         safeguard against runtime errors from unimplemented features.
 */
export function getHandler(type: UnitItemType): ExerciseHandler {
  const handler = handlerMap[type];

  // Check: If no handler is found, we throw an explicit, informative error.
  // This prevents the system from crashing with a vague 'null pointer' exception.
  if (!handler) {
    throw new Error(
      `No ExerciseHandler is registered for the type: '${type}'.`
    );
  }

  return handler;
}
