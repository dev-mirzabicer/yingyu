import { NextRequest } from 'next/server';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { authorizeTeacherForStudent } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/students/[studentId]/available-units
 * 
 * Returns all units that this student can participate in, along with metadata
 * about whether they have the necessary deck assignments and card states.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { studentId: string } }
) {
  try {
    const teacherId = req.headers.get('X-Teacher-ID');
    if (!teacherId) {
      return apiResponse(401, null, 'Unauthorized: Missing X-Teacher-ID header.');
    }

    const { studentId } = params;

    // Authorize teacher access to this student
    await authorizeTeacherForStudent(teacherId, studentId, {
      checkIsActive: true,
    });

    // Get all units that are either:
    // 1. Created by this teacher, OR
    // 2. Public units
    const units = await prisma.unit.findMany({
      where: {
        OR: [
          { creatorId: teacherId },
          { isPublic: true }
        ]
      },
      include: {
        items: {
          orderBy: { order: 'asc' },
          include: {
            vocabularyDeck: {
              select: {
                id: true,
                name: true,
                description: true,
                _count: {
                  select: { cards: true }
                }
              }
            },
            grammarExercise: {
              select: {
                id: true,
                title: true,
                grammarTopic: true,
                difficultyLevel: true
              }
            },
            listeningExercise: {
              select: {
                id: true,
                title: true,
                difficultyLevel: true
              }
            },
            vocabFillInBlankExercise: {
              select: {
                id: true,
                title: true,
                difficultyLevel: true
              }
            }
          }
        }
      }
    });

    // For each unit, check if the student has the necessary prerequisites
    const unitsWithAvailability = await Promise.all(
      units.map(async (unit) => {
        let isAvailable = true;
        let missingPrerequisites: string[] = [];
        let totalCards = 0;
        let readyCards = 0;

        for (const item of unit.items) {
          if (item.type === 'VOCABULARY_DECK' && item.vocabularyDeck) {
            const deckId = item.vocabularyDeck.id;

            // Check if student has this deck assigned
            const studentDeck = await prisma.studentDeck.findFirst({
              where: {
                studentId,
                deckId,
                isActive: true
              }
            });

            if (!studentDeck) {
              isAvailable = false;
              missingPrerequisites.push(`Vocabulary deck "${item.vocabularyDeck.name}" not assigned`);
            } else {
              // Count cards available for this student
              const cardCount = await prisma.studentCardState.count({
                where: {
                  studentId,
                  card: { deckId }
                }
              });

              const dueCount = await prisma.studentCardState.count({
                where: {
                  studentId,
                  card: { deckId },
                  OR: [
                    { state: 'NEW' },
                    { due: { lte: new Date() } }
                  ]
                }
              });

              totalCards += cardCount;
              readyCards += dueCount;
            }
          }
          // Future: Add checks for other exercise types that might have prerequisites
        }

        return {
          ...unit,
          isAvailable,
          missingPrerequisites,
          cardStats: {
            total: totalCards,
            ready: readyCards
          },
          exerciseCount: unit.items.length
        };
      })
    );

    return apiResponse(200, unitsWithAvailability, null);
  } catch (error) {
    return handleApiError(error);
  }
}

