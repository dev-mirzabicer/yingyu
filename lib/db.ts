import { Prisma, PrismaClient } from '@prisma/client';

// The definitive list of models that are protected by our soft-delete/archiving system.
const ARCHIVABLE_MODELS: Prisma.ModelName[] = [
  'Student',
  'Unit',
  'VocabularyDeck',
  'GrammarExercise',
  'ListeningExercise',
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
            if (operation === 'delete') {
              operation = 'update';
              (args as Prisma.StudentUpdateArgs).data = { isArchived: true };
            }
            if (operation === 'deleteMany') {
              operation = 'updateMany';
              (args as Prisma.StudentUpdateManyArgs).data = {
                isArchived: true,
              };
            }
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
                (
                  args as
                  | Prisma.StudentFindManyArgs
                  | Prisma.StudentUpdateManyArgs
                ).where = { isArchived: false };
              }
            }
          }
          return query(args);
        },
      },
    },
  });
}

// Infer the type of our extended, more powerful client.
type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

declare global {
  var prisma: ExtendedPrismaClient | undefined;
}

export const prisma = globalThis.prisma || createPrismaClient();

// Export the extended client type for use in other parts of the application.
export type AppPrismaClient = typeof prisma;

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}
