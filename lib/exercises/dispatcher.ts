import { UnitItemType } from '@prisma/client';
import { ExerciseHandler } from './handler';
import { fsrsReviewHandler } from './fsrsReviewHandler';
import { vocabularyDeckHandler } from './vocabularyDeckHandler';
// Import other handlers here as they are created.
// import { grammarExerciseHandler } from './grammarExerciseHandler';

// A map that associates each UnitItemType with its corresponding handler instance.
// This is the heart of the dispatcher pattern.
const handlerMap: Record<UnitItemType, ExerciseHandler> = {
  [UnitItemType.FSRS_REVIEW_SESSION]: fsrsReviewHandler,
  [UnitItemType.VOCABULARY_DECK]: vocabularyDeckHandler,

  // Add other handlers here. The system will throw an error if a handler is not implemented.
  [UnitItemType.GRAMMAR_EXERCISE]: null as unknown as ExerciseHandler, // Placeholder
  [UnitItemType.LISTENING_EXERCISE]: null as unknown as ExerciseHandler, // Placeholder
  [UnitItemType.VOCAB_FILL_IN_BLANK_EXERCISE]:
    null as unknown as ExerciseHandler, // Placeholder
};

/**
 * Retrieves the appropriate ExerciseHandler for a given UnitItemType.
 *
 * @param type The UnitItemType from the current session's unit item.
 * @returns The corresponding ExerciseHandler instance.
 * @throws {Error} if no handler is registered for the given type.
 */
export function getHandler(type: UnitItemType): ExerciseHandler {
  const handler = handlerMap[type];
  if (!handler) {
    throw new Error(`No ExerciseHandler registered for type: ${type}`);
  }
  return handler;
}
