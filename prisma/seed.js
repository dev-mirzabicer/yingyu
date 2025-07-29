// JavaScript version of the seed script for Docker container compatibility
// This avoids the ts-node dependency issues in the Alpine container

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Start seeding database...');

  try {
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
    console.log(`✅ Upserted default teacher with ID: ${teacher.id}`);

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
      console.log(`✅ Created seed deck '${deck.name}' with ID: ${deck.id}`);
    } else {
      console.log(`✅ Found existing seed deck '${deck.name}' with ID: ${deck.id}`);
    }

    // --- Seed Vocabulary Cards ---
    // Use the deck's ID (either found or newly created) to create cards.
    const cardsToCreate = [
      { deckId: deck.id, englishWord: 'House', chineseTranslation: '房子' },
      { deckId: deck.id, englishWord: 'Table', chineseTranslation: '桌子' },
      { deckId: deck.id, englishWord: 'Chair', chineseTranslation: '椅子' },
      { deckId: deck.id, englishWord: 'Book', chineseTranslation: '书' },
      { deckId: deck.id, englishWord: 'Pen', chineseTranslation: '笔' },
      { deckId: deck.id, englishWord: 'Water', chineseTranslation: '水' },
      { deckId: deck.id, englishWord: 'Food', chineseTranslation: '食物' },
      { deckId: deck.id, englishWord: 'Time', chineseTranslation: '时间' },
      { deckId: deck.id, englishWord: 'Money', chineseTranslation: '钱' },
      { deckId: deck.id, englishWord: 'Friend', chineseTranslation: '朋友' },
    ];

    // To make this idempotent, we check if cards for this deck already exist.
    const existingCardsCount = await prisma.vocabularyCard.count({
      where: { deckId: deck.id },
    });

    if (existingCardsCount === 0) {
      await prisma.vocabularyCard.createMany({
        data: cardsToCreate,
      });
      console.log(`✅ Seeded ${cardsToCreate.length} cards for deck '${deck.name}'.`);
    } else {
      console.log(`✅ Deck '${deck.name}' already has cards (${existingCardsCount}), skipping card seed.`);
    }

    // --- Seed Sample Unit ---
    let unit = await prisma.unit.findFirst({
      where: {
        name: 'Beginner Vocabulary',
        creatorId: teacher.id,
      },
    });

    if (!unit) {
      unit = await prisma.unit.create({
        data: {
          name: 'Beginner Vocabulary',
          description: 'Basic vocabulary for English learners',
          creatorId: teacher.id,
          isPublic: true,
        },
      });
      console.log(`✅ Created sample unit '${unit.name}' with ID: ${unit.id}`);

      // Add the vocabulary deck to the unit
      await prisma.unitItem.create({
        data: {
          unitId: unit.id,
          type: 'VOCABULARY_DECK',
          vocabularyDeckId: deck.id,
          order: 0,
          exerciseConfig: {
            newCardsPerSession: 5,
            maxReviewsPerSession: 20,
          },
        },
      });
      console.log(`✅ Added vocabulary deck to unit as first item`);
    } else {
      console.log(`✅ Found existing sample unit '${unit.name}' with ID: ${unit.id}`);
    }

    console.log('🎉 Seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Fatal seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('🔒 Database connection closed');
  });
