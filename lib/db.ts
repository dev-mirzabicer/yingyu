import { Prisma, PrismaClient } from '@prisma/client';

// The list of models that support our soft-delete/archiving pattern.
const ARCHIVABLE_MODELS: Prisma.ModelName[] = [
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
        async $allOperations({ model, operation, args, query }) {
          if (model && ARCHIVABLE_MODELS.includes(model)) {
            // Check if the operation is one that supports a 'where' clause.
            if (
              operation === 'findUnique' ||
              operation === 'findFirst' ||
              operation === 'findMany' ||
              operation === 'update' ||
              operation === 'updateMany' ||
              operation === 'count'
            ) {
              // Now it's safe to modify args.where
              args.where = { ...(args.where as object), isArchived: false };
            }
          }
          return query(args);
        },
      },
    },
  });
}

// Infer the type of the extended client.
type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

// Augment the global scope to declare our prisma instance.
declare global {
  var prisma: ExtendedPrismaClient | undefined;
}

// Instantiate the Prisma Client.
export const prisma = globalThis.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}
