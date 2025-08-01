import { prisma } from '@/lib/db';
import {
  FullUnit,
  NewUnitItemData,
  VocabularyExerciseConfig,
} from '@/lib/types';
import {
  Unit,
  UnitItem,
  UnitItemType,
  VocabularyDeck,
  GrammarExercise,
  ListeningExercise,
  VocabFillInBlankExercise,
  Prisma,
  VocabularyCard,
} from '@prisma/client';
import { AuthorizationError } from '../auth';
import { VocabularyExerciseConfigSchema } from '../schemas';

type Exercise =
  | VocabularyDeck
  | GrammarExercise
  | ListeningExercise
  | VocabFillInBlankExercise;

/**
 * Service responsible for managing the global repository of all learning materials.
 * It encapsulates all business logic for the content lifecycle, including creation,
 * forking (copy-on-edit), and archiving.
 */
export const ContentService = {
  /**
   * Retrieves a single, fully populated Unit by its ID.
   * The global Prisma extension ensures this does not return archived content.
   * This is the primary method for fetching a complete lesson plan with all its exercises
   * in the correct order.
   *
   * @param unitId The UUID of the unit to retrieve.
   * @returns A promise that resolves to a FullUnit object or null if not found.
   */
  async getUnitWithDetails(unitId: string): Promise<FullUnit | null> {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: {
        items: {
          orderBy: { order: 'asc' },
          include: {
            vocabularyDeck: true,
            grammarExercise: true,
            listeningExercise: true,
            vocabFillInBlankExercise: true,
          },
        },
      },
    });
    return unit as FullUnit | null;
  },

  /**
   * Retrieves all units for a given teacher.
   * 
   * @param teacherId The UUID of the teacher.
   * @returns A promise that resolves to an array of units created by the teacher.
   */
  async getUnitsForTeacher(teacherId: string): Promise<Unit[]> {
    return prisma.unit.findMany({
      where: {
        creatorId: teacherId,
        isArchived: false
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Retrieves all vocabulary decks for a given teacher.
   * 
   * @param teacherId The UUID of the teacher.
   * @returns A promise that resolves to an array of vocabulary decks created by the teacher.
   */
  async getDecksForTeacher(teacherId: string): Promise<VocabularyDeck[]> {
    return prisma.vocabularyDeck.findMany({
      where: {
        creatorId: teacherId,
        isArchived: false
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Creates a new, empty Unit (a lesson plan).
   *
   * @param data An object containing the necessary data to create the unit.
   * @returns A promise that resolves to the newly created Unit object.
   */
  async createUnit(data: {
    creatorId: string;
    name: string;
    description?: string;
    tags?: string[];
    isPublic?: boolean;
  }): Promise<Unit> {
    return prisma.unit.create({ data });
  },

  /**
   * Adds a new exercise to a specified Unit. This is a critical atomic operation.
   * It uses a transaction to first create the exercise entity (e.g., a GrammarExercise)
   * and then create the UnitItem that links it to the parent Unit. If any step fails,
   * the entire operation is rolled back, preventing orphaned data.
   *
   * @param unitId The UUID of the unit to add the item to.
   * @param creatorId The ID of the teacher creating this content.
   * @param itemData An object containing the type of exercise and its data.
   * @returns A promise that resolves to the newly created UnitItem.
   */
  async updateUnit(
    unitId: string,
    creatorId: string,
    updateData: Prisma.UnitUpdateInput
  ): Promise<Unit> {
    const unit = await prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit || unit.creatorId !== creatorId) {
      throw new AuthorizationError('Unit not found or you cannot edit it.');
    }

    if (updateData.isPublic === true) {
      const items = await prisma.unitItem.findMany({
        where: { unitId },
        include: {
          vocabularyDeck: { select: { isPublic: true } },
          grammarExercise: { select: { isPublic: true } },
          listeningExercise: { select: { isPublic: true } },
          vocabFillInBlankExercise: { select: { isPublic: true } },
        },
      });

      for (const item of items) {
        const exercise =
          item.vocabularyDeck ||
          item.grammarExercise ||
          item.listeningExercise ||
          item.vocabFillInBlankExercise;
        if (exercise && !exercise.isPublic) {
          throw new AuthorizationError(
            `Cannot make unit public. It contains a private exercise of type '${item.type}'.`
          );
        }
      }
    }

    return prisma.unit.update({ where: { id: unitId }, data: updateData });
  },

  async addExerciseToUnit(
    unitId: string,
    creatorId: string,
    itemData: NewUnitItemData
  ): Promise<UnitItem> {
    const targetUnit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { isPublic: true },
    });

    if (!targetUnit) {
      throw new Error(`Unit with ID ${unitId} not found.`);
    }

    if (targetUnit.isPublic && !itemData.data.isPublic) {
      throw new AuthorizationError(
        'Cannot add a private exercise to a public unit. Please make the exercise public first.'
      );
    }

    return prisma.$transaction(async (tx) => {
      const lastItem = await tx.unitItem.findFirst({
        where: { unitId: unitId },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      const newOrder = (lastItem?.order ?? -1) + 1;

      let newUnitItem: UnitItem;
      switch (itemData.type) {
        case 'VOCABULARY_DECK': {
          const deck = await tx.vocabularyDeck.create({
            data: { ...itemData.data, creatorId },
          });
          newUnitItem = await tx.unitItem.create({
            data: {
              unitId,
              order: newOrder,
              type: 'VOCABULARY_DECK',
              vocabularyDeckId: deck.id,
            },
          });
          break;
        }
        case 'GRAMMAR_EXERCISE': {
          const exercise = await tx.grammarExercise.create({
            data: { ...itemData.data, creatorId },
          });
          newUnitItem = await tx.unitItem.create({
            data: {
              unitId,
              order: newOrder,
              type: 'GRAMMAR_EXERCISE',
              grammarExerciseId: exercise.id,
            },
          });
          break;
        }
        default:
          throw new Error('Invalid exercise type provided.');
      }
      return newUnitItem;
    });
  },

  /**
   * Creates a private, editable copy of a public exercise for a specific teacher.
   * This is the core of the "Fork-on-Edit" pattern.
   *
   * @param exerciseType The type of the exercise to fork.
   * @param exerciseId The UUID of the public exercise to fork.
   * @param newCreatorId The UUID of the teacher who is forking the exercise.
   * @returns A promise that resolves to the newly created private exercise.
   */
  async addCardToDeck(
    deckId: string,
    teacherId: string,
    cardData: Omit<Prisma.VocabularyCardCreateInput, 'deck'>
  ): Promise<VocabularyCard> {
    const deck = await prisma.vocabularyDeck.findUnique({
      where: { id: deckId },
      select: { creatorId: true },
    });

    if (!deck) {
      throw new Error(`Deck with ID ${deckId} not found.`);
    }

    if (deck.creatorId !== teacherId) {
      throw new AuthorizationError(
        'You are not authorized to add cards to this deck.'
      );
    }

    return prisma.vocabularyCard.create({
      data: {
        ...cardData,
        deck: {
          connect: { id: deckId },
        },
      },
    });
  },

  async forkExercise(
    exerciseType: UnitItemType,
    exerciseId: string,
    newCreatorId: string
  ): Promise<Exercise> {
    // The entire forking process must be atomic.
    return prisma.$transaction(async (tx) => {
      const findAndCopy = async (
        model:
          | 'vocabularyDeck'
          | 'grammarExercise'
          | 'listeningExercise'
          | 'vocabFillInBlankExercise',
        id: string
      ) => {
        const original = await (tx as any)[model].findUnique({
          where: { id, isArchived: false },
          include: model === 'vocabularyDeck' ? { cards: true } : undefined,
        });

        if (!original)
          throw new Error('Original exercise not found or is archived.');
        if (!original.isPublic)
          throw new Error('Only public exercises can be forked.');

        const {
          id: _,
          creatorId,
          isPublic,
          originExerciseId,
          createdAt,
          updatedAt,
          cards, // Exclude cards from the shallow copy
          ...dataToCopy
        } = original;

        // Create the new forked exercise
        const newExercise = await (tx as any)[model].create({
          data: {
            ...dataToCopy,
            name: `${original.name} (Copy)`, // Append (Copy) to the name
            creatorId: newCreatorId,
            isPublic: false, // Forks are always private
            originExerciseId: original.id,
          },
        });

        // **Meticulous Deep Copy for Vocabulary Decks**
        if (model === 'vocabularyDeck' && cards && cards.length > 0) {
          const cardsToCreate = cards.map((card: VocabularyCard) => {
            const { id: _cId, deckId: _dId, ...cardData } = card;
            return {
              ...cardData,
              deckId: newExercise.id, // Link to the new forked deck
            };
          });
          await tx.vocabularyCard.createMany({
            data: cardsToCreate,
          });
        }

        return newExercise;
      };

      switch (exerciseType) {
        case UnitItemType.VOCABULARY_DECK:
          return findAndCopy('vocabularyDeck', exerciseId);
        case UnitItemType.GRAMMAR_EXERCISE:
          return findAndCopy('grammarExercise', exerciseId);
        case UnitItemType.LISTENING_EXERCISE:
          return findAndCopy('listeningExercise', exerciseId);
        case UnitItemType.VOCAB_FILL_IN_BLANK_EXERCISE:
          return findAndCopy('vocabFillInBlankExercise', exerciseId);
        default:
          throw new Error(`Forking not supported for type: ${exerciseType}`);
      }
    });
  },

  /**
   * Archives an exercise, soft-deleting it. Only the original creator can do this.
   *
   * @param exerciseType The type of the exercise to archive.
   * @param exerciseId The UUID of the exercise to archive.
   * @param requestingTeacherId The UUID of the teacher making the request.
   * @returns A promise that resolves to the archived exercise.
   */
  async archiveExercise(
    exerciseType: UnitItemType,
    exerciseId: string,
    requestingTeacherId: string
  ): Promise<Exercise> {
    const findAndArchive = async (
      model:
        | 'vocabularyDeck'
        | 'grammarExercise'
        | 'listeningExercise'
        | 'vocabFillInBlankExercise',
      id: string
    ) => {
      const exercise = await (prisma[model] as any).findUnique({
        where: { id },
      });

      if (!exercise) throw new Error('Exercise not found.');
      if (exercise.creatorId !== requestingTeacherId) {
        throw new AuthorizationError(
          'You can only archive your own exercises.'
        );
      }

      return (prisma[model] as any).update({
        where: { id },
        data: { isArchived: true },
      });
    };

    switch (exerciseType) {
      case UnitItemType.VOCABULARY_DECK:
        return findAndArchive('vocabularyDeck', exerciseId);
      case UnitItemType.GRAMMAR_EXERCISE:
        return findAndArchive('grammarExercise', exerciseId);
      case UnitItemType.LISTENING_EXERCISE:
        return findAndArchive('listeningExercise', exerciseId);
      case UnitItemType.VOCAB_FILL_IN_BLANK_EXERCISE:
        return findAndArchive('vocabFillInBlankExercise', exerciseId);
      default:
        throw new Error(`Archiving not supported for type: ${exerciseType}`);
    }
  },

  /**
   * Removes a UnitItem from a Unit. This only breaks the link; it does not
   * delete or archive the underlying exercise.
   *
   * @param unitItemId The UUID of the unit item to delete.
   * @returns A promise that resolves to the deleted UnitItem.
   */
  async removeUnitItem(unitItemId: string): Promise<UnitItem> {
    return prisma.unitItem.delete({
      where: { id: unitItemId },
    });
  },

  /**
   * Updates the configuration for a specific UnitItem.
   * This allows teachers to dynamically adjust session parameters like the number of new cards.
   *
   * @param unitItemId The UUID of the UnitItem to update.
   * @param teacherId The UUID of the teacher making the request for authorization.
   * @param config The new configuration object to apply.
   * @returns A promise that resolves to the updated UnitItem.
   */
  async updateUnitItemConfig(
    unitItemId: string,
    teacherId: string,
    config: VocabularyExerciseConfig
  ): Promise<UnitItem> {
    const unitItem = await prisma.unitItem.findUnique({
      where: { id: unitItemId },
      include: { unit: { select: { creatorId: true } } },
    });

    if (!unitItem || unitItem.unit.creatorId !== teacherId) {
      throw new AuthorizationError(
        'Unit item not found or you are not authorized to edit it.'
      );
    }

    const validatedConfig = VocabularyExerciseConfigSchema.parse(config);

    return prisma.unitItem.update({
      where: { id: unitItemId },
      data: { exerciseConfig: validatedConfig ?? Prisma.JsonNull },
    });
  },
};

