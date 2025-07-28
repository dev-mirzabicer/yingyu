// This script seeds the database with essential initial data for development.
// It allows us to start with a clean slate that includes necessary records,
// like a default teacher and content, so we can immediately start testing our API.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding ...');

  // --- Seed Teacher ---
  const teacher = await prisma.teacher.upsert({
    where: { email: 'teacher@example.com' },
    update: {},
    create: {
      email: 'teacher@example.com',
      name: 'Default Teacher',
      passwordHash: 'placeholder_hash',
    },
  });
  console.log(`Upserted default teacher with ID: ${teacher.id}`);

  // --- Seed Vocabulary Deck (Corrected Logic) ---
  // 1. Attempt to find the deck first.
  let deck = await prisma.vocabularyDeck.findFirst({
    where: {
      name: 'Default Seed Deck',
      creatorId: teacher.id,
    },
  });

  // 2. If the deck doesn't exist, create it.
  if (!deck) {
    deck = await prisma.vocabularyDeck.create({
      data: {
        name: 'Default Seed Deck',
        description: 'A deck created automatically by the seed script.',
        creatorId: teacher.id,
      },
    });
    console.log(`Created seed deck '${deck.name}' with ID: ${deck.id}`);
  } else {
    console.log(`Found existing seed deck '${deck.name}' with ID: ${deck.id}`);
  }

  // --- Seed Vocabulary Cards ---
  // Use the deck's ID (either found or newly created) to create cards.
  const cardsToCreate = [
    { deckId: deck.id, englishWord: 'House', chineseTranslation: '房子' },
    { deckId: deck.id, englishWord: 'Table', chineseTranslation: '桌子' },
    { deckId: deck.id, englishWord: 'Chair', chineseTranslation: '椅子' },
    { deckId: deck.id, englishWord: 'Book', chineseTranslation: '书' },
    { deckId: deck.id, englishWord: 'Pen', chineseTranslation: '笔' },
  ];

  // To make this idempotent, we check if cards for this deck already exist.
  const existingCardsCount = await prisma.vocabularyCard.count({
    where: { deckId: deck.id },
  });

  if (existingCardsCount === 0) {
    await prisma.vocabularyCard.createMany({
      data: cardsToCreate,
    });
    console.log(`Seeded ${cardsToCreate.length} cards for deck '${deck.name}'.`);
  } else {
    console.log(`Deck '${deck.name}' already has cards, skipping card seed.`);
  }

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
