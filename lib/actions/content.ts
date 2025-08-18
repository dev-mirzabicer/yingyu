import { prisma } from '@/lib/db';
import {
  FullUnit,
  NewUnitItemData,
  VocabularyExerciseConfig,
  ListeningExerciseConfig,
  FillInBlankExerciseConfig,
} from '@/lib/types';
import {
  Unit,
  UnitItem,
  UnitItemType,
  VocabularyDeck,
  GrammarExercise,
  ListeningExercise,
  FillInBlankExercise,
  FillInBlankQuestion,
  Prisma,
  VocabularyCard,
} from '@prisma/client';
import { AuthorizationError } from '../auth';
import { TransactionClient } from '@/lib/exercises/operators/base';
import {
  BulkImportVocabularyPayloadSchema,
  VocabularyExerciseConfigSchema,
} from '../schemas';
import { z } from 'zod';

type Exercise =
  | VocabularyDeck
  | GrammarExercise
  | ListeningExercise
  | FillInBlankExercise;

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
            fillInBlankExercise: true,
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
          fillInBlankExercise: { select: { isPublic: true } },
        },
      });

      for (const item of items) {
        const exercise =
          item.vocabularyDeck ||
          item.grammarExercise ||
          item.listeningExercise ||
          item.fillInBlankExercise;
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
        case 'FILL_IN_BLANK_EXERCISE': {
          // Fill-in-blank exercises are deck-based and must reference an existing vocabulary deck
          const existingDeck = await tx.vocabularyDeck.findUnique({
            where: { id: itemData.existingDeckId },
            select: { id: true, creatorId: true, isPublic: true },
          });

          if (!existingDeck) {
            throw new Error('Selected vocabulary deck not found for Fill-in-Blank Exercise.');
          }

          // Check if the teacher has access to this deck
          if (!existingDeck.isPublic && existingDeck.creatorId !== creatorId) {
            throw new AuthorizationError('You do not have permission to use this deck.');
          }

          // Create fill-in-blank exercise referencing the vocabulary deck
          const exercise = await tx.fillInBlankExercise.create({
            data: { 
              ...itemData.data, 
              vocabularyDeckId: existingDeck.id,
              creatorId 
            },
          });

          // Ensure config has deckId for the fill-in-blank exercise
          const fillInBlankConfig = {
            ...itemData.config,
            deckId: existingDeck.id
          };

          newUnitItem = await tx.unitItem.create({
            data: {
              unitId,
              order: newOrder,
              type: 'FILL_IN_BLANK_EXERCISE',
              fillInBlankExerciseId: exercise.id,
              exerciseConfig: fillInBlankConfig || Prisma.JsonNull,
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
          | 'fillInBlankExercise',
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
        case UnitItemType.FILL_IN_BLANK_EXERCISE:
          return findAndCopy('fillInBlankExercise', exerciseId);
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
        | 'fillInBlankExercise',
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
      case UnitItemType.FILL_IN_BLANK_EXERCISE:
        return findAndArchive('fillInBlankExercise', exerciseId);
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
        case 'FILL_IN_BLANK_EXERCISE':
          minDuration += 8;
          maxDuration += 15;
          break;
        case 'GRAMMAR_EXERCISE':
          minDuration += 10;
          maxDuration += 20;
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
  // FILL-IN-BLANK EXERCISE CRUD OPERATIONS
  // ================================================================= //

  /**
   * Create a new fill-in-blank exercise
   */
  async createFillInBlankExercise(data: {
    title: string;
    vocabularyDeckId: string;
    difficultyLevel?: number;
    explanation?: string;
    tags?: string[];
    isPublic?: boolean;
    creatorId: string;
  }): Promise<FillInBlankExercise> {
    // Verify the creator has access to the vocabulary deck
    const deck = await prisma.vocabularyDeck.findUnique({
      where: { id: data.vocabularyDeckId },
      select: { id: true, creatorId: true, isPublic: true },
    });

    if (!deck) {
      throw new Error('Vocabulary deck not found');
    }

    if (!deck.isPublic && deck.creatorId !== data.creatorId) {
      throw new AuthorizationError('You do not have permission to use this deck');
    }

    return await prisma.fillInBlankExercise.create({
      data: {
        title: data.title,
        vocabularyDeckId: data.vocabularyDeckId,
        difficultyLevel: data.difficultyLevel || 1,
        explanation: data.explanation,
        tags: data.tags || [],
        isPublic: data.isPublic || false,
        creatorId: data.creatorId,
      },
    });
  },

  /**
   * Get fill-in-blank exercises for a teacher
   */
  async getFillInBlankExercises(options: {
    creatorId: string;
    page?: number;
    limit?: number;
    search?: string;
    deckId?: string;
    isPublic?: boolean;
  }): Promise<{
    exercises: (FillInBlankExercise & {
      vocabularyDeck: { name: string; _count: { cards: number } };
      unitItem: { id: string } | null;
    })[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const {
      creatorId,
      page = 1,
      limit = 10,
      search,
      deckId,
      isPublic,
    } = options;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      OR: [
        { creatorId }, // User's own exercises
        { isPublic: true }, // Public exercises
      ],
    };

    if (search) {
      where.title = {
        contains: search,
        mode: 'insensitive',
      };
    }

    if (deckId) {
      where.vocabularyDeckId = deckId;
    }

    if (isPublic !== undefined) {
      where.isPublic = isPublic;
    }

    const [exercises, total] = await Promise.all([
      prisma.fillInBlankExercise.findMany({
        where,
        include: {
          vocabularyDeck: {
            select: {
              name: true,
              _count: {
                select: { cards: true },
              },
            },
          },
          unitItem: {
            select: { id: true },
          },
        },
        orderBy: [
          { createdAt: 'desc' },
        ],
        skip,
        take: limit,
      }),
      prisma.fillInBlankExercise.count({ where }),
    ]);

    return {
      exercises,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * Get a specific fill-in-blank exercise
   */
  async getFillInBlankExercise(
    exerciseId: string,
    userId: string
  ): Promise<FillInBlankExercise & {
    vocabularyDeck: VocabularyDeck & { _count: { cards: number } };
    unitItem: { id: string } | null;
  }> {
    const exercise = await prisma.fillInBlankExercise.findUnique({
      where: { id: exerciseId },
      include: {
        vocabularyDeck: {
          include: {
            _count: {
              select: { cards: true },
            },
          },
        },
        unitItem: {
          select: { id: true },
        },
      },
    });

    if (!exercise) {
      throw new Error('Fill-in-blank exercise not found');
    }

    // Check access permissions
    if (!exercise.isPublic && exercise.creatorId !== userId) {
      throw new AuthorizationError('You do not have permission to access this exercise');
    }

    return exercise;
  },

  /**
   * Update a fill-in-blank exercise
   */
  async updateFillInBlankExercise(
    exerciseId: string,
    userId: string,
    updates: {
      title?: string;
      vocabularyDeckId?: string;
      difficultyLevel?: number;
      explanation?: string;
      tags?: string[];
      isPublic?: boolean;
    }
  ): Promise<FillInBlankExercise> {
    const exercise = await prisma.fillInBlankExercise.findUnique({
      where: { id: exerciseId },
      select: { id: true, creatorId: true },
    });

    if (!exercise) {
      throw new Error('Fill-in-blank exercise not found');
    }

    if (exercise.creatorId !== userId) {
      throw new AuthorizationError('You do not have permission to update this exercise');
    }

    // If updating vocabularyDeckId, verify access to the new deck
    if (updates.vocabularyDeckId) {
      const deck = await prisma.vocabularyDeck.findUnique({
        where: { id: updates.vocabularyDeckId },
        select: { id: true, creatorId: true, isPublic: true },
      });

      if (!deck) {
        throw new Error('Vocabulary deck not found');
      }

      if (!deck.isPublic && deck.creatorId !== userId) {
        throw new AuthorizationError('You do not have permission to use this deck');
      }
    }

    return await prisma.fillInBlankExercise.update({
      where: { id: exerciseId },
      data: updates,
    });
  },

  /**
   * Delete (archive) a fill-in-blank exercise
   */
  async deleteFillInBlankExercise(exerciseId: string, userId: string): Promise<void> {
    const exercise = await prisma.fillInBlankExercise.findUnique({
      where: { id: exerciseId },
      select: { id: true, creatorId: true },
    });

    if (!exercise) {
      throw new Error('Fill-in-blank exercise not found');
    }

    if (exercise.creatorId !== userId) {
      throw new AuthorizationError('You do not have permission to delete this exercise');
    }

    // Soft delete via the global extension
    await prisma.fillInBlankExercise.delete({
      where: { id: exerciseId },
    });
  },

  /**
   * Search vocabulary cards for binding to fill-in-blank exercises
   */
  async searchVocabularyCardsForBinding(options: {
    deckId: string;
    query: string;
    limit?: number;
    creatorId: string;
  }): Promise<{
    cards: (VocabularyCard & { 
      isExactMatch: boolean;
      relevanceScore: number;
    })[];
    totalMatches: number;
  }> {
    const { deckId, query, limit = 10, creatorId } = options;

    // Verify the user has access to this deck
    const deck = await prisma.vocabularyDeck.findUnique({
      where: { id: deckId },
      select: { id: true, creatorId: true, isPublic: true },
    });

    if (!deck) {
      throw new Error('Vocabulary deck not found');
    }

    if (!deck.isPublic && deck.creatorId !== creatorId) {
      throw new AuthorizationError('You do not have permission to access this deck');
    }

    const searchQuery = query.toLowerCase().trim();

    // Search for cards with sophisticated matching
    const cards = await prisma.vocabularyCard.findMany({
      where: {
        deckId,
        OR: [
          {
            englishWord: {
              contains: searchQuery,
              mode: 'insensitive',
            },
          },
          {
            chineseTranslation: {
              contains: searchQuery,
              mode: 'insensitive',
            },
          },
          {
            pinyin: {
              contains: searchQuery,
              mode: 'insensitive',
            },
          },
        ],
      },
      orderBy: [
        { englishWord: 'asc' },
      ],
      take: limit * 2, // Get more for scoring
    });

    // Score and sort the results
    const scoredCards = cards.map(card => {
      const englishLower = card.englishWord.toLowerCase();
      const chineseLower = card.chineseTranslation.toLowerCase();
      const pinyinLower = (card.pinyin || '').toLowerCase();

      let relevanceScore = 0;
      let isExactMatch = false;

      // Exact match scoring
      if (englishLower === searchQuery) {
        relevanceScore = 100;
        isExactMatch = true;
      } else if (chineseLower === searchQuery) {
        relevanceScore = 95;
        isExactMatch = true;
      } else if (pinyinLower === searchQuery) {
        relevanceScore = 90;
        isExactMatch = true;
      }
      // Prefix match scoring
      else if (englishLower.startsWith(searchQuery)) {
        relevanceScore = 80 - searchQuery.length; // Shorter prefixes score higher
      } else if (chineseLower.startsWith(searchQuery)) {
        relevanceScore = 75 - searchQuery.length;
      } else if (pinyinLower.startsWith(searchQuery)) {
        relevanceScore = 70 - searchQuery.length;
      }
      // Contains match scoring
      else if (englishLower.includes(searchQuery)) {
        relevanceScore = 50 - searchQuery.length;
      } else if (chineseLower.includes(searchQuery)) {
        relevanceScore = 45 - searchQuery.length;
      } else if (pinyinLower.includes(searchQuery)) {
        relevanceScore = 40 - searchQuery.length;
      }

      return {
        ...card,
        isExactMatch,
        relevanceScore,
      };
    });

    // Sort by relevance and take only the requested limit
    const sortedCards = scoredCards
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);

    return {
      cards: sortedCards,
      totalMatches: cards.length,
    };
  },

  // ================================================================= //
  // FILL-IN-BLANK QUESTION CRUD OPERATIONS
  // ================================================================= //

  /**
   * Get fill-in-blank questions for an exercise with comprehensive filtering
   */
  async getFillInBlankQuestions(options: {
    exerciseId: string;
    teacherId: string;
    page?: number;
    limit?: number;
    search?: string;
    activeOnly?: boolean;
    orderBy?: 'order' | 'createdAt' | 'sentence';
    orderDirection?: 'asc' | 'desc';
  }): Promise<{
    questions: (FillInBlankQuestion & {
      vocabularyCard: VocabularyCard | null;
    })[];
    total: number;
    page: number;
    totalPages: number;
    exerciseInfo: {
      id: string;
      title: string;
      placeholderToken: string;
      vocabularyDeck: { name: string };
    };
  }> {
    const {
      exerciseId,
      teacherId,
      page = 1,
      limit = 20,
      search,
      activeOnly = true,
      orderBy = 'order',
      orderDirection = 'asc',
    } = options;

    // Verify access to the exercise
    const exercise = await prisma.fillInBlankExercise.findUnique({
      where: { id: exerciseId },
      include: {
        vocabularyDeck: {
          select: { name: true },
        },
      },
    });

    if (!exercise) {
      throw new Error('Fill-in-blank exercise not found');
    }

    if (!exercise.isPublic && exercise.creatorId !== teacherId) {
      throw new AuthorizationError('You do not have permission to access this exercise');
    }

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      exerciseId,
    };

    if (activeOnly) {
      where.isActive = true;
    }

    if (search) {
      where.OR = [
        {
          sentence: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          correctAnswer: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    // Build orderBy clause
    const orderByClause: any = {};
    if (orderBy === 'order') {
      orderByClause.order = orderDirection;
    } else if (orderBy === 'createdAt') {
      orderByClause.createdAt = orderDirection;
    } else if (orderBy === 'sentence') {
      orderByClause.sentence = orderDirection;
    }

    const [questions, total] = await Promise.all([
      prisma.fillInBlankQuestion.findMany({
        where,
        include: {
          vocabularyCard: true,
        },
        orderBy: orderByClause,
        skip,
        take: limit,
      }),
      prisma.fillInBlankQuestion.count({ where }),
    ]);

    return {
      questions,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      exerciseInfo: {
        id: exercise.id,
        title: exercise.title,
        placeholderToken: exercise.placeholderToken,
        vocabularyDeck: exercise.vocabularyDeck,
      },
    };
  },

  /**
   * Get a specific fill-in-blank question
   */
  async getFillInBlankQuestion(
    questionId: string,
    exerciseId: string,
    teacherId: string
  ): Promise<FillInBlankQuestion & {
    vocabularyCard: VocabularyCard | null;
    exercise: {
      id: string;
      title: string;
      placeholderToken: string;
    };
  }> {
    const question = await prisma.fillInBlankQuestion.findUnique({
      where: { id: questionId },
      include: {
        vocabularyCard: true,
        exercise: {
          select: {
            id: true,
            title: true,
            placeholderToken: true,
            creatorId: true,
            isPublic: true,
          },
        },
      },
    });

    if (!question) {
      throw new Error('Fill-in-blank question not found');
    }

    if (question.exerciseId !== exerciseId) {
      throw new Error('Question does not belong to the specified exercise');
    }

    if (!question.exercise.isPublic && question.exercise.creatorId !== teacherId) {
      throw new AuthorizationError('You do not have permission to access this question');
    }

    return question;
  },

  /**
   * Create a new fill-in-blank question
   */
  async createFillInBlankQuestion(data: {
    exerciseId: string;
    teacherId: string;
    sentence: string;
    correctAnswer: string;
    vocabularyCardId?: string;
    distractors?: string[];
    difficultyLevel?: number;
    order?: number;
  }): Promise<FillInBlankQuestion & {
    vocabularyCard: VocabularyCard | null;
  }> {
    const {
      exerciseId,
      teacherId,
      sentence,
      correctAnswer,
      vocabularyCardId,
      distractors = [],
      difficultyLevel = 1,
      order,
    } = data;

    return await prisma.$transaction(async (tx) => {
      // Verify access to the exercise
      const exercise = await tx.fillInBlankExercise.findUnique({
        where: { id: exerciseId },
        select: { id: true, creatorId: true, isPublic: true, vocabularyDeckId: true },
      });

      if (!exercise) {
        throw new Error('Fill-in-blank exercise not found');
      }

      if (exercise.creatorId !== teacherId) {
        throw new AuthorizationError('You do not have permission to add questions to this exercise');
      }

      // If vocabularyCardId is provided, verify it belongs to the exercise's vocabulary deck
      if (vocabularyCardId) {
        const card = await tx.vocabularyCard.findUnique({
          where: { id: vocabularyCardId },
          select: { id: true, deckId: true },
        });

        if (!card) {
          throw new Error('Vocabulary card not found');
        }

        if (card.deckId !== exercise.vocabularyDeckId) {
          throw new Error('Vocabulary card does not belong to the exercise\'s vocabulary deck');
        }
      }

      // Determine the order if not provided
      let finalOrder = order;
      if (finalOrder === undefined) {
        const lastQuestion = await tx.fillInBlankQuestion.findFirst({
          where: { exerciseId },
          orderBy: { order: 'desc' },
          select: { order: true },
        });
        finalOrder = (lastQuestion?.order ?? -1) + 1;
      }

      // Create the question
      const question = await tx.fillInBlankQuestion.create({
        data: {
          exerciseId,
          sentence,
          correctAnswer,
          vocabularyCardId,
          distractors,
          difficultyLevel,
          order: finalOrder,
        },
        include: {
          vocabularyCard: true,
        },
      });

      return question;
    });
  },

  /**
   * Update a fill-in-blank question
   */
  async updateFillInBlankQuestion(
    questionId: string,
    exerciseId: string,
    teacherId: string,
    updates: {
      sentence?: string;
      correctAnswer?: string;
      vocabularyCardId?: string | null;
      distractors?: string[];
      difficultyLevel?: number;
      order?: number;
      isActive?: boolean;
    }
  ): Promise<FillInBlankQuestion & {
    vocabularyCard: VocabularyCard | null;
  }> {
    return await prisma.$transaction(async (tx) => {
      // Verify access to the question
      const question = await tx.fillInBlankQuestion.findUnique({
        where: { id: questionId },
        include: {
          exercise: {
            select: { id: true, creatorId: true, vocabularyDeckId: true },
          },
        },
      });

      if (!question) {
        throw new Error('Fill-in-blank question not found');
      }

      if (question.exerciseId !== exerciseId) {
        throw new Error('Question does not belong to the specified exercise');
      }

      if (question.exercise.creatorId !== teacherId) {
        throw new AuthorizationError('You do not have permission to update this question');
      }

      // If updating vocabularyCardId, verify it belongs to the exercise's vocabulary deck
      if (updates.vocabularyCardId) {
        const card = await tx.vocabularyCard.findUnique({
          where: { id: updates.vocabularyCardId },
          select: { id: true, deckId: true },
        });

        if (!card) {
          throw new Error('Vocabulary card not found');
        }

        if (card.deckId !== question.exercise.vocabularyDeckId) {
          throw new Error('Vocabulary card does not belong to the exercise\'s vocabulary deck');
        }
      }

      // Update the question
      const updatedQuestion = await tx.fillInBlankQuestion.update({
        where: { id: questionId },
        data: updates,
        include: {
          vocabularyCard: true,
        },
      });

      return updatedQuestion;
    });
  },

  /**
   * Delete (soft-delete) a fill-in-blank question
   */
  async deleteFillInBlankQuestion(
    questionId: string,
    exerciseId: string,
    teacherId: string
  ): Promise<void> {
    return await prisma.$transaction(async (tx) => {
      // Verify access to the question
      const question = await tx.fillInBlankQuestion.findUnique({
        where: { id: questionId },
        include: {
          exercise: {
            select: { id: true, creatorId: true },
          },
        },
      });

      if (!question) {
        throw new Error('Fill-in-blank question not found');
      }

      if (question.exerciseId !== exerciseId) {
        throw new Error('Question does not belong to the specified exercise');
      }

      if (question.exercise.creatorId !== teacherId) {
        throw new AuthorizationError('You do not have permission to delete this question');
      }

      // Soft delete via the global extension
      await tx.fillInBlankQuestion.delete({
        where: { id: questionId },
      });
    });
  },

  /**
   * Bulk create fill-in-blank questions
   */
  async bulkCreateFillInBlankQuestions(data: {
    exerciseId: string;
    teacherId: string;
    questions: Array<{
      sentence: string;
      correctAnswer: string;
      vocabularyCardId?: string;
      distractors?: string[];
      difficultyLevel?: number;
    }>;
  }): Promise<(FillInBlankQuestion & {
    vocabularyCard: VocabularyCard | null;
  })[]> {
    const { exerciseId, teacherId, questions } = data;

    return await prisma.$transaction(async (tx) => {
      // Verify access to the exercise
      const exercise = await tx.fillInBlankExercise.findUnique({
        where: { id: exerciseId },
        select: { id: true, creatorId: true, vocabularyDeckId: true },
      });

      if (!exercise) {
        throw new Error('Fill-in-blank exercise not found');
      }

      if (exercise.creatorId !== teacherId) {
        throw new AuthorizationError('You do not have permission to add questions to this exercise');
      }

      // Validate all vocabulary cards belong to the exercise's deck
      const vocabularyCardIds = questions
        .map(q => q.vocabularyCardId)
        .filter(Boolean) as string[];

      if (vocabularyCardIds.length > 0) {
        const cards = await tx.vocabularyCard.findMany({
          where: { id: { in: vocabularyCardIds } },
          select: { id: true, deckId: true },
        });

        const invalidCards = cards.filter(card => card.deckId !== exercise.vocabularyDeckId);
        if (invalidCards.length > 0) {
          throw new Error(`Some vocabulary cards do not belong to the exercise's deck: ${invalidCards.map(c => c.id).join(', ')}`);
        }

        if (cards.length !== vocabularyCardIds.length) {
          throw new Error('Some vocabulary cards were not found');
        }
      }

      // Get the current max order
      const lastQuestion = await tx.fillInBlankQuestion.findFirst({
        where: { exerciseId },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      let currentOrder = (lastQuestion?.order ?? -1) + 1;

      // Create all questions
      const createdQuestions: (FillInBlankQuestion & {
        vocabularyCard: VocabularyCard | null;
      })[] = [];

      for (const questionData of questions) {
        const question = await tx.fillInBlankQuestion.create({
          data: {
            exerciseId,
            sentence: questionData.sentence,
            correctAnswer: questionData.correctAnswer,
            vocabularyCardId: questionData.vocabularyCardId,
            distractors: questionData.distractors || [],
            difficultyLevel: questionData.difficultyLevel || 1,
            order: currentOrder++,
          },
          include: {
            vocabularyCard: true,
          },
        });

        createdQuestions.push(question);
      }

      return createdQuestions;
    });
  },

  /**
   * Bulk update fill-in-blank questions
   */
  async bulkUpdateFillInBlankQuestions(data: {
    exerciseId: string;
    teacherId: string;
    updates: Array<{
      id: string;
      sentence?: string;
      correctAnswer?: string;
      vocabularyCardId?: string | null;
      distractors?: string[];
      difficultyLevel?: number;
      isActive?: boolean;
    }>;
  }): Promise<(FillInBlankQuestion & {
    vocabularyCard: VocabularyCard | null;
  })[]> {
    const { exerciseId, teacherId, updates } = data;

    return await prisma.$transaction(async (tx) => {
      // Verify access to the exercise
      const exercise = await tx.fillInBlankExercise.findUnique({
        where: { id: exerciseId },
        select: { id: true, creatorId: true, vocabularyDeckId: true },
      });

      if (!exercise) {
        throw new Error('Fill-in-blank exercise not found');
      }

      if (exercise.creatorId !== teacherId) {
        throw new AuthorizationError('You do not have permission to update questions in this exercise');
      }

      // Validate all questions belong to the exercise
      const questionIds = updates.map(u => u.id);
      const questions = await tx.fillInBlankQuestion.findMany({
        where: { id: { in: questionIds } },
        select: { id: true, exerciseId: true },
      });

      const invalidQuestions = questions.filter(q => q.exerciseId !== exerciseId);
      if (invalidQuestions.length > 0) {
        throw new Error(`Some questions do not belong to the specified exercise: ${invalidQuestions.map(q => q.id).join(', ')}`);
      }

      if (questions.length !== questionIds.length) {
        throw new Error('Some questions were not found');
      }

      // Validate vocabulary cards if provided
      const vocabularyCardIds = updates
        .map(u => u.vocabularyCardId)
        .filter(id => id !== null && id !== undefined) as string[];

      if (vocabularyCardIds.length > 0) {
        const cards = await tx.vocabularyCard.findMany({
          where: { id: { in: vocabularyCardIds } },
          select: { id: true, deckId: true },
        });

        const invalidCards = cards.filter(card => card.deckId !== exercise.vocabularyDeckId);
        if (invalidCards.length > 0) {
          throw new Error(`Some vocabulary cards do not belong to the exercise's deck: ${invalidCards.map(c => c.id).join(', ')}`);
        }
      }

      // Update all questions
      const updatedQuestions: (FillInBlankQuestion & {
        vocabularyCard: VocabularyCard | null;
      })[] = [];

      for (const updateData of updates) {
        const { id, ...updateFields } = updateData;
        const question = await tx.fillInBlankQuestion.update({
          where: { id },
          data: updateFields,
          include: {
            vocabularyCard: true,
          },
        });

        updatedQuestions.push(question);
      }

      return updatedQuestions;
    });
  },

  /**
   * Bulk delete fill-in-blank questions
   */
  async bulkDeleteFillInBlankQuestions(data: {
    exerciseId: string;
    teacherId: string;
    questionIds: string[];
  }): Promise<number> {
    const { exerciseId, teacherId, questionIds } = data;

    return await prisma.$transaction(async (tx) => {
      // Verify access to the exercise
      const exercise = await tx.fillInBlankExercise.findUnique({
        where: { id: exerciseId },
        select: { id: true, creatorId: true },
      });

      if (!exercise) {
        throw new Error('Fill-in-blank exercise not found');
      }

      if (exercise.creatorId !== teacherId) {
        throw new AuthorizationError('You do not have permission to delete questions from this exercise');
      }

      // Validate all questions belong to the exercise
      const questions = await tx.fillInBlankQuestion.findMany({
        where: { 
          id: { in: questionIds },
          exerciseId,
        },
        select: { id: true },
      });

      if (questions.length !== questionIds.length) {
        throw new Error('Some questions were not found or do not belong to the exercise');
      }

      // Soft delete via the global extension
      const result = await tx.fillInBlankQuestion.deleteMany({
        where: { id: { in: questionIds } },
      });

      return result.count;
    });
  },

  /**
   * Reorder fill-in-blank questions
   */
  async reorderFillInBlankQuestions(
    exerciseId: string,
    teacherId: string,
    questionIds: string[]
  ): Promise<void> {
    return await prisma.$transaction(async (tx) => {
      // Verify access to the exercise
      const exercise = await tx.fillInBlankExercise.findUnique({
        where: { id: exerciseId },
        select: { id: true, creatorId: true },
      });

      if (!exercise) {
        throw new Error('Fill-in-blank exercise not found');
      }

      if (exercise.creatorId !== teacherId) {
        throw new AuthorizationError('You do not have permission to reorder questions in this exercise');
      }

      // Validate all questions belong to the exercise
      const questions = await tx.fillInBlankQuestion.findMany({
        where: { 
          exerciseId,
          isActive: true, // Only consider active questions for reordering
        },
        select: { id: true },
      });

      const existingQuestionIds = new Set(questions.map(q => q.id));
      const providedQuestionIds = new Set(questionIds);

      if (existingQuestionIds.size !== providedQuestionIds.size || 
          !questionIds.every(id => existingQuestionIds.has(id))) {
        throw new Error("Provided question IDs do not match the exercise's current active questions");
      }

      // Update the order for each question
      const updatePromises = questionIds.map((questionId, index) =>
        tx.fillInBlankQuestion.update({
          where: { id: questionId },
          data: { order: index },
        })
      );

      await Promise.all(updatePromises);
    });
  },
};

