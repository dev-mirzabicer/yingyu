import { PrismaClient } from '@prisma/client';

// Declare a global variable to hold the Prisma Client instance.
// This is a workaround to persist the client across hot reloads in development.
declare global {
  var prisma: PrismaClient | undefined;
}

// Instantiate the Prisma Client.
// If we are in a development environment and a prisma instance already exists on the global object,
// we use that existing instance. Otherwise, we create a new one.
// In production, `globalThis.prisma` will always be undefined, so a new client is always created.
export const prisma = globalThis.prisma || new PrismaClient({
  // Optional: Add logging to see the queries being executed by Prisma.
  // This is very useful for debugging during development.
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// If we are in development, we assign the newly created prisma instance to the global object.
// This ensures that on the next hot reload, we reuse the existing connection.
if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}
