import { prisma } from '@/lib/db';
import { FullUnit, NewUnitItemData } from '@/lib/types';
import { Prisma, Unit, UnitItem } from '@prisma/client';

/**
 * Service responsible for managing the global repository of all learning materials
 * (Units, Decks, Exercises). It encapsulates all business logic related to content creation
 * and management, ensuring data integrity and consistency.
 */
export const ContentService = {
  /**
   * Retrieves a single, fully populated Unit by its ID.
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
        // Include all 'items' associated with this unit.
        items: {
          // Ensure the items are returned in the correct sequence.
          orderBy: { order: 'asc' },
          // For each item, include the actual exercise data it links to.
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
   * @param order The position of this item in the lesson sequence.
   * @param itemData An object containing the type of exercise and its data.
   * @returns A promise that resolves to the newly created UnitItem.
   */
  async addExerciseToUnit(
    unitId: string,
    creatorId: string,
    order: number,
    itemData: NewUnitItemData
  ): Promise<UnitItem> {
    return prisma.$transaction(async (tx) => {
      let newUnitItem: UnitItem;

      switch (itemData.type) {
        case 'VOCABULARY_DECK': {
          const deck = await tx.vocabularyDeck.create({
            data: { ...itemData.data, creatorId },
          });
          newUnitItem = await tx.unitItem.create({
            data: { unitId, order, vocabularyDeckId: deck.id },
          });
          break;
        }
        case 'GRAMMAR_EXERCISE': {
          const exercise = await tx.grammarExercise.create({
            data: { ...itemData.data, creatorId },
          });
          newUnitItem = await tx.unitItem.create({
            data: { unitId, order, grammarExerciseId: exercise.id },
          });
          break;
        }
        case 'LISTENING_EXERCISE': {
          const exercise = await tx.listeningExercise.create({
            data: { ...itemData.data, creatorId },
          });
          newUnitItem = await tx.unitItem.create({
            data: { unitId, order, listeningExerciseId: exercise.id },
          });
          break;
        }
        case 'VOCAB_FILL_IN_BLANK_EXERCISE': {
            const exercise = await tx.vocabFillInBlankExercise.create({
                data: { ...itemData.data, creatorId },
            });
            newUnitItem = await tx.unitItem.create({
                data: { unitId, order, vocabFillInBlankExerciseId: exercise.id },
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
   * Updates the order of all items within a single unit atomically.
   * This is crucial for allowing teachers to re-arrange their lesson plans without
   * risking data inconsistency.
   *
   * @param unitId The UUID of the unit to reorder (not currently used but good for validation).
   * @param orderedItemIds An array of UnitItem UUIDs in their new desired order.
   * @returns A promise that resolves to an array of the updated UnitItems.
   */
  async reorderUnitItems(unitId: string, orderedItemIds: string[]): Promise<Prisma.BatchPayload> {
    return prisma.$transaction(async (tx) => {
        const updates = orderedItemIds.map((id, index) =>
            tx.unitItem.update({
                where: { id, unitId }, // Ensure we only update items belonging to the specified unit
                data: { order: index },
            })
        );
        // Although we run updates, Prisma's transaction batching returns a single payload
        await Promise.all(updates);
        return { count: orderedItemIds.length };
    });
  },

  /**
   * Deletes a specific UnitItem from a unit.
   * Thanks to the `onDelete: Cascade` rule defined in our `schema.prisma`,
   * deleting a `UnitItem` will automatically trigger the deletion of the
   * associated exercise (e.g., the GrammarExercise or VocabularyDeck),
   * ensuring the database remains clean and consistent.
   *
   * @param unitItemId The UUID of the unit item to delete.
   * @returns A promise that resolves to the deleted UnitItem.
   */
  async removeUnitItem(unitItemId: string): Promise<UnitItem> {
    return prisma.unitItem.delete({
      where: { id: unitItemId },
    });
  },
};
