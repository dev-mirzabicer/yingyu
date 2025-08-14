import { UnitItemType } from '@prisma/client';
import { ExerciseHandler } from './handler';
import { vocabularyDeckHandler } from './vocabularyDeckHandler';
import { listeningExerciseHandler } from './listeningExerciseHandler';
// Other handlers would be imported here.

const handlerMap: Partial<Record<UnitItemType, ExerciseHandler>> = {
  [UnitItemType.VOCABULARY_DECK]: vocabularyDeckHandler,
  [UnitItemType.LISTENING_EXERCISE]: listeningExerciseHandler,
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
