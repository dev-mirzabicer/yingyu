import { UnitItemType } from '@prisma/client';
import { ExerciseHandler } from './handler';
import { vocabularyDeckHandler } from './vocabularyDeckHandler';
import { listeningExerciseHandler } from './listeningExerciseHandler';
import { fillInTheBlankHandler } from './fillInTheBlankHandler';
import { genericDeckHandler } from './genericDeckHandler';
// Other handlers would be imported here.

const handlerMap: Partial<Record<UnitItemType, ExerciseHandler>> = {
  [UnitItemType.VOCABULARY_DECK]: vocabularyDeckHandler,
  [UnitItemType.LISTENING_EXERCISE]: listeningExerciseHandler,
  [UnitItemType.FILL_IN_THE_BLANK_EXERCISE]: fillInTheBlankHandler,
  [UnitItemType.GENERIC_DECK]: genericDeckHandler,
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
