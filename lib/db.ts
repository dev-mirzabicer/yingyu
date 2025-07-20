import { Prisma, PrismaClient } from '@prisma/client';

// Declare a global variable to hold the Prisma Client instance.
declare global {
  var prisma: PrismaClient | undefined;
}

// The list of models that support our soft-delete/archiving pattern.
const ARCHIVABLE_MODELS = [
  'Student',
  'VocabularyDeck',
  'GrammarExercise',
  'ListeningExercise',
  'VocabFillInBlankExercise',
];

/**
 * Creates and configures the Prisma Client instance.
 * This function applies a powerful global extension to handle soft deletes automatically.
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
        // This middleware intercepts all find, update, and delete operations.
        async $allOperations({ model, operation, args, query }) {
          // Only apply the logic to models that are archivable.
          if (ARCHIVABLE_MODELS.includes(model as string)) {
            // For any operation that finds or modifies records...
            if (
              [
                'findUnique',
                'findFirst',
                'findMany',
                'update',
                'updateMany',
                'count',
              ].includes(operation)
            ) {
              // ...we automatically add `isArchived: false` to the `where` clause.
              // This ensures that from the application's perspective, archived records
              // are treated as if they do not exist.
              args.where = { ...(args.where as object), isArchived: false };
            }
          }
          return query(args);
        },
      },
    },
  });
}

// Instantiate the Prisma Client using our factory.
// In development, we reuse the instance across hot reloads.
export const prisma = globalThis.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}
