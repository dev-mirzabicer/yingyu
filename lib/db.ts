import { Prisma, PrismaClient } from '@prisma/client';

// The definitive list of models that are protected by our soft-delete/archiving system.
const ARCHIVABLE_MODELS: Prisma.ModelName[] = [
  'Student',
  'VocabularyDeck',
  'GrammarExercise',
  'ListeningExercise',
  'VocabFillInBlankExercise',
];

/**
 * Creates and configures the Prisma Client instance.
 * This function applies a powerful global extension to handle soft deletes automatically,
 * providing a crucial layer of data integrity and protection for the entire application.
 */
function createPrismaClient() {
  const basePrisma = new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

  return basePrisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (model && ARCHIVABLE_MODELS.includes(model)) {
            // --- Intercept DELETE Operations ---
            if (operation === 'delete') {
              if ('where' in args) {
                operation = 'update';
                (args as Prisma.StudentUpdateArgs).data = { isArchived: true };
              }
            }

            if (operation === 'deleteMany') {
              if ('where' in args) {
                operation = 'updateMany';
                (args as Prisma.StudentUpdateManyArgs).data = {
                  isArchived: true,
                };
              }
            }

            // --- Intercept READ/UPDATE Operations ---
            if (
              (operation === 'findUnique' ||
                operation === 'findFirst' ||
                operation === 'findMany' ||
                operation === 'update' ||
                operation === 'updateMany' ||
                operation === 'count') &&
              'where' in args
            ) {
              const where = args.where as Prisma.StudentWhereInput;

              if (where) {
                where.isArchived = false;
              } else {
                // If `where` is null or undefined, we create it.
                (
                  args as
                    | Prisma.StudentFindManyArgs
                    | Prisma.StudentUpdateManyArgs
                ).where = { isArchived: false };
              }
            }
          }

          // Finally, we execute the original query with our potentially modified arguments.
          return query(args);
        },
      },
    },
  });
}

// Infer the type of our extended, more powerful client.
type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

// Augment the global scope to declare our singleton prisma instance.
declare global {
  var prisma: ExtendedPrismaClient | undefined;
}

// Instantiate the Prisma Client using our factory function.
export const prisma = globalThis.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}
