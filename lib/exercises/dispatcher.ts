import { UnitItemType } from '@prisma/client';
import { ExerciseHandler } from './handler';
import { vocabularyDeckHandler } from './vocabularyDeckHandler';
import { listeningHandler } from './listeningHandler';
// Other handlers would be imported here.

const handlerMap: Partial<Record<UnitItemType, ExerciseHandler>> = {
  // The FSRS_REVIEW_SESSION case is now gone.
  [UnitItemType.VOCABULARY_DECK]: vocabularyDeckHandler,
  [UnitItemType.LISTENING_EXERCISE]: listeningHandler,
};

export function getHandler(type: UnitItemType): ExerciseHandler {
  const handler = handlerMap[type];
  if (!handler) {
    throw new Error(
      `No ExerciseHandler is registered for the type: '${type}'.`
    );
  }
  return handler;
}
