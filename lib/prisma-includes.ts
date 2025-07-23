import { Prisma } from '@prisma/client';

/**
 * A definitive, reusable Prisma `include` object for fetching a FullSessionState.
 * Using this constant ensures that all queries for a session's state are consistent
 * and always return the exact data structure required by our FullSessionState type.
 * This eliminates type errors and follows the DRY (Don't Repeat Yourself) principle.
 */
export const fullSessionStateInclude: Prisma.SessionInclude = {
  // THE FIX: Add the missing 'teacher' relation.
  teacher: true,
  student: true,
  unit: {
    include: {
      items: {
        orderBy: { order: 'asc' },
        // Include all possible exercise types for a PopulatedUnitItem.
        include: {
          vocabularyDeck: {
            include: { cards: { select: { id: true } } },
          },
          grammarExercise: true,
          listeningExercise: true,
          vocabFillInBlankExercise: true,
        },
      },
    },
  },
  currentUnitItem: {
    // Also include all possible exercise types for the current item.
    include: {
      vocabularyDeck: {
        include: { cards: { select: { id: true } } },
      },
      grammarExercise: true,
      listeningExercise: true,
      vocabFillInBlankExercise: true,
    },
  },
};
