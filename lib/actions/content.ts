import { prisma } from '@/lib/db';
import {
  FullUnit,
  NewUnitItemData,
  VocabularyExerciseConfig,
  FillInTheBlankExerciseConfig,
} from '@/lib/types';
import {
  Unit,
  UnitItem,
  UnitItemType,
  VocabularyDeck,
  GrammarExercise,
  ListeningExercise,
  FillInTheBlankDeck,
  FillInTheBlankCard,
  GenericDeck,
  GenericCard,
  Prisma,
  VocabularyCard,
} from '@prisma/client';
import { AuthorizationError } from '../auth';
import { TransactionClient } from '@/lib/exercises/operators/base';

// ================================================================= //
// TYPE DEFINITIONS FOR CONTENT OPERATIONS
// ================================================================= //

/**
 * Interface for models that can be forked (copied with cards)
 */
interface ForkableModel {
  id: string;
  creatorId: string | null;
  isPublic: boolean;
  originExerciseId: string | null;
  createdAt: Date;
  updatedAt: Date;
  name?: string;  // for decks
  title?: string; // for exercises
  cards?: Array<ForkableCard>;
}

/**
 * Interface for cards that can be forked
 */
interface ForkableCard {
  id: string;
  deckId: string;
  // Common card properties
  createdAt?: Date;
  updatedAt?: Date;
  // Vocabulary card specific
  englishWord?: string;
  chineseTranslation?: string;
  pinyin?: string;
  ipaPronunciation?: string;
  exampleSentences?: Prisma.JsonValue;
  wordType?: string;
  difficultyLevel?: number;
  audioUrl?: string;
  imageUrl?: string;
  videoUrl?: string;
  frequencyRank?: number;
  tags?: string[];
  // Fill in the blank card specific
  sentence?: string;
  answer?: string;
  options?: string[];
  explanation?: string;
  boundVocabularyCardId?: string;
  // Generic card specific
  front?: string;
  back?: string;
}

/**
 * Interface for models that can be archived
 */
interface ArchivableModel {
  id: string;
  creatorId: string | null;
}

/**
 * Type for bulk import generic card data
 */
interface BulkImportGenericCardData {
  front: string;
  back: string;
  exampleSentences?: Prisma.JsonValue;
  audioUrl?: string;
  imageUrl?: string;
  tags?: string[];
}

/**
 * Type for bulk import generic card payload
 */
interface BulkImportGenericCardPayload {
  deckId: string;
  teacherId: string;
  cards: BulkImportGenericCardData[];
}

/**
 * Type-safe model accessor for transaction operations
 */
interface ModelOperations {
  findUnique: (args: {
    where: { id: string; isArchived?: boolean };
    include?: {
      cards?: boolean;
    };
  }) => Promise<ForkableModel | null>;
  create: (args: {
    data: Partial<ForkableModel> & {
      name?: string;
      title?: string;
      creatorId: string;
      isPublic: boolean;
      originExerciseId: string;
    };
  }) => Promise<ForkableModel>;
  update: (args: {
    where: { id: string };
    data: { isArchived: boolean };
  }) => Promise<ArchivableModel>;
}

// Note: This type may be used in future card creation utilities
// type CardCreateInput = 
//   | Prisma.VocabularyCardCreateManyInput
//   | Prisma.FillInTheBlankCardCreateManyInput
//   | Prisma.GenericCardCreateManyInput;
import {
  BulkImportVocabularyPayloadSchema,
  BulkImportFillInTheBlankPayloadSchema,
  VocabularyExerciseConfigSchema,
  FillInTheBlankExerciseConfigSchema,
} from '../schemas';
import { z } from 'zod';

type Exercise =
  | VocabularyDeck
  | GrammarExercise
  | ListeningExercise
  | FillInTheBlankDeck
  | GenericDeck;

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
            fillInTheBlankDeck: true,
            genericDeck: true,
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
      include: {
        _count: {
          select: {
            items: true,
          },
        },
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
      include: {
        _count: {
          select: {
            cards: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Retrieves all public vocabulary decks.
   * 
   * @returns A promise that resolves to an array of public vocabulary decks.
   */
  async getPublicDecks(): Promise<VocabularyDeck[]> {
    return prisma.vocabularyDeck.findMany({
      where: {
        isPublic: true,
        isArchived: false
      },
      include: {
        _count: {
          select: {
            cards: true,
          },
        },
        creator: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Retrieves all Fill in the Blank decks for a given teacher.
   * 
   * @param teacherId The UUID of the teacher.
   * @returns A promise that resolves to an array of Fill in the Blank decks created by the teacher.
   */
  async getFillInTheBlankDecksForTeacher(teacherId: string): Promise<FillInTheBlankDeck[]> {
    return prisma.fillInTheBlankDeck.findMany({
      where: {
        creatorId: teacherId,
        isArchived: false
      },
      include: {
        _count: {
          select: {
            cards: true,
          },
        },
        boundVocabularyDeck: {
          select: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Retrieves all public Fill in the Blank decks.
   * 
   * @returns A promise that resolves to an array of public Fill in the Blank decks.
   */
  async getPublicFillInTheBlankDecks(): Promise<FillInTheBlankDeck[]> {
    return prisma.fillInTheBlankDeck.findMany({
      where: {
        isPublic: true,
        isArchived: false
      },
      include: {
        _count: {
          select: {
            cards: true,
          },
        },
        creator: true,
        boundVocabularyDeck: {
          select: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Creates a new Fill in the Blank deck for a given teacher.
   * 
   * @param data An object containing the necessary data to create the deck.
   * @returns A promise that resolves to the newly created FillInTheBlankDeck object.
   */
  async createFillInTheBlankDeck(data: {
    creatorId: string;
    name: string;
    description?: string;
    isPublic?: boolean;
    boundVocabularyDeckId?: string;
  }): Promise<FillInTheBlankDeck> {
    return prisma.fillInTheBlankDeck.create({ data });
  },

  /**
   * Updates an existing Fill in the Blank deck.
   * 
   * @param deckId The UUID of the deck to update.
   * @param teacherId The UUID of the teacher making the request.
   * @param updateData The data to update.
   * @returns A promise that resolves to the updated FillInTheBlankDeck object.
   */
  async updateFillInTheBlankDeck(
    deckId: string,
    teacherId: string,
    updateData: Partial<Pick<FillInTheBlankDeck, 'name' | 'description' | 'isPublic' | 'boundVocabularyDeckId'>>
  ): Promise<FillInTheBlankDeck> {
    const deck = await prisma.fillInTheBlankDeck.findUnique({
      where: { id: deckId },
      select: { creatorId: true },
    });

    if (!deck || deck.creatorId !== teacherId) {
      throw new AuthorizationError('Deck not found or you cannot edit it.');
    }

    return prisma.fillInTheBlankDeck.update({
      where: { id: deckId },
      data: updateData,
    });
  },

  /**
   * Creates a new vocabulary deck for a given teacher.
   * 
   * @param data An object containing the necessary data to create the deck.
   * @returns A promise that resolves to the newly created VocabularyDeck object.
   */
  async createDeck(data: {
    creatorId: string;
    name: string;
    description?: string;
    isPublic?: boolean;
  }): Promise<VocabularyDeck> {
    return prisma.vocabularyDeck.create({ data });
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
  async createUnit(data: {
    creatorId: string;
    name: string;
    description?: string;
    tags?: string[];
    isPublic?: boolean;
  }): Promise<Unit> {
    const unit = await prisma.unit.create({ data });
    await this._calculateUnitDuration(unit.id);
    return unit;
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
        },
      });

      for (const item of items) {
        const exercise =
          item.vocabularyDeck ||
          item.grammarExercise ||
          item.listeningExercise;
        if (exercise && !exercise.isPublic) {
          throw new AuthorizationError(
            `Cannot make unit public. It contains a private exercise of type '${item.type}'.`
          );
        }
      }
    }

    const updatedUnit = await prisma.unit.update({ where: { id: unitId }, data: updateData });
    await this._calculateUnitDuration(updatedUnit.id);
    return updatedUnit;
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

    if (targetUnit.isPublic && 'data' in itemData && itemData.data && !itemData.data.isPublic) {
      throw new AuthorizationError(
        'Cannot add a private exercise to a public unit. Please make the exercise public first.'
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const lastItem = await tx.unitItem.findFirst({
        where: { unitId: unitId },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      const newOrder = (lastItem?.order ?? -1) + 1;

      let newUnitItem: UnitItem;
      switch (itemData.type) {
        case 'VOCABULARY_DECK': {
          let deckId: string;

          if (itemData.mode === 'existing') {
            // Link existing deck
            const existingDeck = await tx.vocabularyDeck.findUnique({
              where: { id: itemData.existingDeckId },
              select: { id: true, creatorId: true, isPublic: true },
            });

            if (!existingDeck) {
              throw new Error('Selected deck not found.');
            }

            // Check if the teacher has access to this deck
            if (!existingDeck.isPublic && existingDeck.creatorId !== creatorId) {
              throw new AuthorizationError('You do not have permission to use this deck.');
            }

            deckId = existingDeck.id;
          } else {
            // Create new deck
            const deck = await tx.vocabularyDeck.create({
              data: { ...itemData.data, creatorId },
            });
            deckId = deck.id;
          }

          newUnitItem = await tx.unitItem.create({
            data: {
              unitId,
              order: newOrder,
              type: 'VOCABULARY_DECK',
              vocabularyDeckId: deckId,
              exerciseConfig: itemData.config || Prisma.JsonNull,
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
              exerciseConfig: itemData.config || Prisma.JsonNull,
            },
          });
          break;
        }
        case 'LISTENING_EXERCISE': {
          // Listening exercises are deck-based and must reference an existing vocabulary deck
          const existingDeck = await tx.vocabularyDeck.findUnique({
            where: { id: itemData.existingDeckId },
            select: { id: true, creatorId: true, isPublic: true },
          });

          if (!existingDeck) {
            throw new Error('Selected vocabulary deck not found.');
          }

          // Check if the teacher has access to this deck
          if (!existingDeck.isPublic && existingDeck.creatorId !== creatorId) {
            throw new AuthorizationError('You do not have permission to use this deck.');
          }

          // Create listening exercise referencing the vocabulary deck
          const exercise = await tx.listeningExercise.create({
            data: { 
              ...itemData.data, 
              vocabularyDeckId: existingDeck.id,
              creatorId 
            },
          });

          // Ensure config has deckId for the listening exercise
          const listeningConfig = {
            ...itemData.config,
            deckId: existingDeck.id
          };

          newUnitItem = await tx.unitItem.create({
            data: {
              unitId,
              order: newOrder,
              type: 'LISTENING_EXERCISE',
              listeningExerciseId: exercise.id,
              exerciseConfig: listeningConfig || Prisma.JsonNull,
            },
          });
          break;
        }
        case 'FILL_IN_THE_BLANK_EXERCISE': {
          // Fill in the Blank exercises must reference an existing deck
          const existingDeck = await tx.fillInTheBlankDeck.findUnique({
            where: { id: itemData.existingDeckId },
            select: { id: true, creatorId: true, isPublic: true },
          });

          if (!existingDeck) {
            throw new Error('Selected Fill in the Blank deck not found.');
          }

          // Check if the teacher has access to this deck
          if (!existingDeck.isPublic && existingDeck.creatorId !== creatorId) {
            throw new AuthorizationError('You do not have permission to use this deck.');
          }

          newUnitItem = await tx.unitItem.create({
            data: {
              unitId,
              order: newOrder,
              type: 'FILL_IN_THE_BLANK_EXERCISE',
              fillInTheBlankDeckId: existingDeck.id,
              exerciseConfig: itemData.config || Prisma.JsonNull,
            },
          });
          break;
        }
        case 'GENERIC_DECK': {
          let deckId: string;

          if (itemData.mode === 'existing') {
            // Link existing deck
            const existingDeck = await tx.genericDeck.findUnique({
              where: { id: itemData.existingDeckId },
              select: { id: true, creatorId: true, isPublic: true },
            });

            if (!existingDeck) {
              throw new Error('Selected generic deck not found.');
            }

            // Check if the teacher has access to this deck
            if (!existingDeck.isPublic && existingDeck.creatorId !== creatorId) {
              throw new AuthorizationError('You do not have permission to use this generic deck.');
            }

            deckId = existingDeck.id;
          } else {
            // Create new deck
            const newDeck = await tx.genericDeck.create({
              data: { ...itemData.data, creatorId },
            });
            deckId = newDeck.id;
          }

          newUnitItem = await tx.unitItem.create({
            data: {
              unitId,
              order: newOrder,
              type: 'GENERIC_DECK',
              genericDeckId: deckId,
              exerciseConfig: itemData.config || Prisma.JsonNull,
            },
          });
          break;
        }
        default:
          throw new Error('Invalid exercise type provided.');
      }
      return newUnitItem;
    });
    await this._calculateUnitDuration(unitId);
    return result;
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
          | 'fillInTheBlankDeck'
          | 'genericDeck',
        id: string
      ) => {
        const modelOps = (tx as unknown as Record<string, ModelOperations>)[model];
        const original = await modelOps.findUnique({
          where: { id, isArchived: false },
          include: (model === 'vocabularyDeck' || model === 'fillInTheBlankDeck' || model === 'genericDeck') ? { cards: true } : undefined,
        });

        if (!original)
          throw new Error('Original exercise not found or is archived.');
        if (!original.isPublic)
          throw new Error('Only public exercises can be forked.');

        const {
          cards, // Exclude cards from the shallow copy
          ...dataToCopy
        } = original;
        
        // Remove system fields that should not be copied
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _id, creatorId: _creatorId, isPublic: _isPublic, originExerciseId: _originExerciseId, createdAt: _createdAt, updatedAt: _updatedAt, ...cleanDataToCopy } = dataToCopy;

        // Create the new forked exercise
        const modelOpsForCreate = (tx as unknown as Record<string, ModelOperations>)[model];
        const newExercise = await modelOpsForCreate.create({
          data: {
            ...cleanDataToCopy,
            name: `${original.name || original.title} (Copy)`, // Append (Copy) to the name
            creatorId: newCreatorId,
            isPublic: false, // Forks are always private
            originExerciseId: original.id,
          },
        });

        // **Meticulous Deep Copy for Vocabulary Decks and Fill in the Blank Decks**
        if (model === 'vocabularyDeck' && cards && cards.length > 0) {
          const vocabularyCards = cards as VocabularyCard[];
          const cardsToCreate = vocabularyCards.map((card): Prisma.VocabularyCardCreateManyInput => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id: _id, deckId: _deckId, ...cardData } = card;
            return {
              ...cardData,
              deckId: newExercise.id, // Link to the new forked deck
              exampleSentences: cardData.exampleSentences as Prisma.InputJsonValue,
            };
          });
          await tx.vocabularyCard.createMany({
            data: cardsToCreate,
          });
        }
        
        if (model === 'fillInTheBlankDeck' && cards && cards.length > 0) {
          const fillInTheBlankCards = cards as FillInTheBlankCard[];
          const cardsToCreate = fillInTheBlankCards.map((card): Prisma.FillInTheBlankCardCreateManyInput => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id: _id, deckId: _deckId, ...cardData } = card;
            return {
              ...cardData,
              deckId: newExercise.id, // Link to the new forked deck
              options: cardData.options as Prisma.InputJsonValue,
            };
          });
          await tx.fillInTheBlankCard.createMany({
            data: cardsToCreate,
          });
        }

        return newExercise as Exercise;
      };

      switch (exerciseType) {
        case UnitItemType.VOCABULARY_DECK:
          return findAndCopy('vocabularyDeck', exerciseId);
        case UnitItemType.GRAMMAR_EXERCISE:
          return findAndCopy('grammarExercise', exerciseId);
        case UnitItemType.LISTENING_EXERCISE:
          return findAndCopy('listeningExercise', exerciseId);
        case UnitItemType.FILL_IN_THE_BLANK_EXERCISE:
          return findAndCopy('fillInTheBlankDeck', exerciseId);
        case UnitItemType.GENERIC_DECK:
          return findAndCopy('genericDeck', exerciseId);
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
        | 'fillInTheBlankDeck'
        | 'genericDeck',
      id: string
    ) => {
      const modelOps = (prisma as unknown as Record<string, ModelOperations>)[model];
      const exercise = await modelOps.findUnique({
        where: { id },
      }) as ArchivableModel | null;

      if (!exercise) throw new Error('Exercise not found.');
      if (exercise.creatorId !== requestingTeacherId) {
        throw new AuthorizationError(
          'You can only archive your own exercises.'
        );
      }

      const modelOpsForUpdate = (prisma as unknown as Record<string, ModelOperations>)[model];
      return modelOpsForUpdate.update({
        where: { id },
        data: { isArchived: true },
      }) as Promise<Exercise>;
    };

    switch (exerciseType) {
      case UnitItemType.VOCABULARY_DECK:
        return findAndArchive('vocabularyDeck', exerciseId);
      case UnitItemType.GRAMMAR_EXERCISE:
        return findAndArchive('grammarExercise', exerciseId);
      case UnitItemType.LISTENING_EXERCISE:
        return findAndArchive('listeningExercise', exerciseId);
      case UnitItemType.FILL_IN_THE_BLANK_EXERCISE:
        return findAndArchive('fillInTheBlankDeck', exerciseId);
      case UnitItemType.GENERIC_DECK:
        return findAndArchive('genericDeck', exerciseId);
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
    const unitItem = await prisma.unitItem.findUnique({ where: { id: unitItemId } });
    if (!unitItem) {
      throw new Error('Unit item not found.');
    }
    const result = await prisma.unitItem.delete({
      where: { id: unitItemId },
    });
    await this._calculateUnitDuration(unitItem.unitId);
    return result;
  },

  /**
   * Reorders the items within a unit based on a provided list of item IDs.
   *
   * @param unitId The UUID of the unit to reorder.
   * @param teacherId The UUID of the teacher making the request for authorization.
   * @param itemIds An array of UnitItem UUIDs in the desired new order.
   * @returns A promise that resolves when the reordering is complete.
   */
  async reorderUnitItems(
    unitId: string,
    teacherId: string,
    itemIds: string[]
  ): Promise<void> {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { creatorId: true, items: { select: { id: true } } },
    });

    if (!unit || unit.creatorId !== teacherId) {
      throw new AuthorizationError(
        'Unit not found or you are not authorized to edit it.'
      );
    }

    const currentItemIds = new Set(unit.items.map(item => item.id));
    const providedItemIds = new Set(itemIds);

    if (currentItemIds.size !== providedItemIds.size || !itemIds.every(id => currentItemIds.has(id))) {
      throw new Error("Provided item IDs do not match the unit's current items.");
    }

    await prisma.$transaction(
      itemIds.map((itemId, index) =>
        prisma.unitItem.update({
          where: { id: itemId },
          data: { order: index },
        })
      )
    );
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
    config: VocabularyExerciseConfig | FillInTheBlankExerciseConfig
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

    // Validate config based on exercise type
    let validatedConfig;
    if (unitItem.type === 'FILL_IN_THE_BLANK_EXERCISE') {
      validatedConfig = FillInTheBlankExerciseConfigSchema.parse(config);
    } else {
      validatedConfig = VocabularyExerciseConfigSchema.parse(config);
    }

    const updatedUnitItem = await prisma.unitItem.update({
      where: { id: unitItemId },
      data: { exerciseConfig: validatedConfig ?? Prisma.JsonNull },
    });
    await this._calculateUnitDuration(updatedUnitItem.unitId);
    return updatedUnitItem;
  },

  /**
   * Internal method to bulk add vocabulary cards to a deck.
   * This method is called by the worker and is not exposed through the API.
   *
   * @param payload The payload from the job, containing the deckId and cards.
   * @returns A promise that resolves to an object with the count of created cards.
   */
  async _bulkAddVocabularyCards(
    payload: z.infer<typeof BulkImportVocabularyPayloadSchema>
  ) {
    const { deckId, cards } = payload;

    const cardsToCreate = cards.map((card) => ({
      ...card,
      tags: card.tags ? card.tags.split(',').map(t => t.trim()) : [],
      deckId,
    }));

    const result = await prisma.vocabularyCard.createMany({
      data: cardsToCreate,
      skipDuplicates: true,
    });

    return { createdCount: result.count };
  },

  /**
   * [INTERNAL] Calculates and updates the estimated duration for a unit.
   *
   * @param unitId The UUID of the unit to calculate.
   */
  async _calculateUnitDuration(unitId: string) {
    const unitWithItems = await prisma.unit.findUnique({
      where: { id: unitId },
      include: {
        items: {
          include: {
            vocabularyDeck: {
              include: {
                _count: {
                  select: {
                    cards: true,
                  },
                },
              },
            },
            fillInTheBlankDeck: {
              include: {
                _count: {
                  select: {
                    cards: true,
                  },
                },
              },
            },
            genericDeck: {
              include: {
                _count: {
                  select: {
                    cards: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!unitWithItems) {
      return;
    }

    let minDuration = 0;
    let maxDuration = 0;

    for (const item of unitWithItems.items) {
      switch (item.type) {
        case 'VOCABULARY_DECK':
          const cardCount = item.vocabularyDeck?._count?.cards || 0;
          minDuration += Math.ceil(cardCount * 0.5); // 30s per card
          maxDuration += cardCount; // 1m per card
          break;
        case 'LISTENING_EXERCISE':
          minDuration += 5;
          maxDuration += 10;
          break;
        case 'GRAMMAR_EXERCISE':
          minDuration += 10;
          maxDuration += 20;
          break;
        case 'FILL_IN_THE_BLANK_EXERCISE':
          // Similar to vocabulary but slightly longer per card for reading and thinking
          const fibCardCount = item.fillInTheBlankDeck?._count?.cards || 0;
          minDuration += Math.ceil(fibCardCount * 0.75); // 45s per card
          maxDuration += Math.ceil(fibCardCount * 1.5); // 1.5m per card
          break;
        case 'GENERIC_DECK':
          // Similar timing to vocabulary deck
          const genericCardCount = item.genericDeck?._count?.cards || 0;
          minDuration += Math.ceil(genericCardCount * 0.5); // 30s per card
          maxDuration += genericCardCount; // 1m per card
          break;
        default:
          break;
      }
    }

    await prisma.unit.update({
      where: { id: unitId },
      data: {
        estimatedMinimumDuration: minDuration,
        estimatedMaximumDuration: maxDuration,
      },
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

  async updateCard(
    cardId: string,
    deckId: string,
    teacherId: string,
    cardData: Partial<Omit<Prisma.VocabularyCardUpdateInput, 'deck'>>
  ): Promise<VocabularyCard> {
    return prisma.$transaction(async (tx) => {
      // First verify the card exists and belongs to the specified deck
      const card = await tx.vocabularyCard.findUnique({
        where: { id: cardId },
        include: { deck: { select: { creatorId: true, id: true } } },
      });

      if (!card) {
        throw new Error(`Card with ID ${cardId} not found.`);
      }

      if (card.deck.id !== deckId) {
        throw new Error(`Card does not belong to deck ${deckId}.`);
      }

      if (card.deck.creatorId !== teacherId) {
        throw new AuthorizationError(
          'You are not authorized to update cards in this deck.'
        );
      }

      // Check if listening-relevant fields are being changed
      const hasListeningRelevantChanges = !!(
        cardData.audioUrl !== undefined ||
        cardData.englishWord !== undefined ||
        cardData.chineseTranslation !== undefined ||
        cardData.pinyin !== undefined
      );

      // Update the card
      const updatedCard = await tx.vocabularyCard.update({
        where: { id: cardId },
        data: cardData,
      });

      // Handle listening exercise sync if relevant fields changed
      if (hasListeningRelevantChanges) {
        await this._syncListeningStatesAfterCardUpdate(tx, cardId, card, updatedCard);
      }

      return updatedCard;
    });
  },

  async deleteCard(
    cardId: string,
    deckId: string,
    teacherId: string
  ): Promise<void> {
    return prisma.$transaction(async (tx) => {
      // First verify the card exists and belongs to the specified deck
      const card = await tx.vocabularyCard.findUnique({
        where: { id: cardId },
        include: { deck: { select: { creatorId: true, id: true } } },
      });

      if (!card) {
        throw new Error(`Card with ID ${cardId} not found.`);
      }

      if (card.deck.id !== deckId) {
        throw new Error(`Card does not belong to deck ${deckId}.`);
      }

      if (card.deck.creatorId !== teacherId) {
        throw new AuthorizationError(
          'You are not authorized to delete cards from this deck.'
        );
      }

      // Clean up related listening states before deleting the card
      const deletedListeningStates = await tx.listeningCardState.deleteMany({
        where: { cardId }
      });

      // Clean up listening review history
      await tx.reviewHistory.deleteMany({
        where: { 
          cardId,
          reviewType: 'LISTENING'
        }
      });

      if (deletedListeningStates.count > 0) {
        console.log(`Cleaned up ${deletedListeningStates.count} listening card states for deleted card ${cardId}`);
      }

      // Finally delete the card (this will be a soft-delete due to the Prisma extension)
      await tx.vocabularyCard.delete({
        where: { id: cardId },
      });
    });
  },

  /**
   * Adds a new Fill in the Blank card to a specified deck.
   */
  async addCardToFillInTheBlankDeck(
    deckId: string,
    teacherId: string,
    cardData: Omit<Prisma.FillInTheBlankCardCreateInput, 'deck'>
  ): Promise<FillInTheBlankCard> {
    const deck = await prisma.fillInTheBlankDeck.findUnique({
      where: { id: deckId },
      select: { creatorId: true },
    });

    if (!deck) {
      throw new Error(`Fill in the Blank deck with ID ${deckId} not found.`);
    }

    if (deck.creatorId !== teacherId) {
      throw new AuthorizationError(
        'You are not authorized to add cards to this deck.'
      );
    }

    return prisma.fillInTheBlankCard.create({
      data: {
        ...cardData,
        deck: {
          connect: { id: deckId },
        },
      },
    });
  },

  /**
   * Updates an existing Fill in the Blank card.
   */
  async updateFillInTheBlankCard(
    cardId: string,
    deckId: string,
    teacherId: string,
    cardData: Partial<Omit<Prisma.FillInTheBlankCardUpdateInput, 'deck'>>
  ): Promise<FillInTheBlankCard> {
    return prisma.$transaction(async (tx) => {
      // First verify the card exists and belongs to the specified deck
      const card = await tx.fillInTheBlankCard.findUnique({
        where: { id: cardId },
        include: { deck: { select: { creatorId: true, id: true } } },
      });

      if (!card) {
        throw new Error(`Fill in the Blank card with ID ${cardId} not found.`);
      }

      if (card.deck.id !== deckId) {
        throw new Error(`Card does not belong to deck ${deckId}.`);
      }

      if (card.deck.creatorId !== teacherId) {
        throw new AuthorizationError(
          'You are not authorized to update cards in this deck.'
        );
      }

      // Update the card
      return tx.fillInTheBlankCard.update({
        where: { id: cardId },
        data: cardData,
      });
    });
  },

  /**
   * Deletes a Fill in the Blank card.
   */
  async deleteFillInTheBlankCard(
    cardId: string,
    deckId: string,
    teacherId: string
  ): Promise<void> {
    return prisma.$transaction(async (tx) => {
      // First verify the card exists and belongs to the specified deck
      const card = await tx.fillInTheBlankCard.findUnique({
        where: { id: cardId },
        include: { deck: { select: { creatorId: true, id: true } } },
      });

      if (!card) {
        throw new Error(`Fill in the Blank card with ID ${cardId} not found.`);
      }

      if (card.deck.id !== deckId) {
        throw new Error(`Card does not belong to deck ${deckId}.`);
      }

      if (card.deck.creatorId !== teacherId) {
        throw new AuthorizationError(
          'You are not authorized to delete cards from this deck.'
        );
      }

      // Clean up related "done" records before deleting the card
      await tx.studentFillInTheBlankCardDone.deleteMany({
        where: { cardId }
      });

      // Finally delete the card (this will be a soft-delete due to the Prisma extension)
      await tx.fillInTheBlankCard.delete({
        where: { id: cardId },
      });
    });
  },

  /**
   * Bulk import method for Fill in the Blank cards.
   */
  async _bulkAddFillInTheBlankCards(
    payload: z.infer<typeof BulkImportFillInTheBlankPayloadSchema>
  ) {
    const { deckId, cards } = payload;

    const cardsToCreate = cards.map((card) => ({
      ...card,
      options: card.options ? card.options.split(',').map(o => o.trim()).filter(o => o) : undefined,
      deckId,
    }));

    const result = await prisma.fillInTheBlankCard.createMany({
      data: cardsToCreate,
      skipDuplicates: true,
    });

    return { createdCount: result.count };
  },

  /**
   * Auto-binds Fill in the Blank cards to vocabulary cards in the bound vocabulary deck.
   * This is a sophisticated matching system that attempts to match the answers of Fill in the Blank
   * cards with the English words in the vocabulary deck.
   * 
   * @param deckId The UUID of the Fill in the Blank deck to process.
   * @param teacherId The UUID of the teacher making the request.
   * @returns An object containing matches, ambiguities, and unmatched cards.
   */
  async autoBindVocabulary(deckId: string, teacherId: string): Promise<{
    matches: Array<{
      fillInTheBlankCardId: string;
      fillInTheBlankAnswer: string;
      vocabularyCardId: string;
      vocabularyWord: string;
    }>;
    ambiguities: Array<{
      fillInTheBlankCardId: string;
      fillInTheBlankAnswer: string;
      possibleMatches: Array<{
        vocabularyCardId: string;
        vocabularyWord: string;
      }>;
    }>;
    noMatch: Array<{
      fillInTheBlankCardId: string;
      fillInTheBlankAnswer: string;
    }>;
  }> {
    // 1. Authorize teacher owns the deck
    const deck = await prisma.fillInTheBlankDeck.findUnique({
      where: { id: deckId },
      select: { 
        creatorId: true, 
        boundVocabularyDeckId: true,
        cards: { 
          select: { 
            id: true, 
            answer: true, 
            boundVocabularyCardId: true 
          } 
        } 
      },
    });

    if (!deck || deck.creatorId !== teacherId) {
      throw new AuthorizationError('Fill in the Blank deck not found or you cannot edit it.');
    }

    if (!deck.boundVocabularyDeckId) {
      throw new Error('This deck is not bound to a vocabulary deck. Please bind it first.');
    }

    // 2. Get the vocabulary cards from the bound deck
    const vocabularyCards = await prisma.vocabularyCard.findMany({
      where: { deckId: deck.boundVocabularyDeckId },
      select: { id: true, englishWord: true },
    });

    // 3. Create a map of englishWord -> VocabularyCard[]
    const vocabMap = new Map<string, Array<{ id: string; englishWord: string }>>();
    vocabularyCards.forEach((card) => {
      const normalizedWord = card.englishWord.toLowerCase().trim();
      if (!vocabMap.has(normalizedWord)) {
        vocabMap.set(normalizedWord, []);
      }
      vocabMap.get(normalizedWord)!.push({
        id: card.id,
        englishWord: card.englishWord,
      });
    });

    // 4. Process each Fill in the Blank card
    const matches: Array<{
      fillInTheBlankCardId: string;
      fillInTheBlankAnswer: string;
      vocabularyCardId: string;
      vocabularyWord: string;
    }> = [];
    const ambiguities: Array<{
      fillInTheBlankCardId: string;
      fillInTheBlankAnswer: string;
      possibleMatches: Array<{
        vocabularyCardId: string;
        vocabularyWord: string;
      }>;
    }> = [];
    const noMatch: Array<{
      fillInTheBlankCardId: string;
      fillInTheBlankAnswer: string;
    }> = [];

    // Track cards that will be updated automatically
    const autoUpdates: Array<{ cardId: string; vocabularyCardId: string }> = [];

    for (const fibCard of deck.cards) {
      const normalizedAnswer = fibCard.answer.toLowerCase().trim();
      const possibleMatches = vocabMap.get(normalizedAnswer) || [];

      if (possibleMatches.length === 1) {
        // Perfect match - can be auto-bound
        const match = possibleMatches[0];
        matches.push({
          fillInTheBlankCardId: fibCard.id,
          fillInTheBlankAnswer: fibCard.answer,
          vocabularyCardId: match.id,
          vocabularyWord: match.englishWord,
        });
        autoUpdates.push({
          cardId: fibCard.id,
          vocabularyCardId: match.id,
        });
      } else if (possibleMatches.length > 1) {
        // Multiple matches - ambiguous, requires teacher input
        ambiguities.push({
          fillInTheBlankCardId: fibCard.id,
          fillInTheBlankAnswer: fibCard.answer,
          possibleMatches: possibleMatches.map(m => ({
            vocabularyCardId: m.id,
            vocabularyWord: m.englishWord,
          })),
        });
      } else {
        // No match found
        noMatch.push({
          fillInTheBlankCardId: fibCard.id,
          fillInTheBlankAnswer: fibCard.answer,
        });
      }
    }

    // 5. Apply automatic updates for perfect matches
    if (autoUpdates.length > 0) {
      await prisma.$transaction(
        autoUpdates.map(({ cardId, vocabularyCardId }) =>
          prisma.fillInTheBlankCard.update({
            where: { id: cardId },
            data: { boundVocabularyCardId: vocabularyCardId },
          })
        )
      );
    }

    return { matches, ambiguities, noMatch };
  },

  /**
   * Resolves vocabulary binding ambiguities by applying teacher selections.
   * 
   * @param deckId The UUID of the Fill in the Blank deck.
   * @param teacherId The UUID of the teacher making the request.
   * @param resolutions Array of resolutions for ambiguous cards.
   */
  async resolveVocabularyBindingAmbiguities(
    deckId: string,
    teacherId: string,
    resolutions: Array<{
      fillInTheBlankCardId: string;
      vocabularyCardId: string | null; // null means don't bind this card
    }>
  ): Promise<void> {
    // 1. Authorize teacher owns the deck
    const deck = await prisma.fillInTheBlankDeck.findUnique({
      where: { id: deckId },
      select: { creatorId: true },
    });

    if (!deck || deck.creatorId !== teacherId) {
      throw new AuthorizationError('Fill in the Blank deck not found or you cannot edit it.');
    }

    // 2. Apply resolutions
    await prisma.$transaction(
      resolutions.map(({ fillInTheBlankCardId, vocabularyCardId }) =>
        prisma.fillInTheBlankCard.update({
          where: { id: fillInTheBlankCardId },
          data: { boundVocabularyCardId: vocabularyCardId },
        })
      )
    );
  },

  /**
   * Internal helper to sync listening card states when relevant vocabulary card fields change.
   * Handles cases like audioUrl removal which makes cards ineligible for listening exercises.
   * 
   * @private
   */
  async _syncListeningStatesAfterCardUpdate(
    tx: TransactionClient,
    cardId: string,
    originalCard: VocabularyCard,
    updatedCard: VocabularyCard
  ): Promise<void> {
    const hadAudio = !!originalCard.audioUrl;
    const hasAudio = !!updatedCard.audioUrl;
    
    // Critical case: Audio URL was removed - card can no longer be used for listening
    if (hadAudio && !hasAudio) {
      // Since ListeningCardState doesn't have an isArchived field, we delete invalid states
      const deletedStates = await tx.listeningCardState.deleteMany({
        where: { cardId }
      });

      // Also delete related review history entries for listening
      await tx.reviewHistory.deleteMany({
        where: { 
          cardId,
          reviewType: 'LISTENING'
        }
      });

      if (deletedStates.count > 0) {
        console.log(`Cleaned up ${deletedStates.count} listening card states for card ${cardId} after audio URL removal`);
      }
    }
    
    // Audio was added - card is now eligible for listening (no action needed, will be picked up dynamically)
    else if (!hadAudio && hasAudio) {
      console.log(`Card ${cardId} is now eligible for listening exercises (audio URL added)`);
    }

    // Other field changes (englishWord, chineseTranslation, pinyin) don't require state cleanup
    // since they're referenced dynamically through the foreign key relationship
  },

  // ================================================================= //
  // GENERIC DECK CRUD METHODS
  // ================================================================= //

  /**
   * Creates a new generic deck.
   * This implementation mirrors createDeck but creates a GenericDeck.
   */
  async createGenericDeck(data: {
    creatorId: string;
    name: string;
    description?: string;
    isPublic?: boolean;
    boundVocabularyDeckId?: string;
  }): Promise<GenericDeck> {
    return prisma.genericDeck.create({ data });
  },

  /**
   * Updates an existing generic deck.
   * Only the creator can update their own deck.
   */
  async updateGenericDeck(
    deckId: string,
    teacherId: string,
    data: Partial<Omit<Prisma.GenericDeckUpdateInput, 'creator' | 'cards'>>
  ): Promise<GenericDeck> {
    const deck = await prisma.genericDeck.findUnique({
      where: { id: deckId },
      select: { creatorId: true },
    });

    if (!deck) {
      throw new Error(`Generic deck with ID ${deckId} not found.`);
    }

    if (deck.creatorId !== teacherId) {
      throw new AuthorizationError(
        'You do not have permission to update this generic deck.'
      );
    }

    return prisma.genericDeck.update({
      where: { id: deckId },
      data,
    });
  },

  /**
   * Retrieves all generic decks for a given teacher.
   */
  async getGenericDecksForTeacher(teacherId: string): Promise<GenericDeck[]> {
    return prisma.genericDeck.findMany({
      where: {
        creatorId: teacherId,
        isArchived: false
      },
      include: {
        _count: {
          select: {
            cards: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Retrieves all public generic decks.
   */
  async getPublicGenericDecks(): Promise<GenericDeck[]> {
    return prisma.genericDeck.findMany({
      where: {
        isPublic: true,
        isArchived: false
      },
      include: {
        _count: {
          select: {
            cards: true,
          },
        },
        creator: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Adds a new card to a generic deck.
   * This implementation mirrors addCardToDeck but works with GenericCard.
   */
  async addCardToGenericDeck(
    deckId: string,
    teacherId: string,
    cardData: Omit<Prisma.GenericCardCreateInput, 'deck' | 'deckId'>
  ): Promise<GenericCard> {
    const deck = await prisma.genericDeck.findUnique({
      where: { id: deckId },
      select: { creatorId: true },
    });

    if (!deck) {
      throw new Error(`Generic deck with ID ${deckId} not found.`);
    }

    if (deck.creatorId !== teacherId) {
      throw new AuthorizationError(
        'You do not have permission to add cards to this generic deck.'
      );
    }

    return prisma.genericCard.create({
      data: {
        front: cardData.front,
        back: cardData.back,
        exampleSentences: cardData.exampleSentences,
        tags: cardData.tags,
        audioUrl: cardData.audioUrl,
        imageUrl: cardData.imageUrl,
        deck: {
          connect: { id: deckId }
        },
        ...(cardData.boundVocabularyCard && {
          boundVocabularyCard: cardData.boundVocabularyCard
        })
      },
    });
  },

  /**
   * Updates an existing generic card.
   * This implementation mirrors updateCard but works with GenericCard.
   */
  async updateGenericCard(
    cardId: string,
    deckId: string,
    teacherId: string,
    cardData: Prisma.GenericCardUpdateInput
  ): Promise<GenericCard> {
    return prisma.$transaction(async (tx) => {
      // First verify the card exists and belongs to the specified deck
      const card = await tx.genericCard.findUnique({
        where: { id: cardId },
        include: { deck: { select: { creatorId: true, id: true } } },
      });

      if (!card) {
        throw new Error(`Generic card with ID ${cardId} not found.`);
      }

      if (card.deck.id !== deckId) {
        throw new Error('Card does not belong to the specified deck.');
      }

      if (card.deck.creatorId !== teacherId) {
        throw new AuthorizationError(
          'You do not have permission to update this generic card.'
        );
      }

      return tx.genericCard.update({
        where: { id: cardId },
        data: cardData,
      });
    });
  },

  /**
   * Deletes a generic card from a deck.
   * This implementation mirrors the vocabulary card deletion pattern.
   */
  async deleteGenericCard(
    cardId: string,
    deckId: string,
    teacherId: string
  ): Promise<GenericCard> {
    return prisma.$transaction(async (tx) => {
      // First verify the card exists and belongs to the specified deck
      const card = await tx.genericCard.findUnique({
        where: { id: cardId },
        include: { deck: { select: { creatorId: true, id: true } } },
      });

      if (!card) {
        throw new Error(`Generic card with ID ${cardId} not found.`);
      }

      if (card.deck.id !== deckId) {
        throw new Error('Card does not belong to the specified deck.');
      }

      if (card.deck.creatorId !== teacherId) {
        throw new AuthorizationError(
          'You do not have permission to delete this generic card.'
        );
      }

      // Delete all related FSRS states first
      await tx.studentGenericCardState.deleteMany({
        where: { cardId },
      });

      // Delete review history for this card
      await tx.reviewHistory.deleteMany({
        where: { 
          cardId,
          reviewType: 'GENERIC'
        },
      });

      // Finally delete the card itself
      return tx.genericCard.delete({
        where: { id: cardId },
      });
    });
  },

  /**
   * Auto-binding logic for generic decks to vocabulary decks.
   * This implementation mirrors autoBindFillInTheBlankToVocabulary.
   */
  async autoBindGenericToVocabulary(deckId: string, teacherId: string): Promise<{
    automaticMatches: Array<{
      genericCard: { id: string; front: string };
      vocabularyCard: { id: string; englishWord: string };
    }>;
    ambiguities: Array<{
      genericCard: { id: string; front: string };
      possibleMatches: Array<{
        id: string;
        englishWord: string;
      }>;
    }>;
    noMatches: Array<{ id: string; front: string }>;
  }> {
    // 1. Authorize teacher and get the generic deck
    const deck = await prisma.genericDeck.findUnique({
      where: { id: deckId },
      select: { creatorId: true, boundVocabularyDeckId: true, cards: { select: { id: true, front: true } } },
    });

    if (!deck) {
      throw new Error('Generic deck not found.');
    }

    if (deck.creatorId !== teacherId) {
      throw new AuthorizationError('You do not have permission to auto-bind this generic deck.');
    }

    if (!deck.boundVocabularyDeckId) {
      throw new Error('This generic deck is not bound to a vocabulary deck.');
    }

    // 2. Get vocabulary cards from the bound deck
    const vocabularyCards = await prisma.vocabularyCard.findMany({
      where: { deckId: deck.boundVocabularyDeckId },
      select: { id: true, englishWord: true },
    });

    // 3. Create a map of englishWord -> VocabularyCard[]
    const vocabMap = new Map<string, Array<{ id: string; englishWord: string }>>();
    vocabularyCards.forEach(card => {
      const key = card.englishWord.toLowerCase().trim();
      if (!vocabMap.has(key)) {
        vocabMap.set(key, []);
      }
      vocabMap.get(key)!.push(card);
    });

    // 4. Process each GenericCard, matching card.front to vocabMap key
    const automaticMatches: Array<{
      genericCard: { id: string; front: string };
      vocabularyCard: { id: string; englishWord: string };
    }> = [];
    const ambiguities: Array<{
      genericCard: { id: string; front: string };
      possibleMatches: Array<{ id: string; englishWord: string }>;
    }> = [];
    const noMatches: Array<{ id: string; front: string }> = [];
    const autoUpdates: Array<{ cardId: string; vocabularyCardId: string }> = [];

    for (const genericCard of deck.cards) {
      const searchKey = genericCard.front.toLowerCase().trim();
      const candidates = vocabMap.get(searchKey) || [];

      if (candidates.length === 0) {
        noMatches.push({ id: genericCard.id, front: genericCard.front });
      } else if (candidates.length === 1) {
        // Perfect match - can be auto-bound
        const match = candidates[0];
        automaticMatches.push({
          genericCard: { id: genericCard.id, front: genericCard.front },
          vocabularyCard: { id: match.id, englishWord: match.englishWord }
        });
        autoUpdates.push({
          cardId: genericCard.id,
          vocabularyCardId: match.id
        });
      } else {
        // Multiple matches - ambiguous, requires teacher input
        ambiguities.push({
          genericCard: { id: genericCard.id, front: genericCard.front },
          possibleMatches: candidates.map(c => ({
            id: c.id,
            englishWord: c.englishWord
          }))
        });
      }
    }

    // 5. Apply automatic updates for perfect matches
    if (autoUpdates.length > 0) {
      await prisma.$transaction(
        autoUpdates.map(update =>
          prisma.genericCard.update({
            where: { id: update.cardId },
            data: { boundVocabularyCardId: update.vocabularyCardId }
          })
        )
      );
    }

    return { 
      automaticMatches, 
      ambiguities, 
      noMatches 
    };
  },

  /**
   * Internal method to bulk add generic cards to a deck.
   * This implementation mirrors _bulkAddVocabularyCards.
   */
  async _bulkAddGenericCards(
    payload: BulkImportGenericCardPayload
  ): Promise<{ cardsAdded: number; errors: string[] }> {
    const typedPayload = payload as {
      deckId: string;
      teacherId: string;
      cards: BulkImportGenericCardData[];
    };
    const { deckId, teacherId, cards } = typedPayload;

    if (!Array.isArray(cards) || cards.length === 0) {
      throw new Error('Invalid payload: cards array is required and must not be empty.');
    }

    const deck = await prisma.genericDeck.findUnique({
      where: { id: deckId },
      select: { creatorId: true },
    });

    if (!deck) {
      throw new Error(`Generic deck with ID ${deckId} not found.`);
    }

    if (deck.creatorId !== teacherId) {
      throw new AuthorizationError(
        'You do not have permission to add cards to this generic deck.'
      );
    }

    const errors: string[] = [];
    let cardsAdded = 0;

    // Process cards in batches of 100 to avoid memory issues
    const batchSize = 100;
    for (let i = 0; i < cards.length; i += batchSize) {
      const batch = cards.slice(i, i + batchSize);
      
      try {
        const validCards = batch.filter(card => {
          if (!card.front?.trim() || !card.back?.trim()) {
            errors.push(`Card ${i + batch.indexOf(card) + 1}: front and back fields are required`);
            return false;
          }
          return true;
        });

        if (validCards.length > 0) {
          const cardsToCreate = validCards.map(card => ({
            deckId,
            front: card.front.trim(),
            back: card.back.trim(),
            exampleSentences: card.exampleSentences || undefined,
            audioUrl: card.audioUrl || undefined,
            imageUrl: card.imageUrl || undefined,
            tags: card.tags || [],
          }));

          await prisma.genericCard.createMany({
            data: cardsToCreate,
            skipDuplicates: true,
          });

          cardsAdded += validCards.length;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${errorMessage}`);
      }
    }

    return { cardsAdded, errors };
  },
};

