/*
  Warnings:

  - A unique constraint covering the columns `[fillInTheBlankDeckId]` on the table `UnitItem` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "JobType" ADD VALUE 'BULK_IMPORT_FILL_IN_THE_BLANK';

-- AlterEnum
ALTER TYPE "UnitItemType" ADD VALUE 'FILL_IN_THE_BLANK_EXERCISE';

-- AlterTable
ALTER TABLE "UnitItem" ADD COLUMN     "fillInTheBlankDeckId" UUID;

-- CreateTable
CREATE TABLE "FillInTheBlankDeck" (
    "id" UUID NOT NULL,
    "creatorId" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "originExerciseId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "boundVocabularyDeckId" UUID,

    CONSTRAINT "FillInTheBlankDeck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FillInTheBlankCard" (
    "id" UUID NOT NULL,
    "deckId" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "options" JSONB,
    "explanation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "boundVocabularyCardId" UUID,

    CONSTRAINT "FillInTheBlankCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentFillInTheBlankCardDone" (
    "studentId" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentFillInTheBlankCardDone_pkey" PRIMARY KEY ("studentId","cardId")
);

-- CreateIndex
CREATE INDEX "FillInTheBlankCard_deckId_idx" ON "FillInTheBlankCard"("deckId");

-- CreateIndex
CREATE UNIQUE INDEX "UnitItem_fillInTheBlankDeckId_key" ON "UnitItem"("fillInTheBlankDeckId");

-- AddForeignKey
ALTER TABLE "UnitItem" ADD CONSTRAINT "UnitItem_fillInTheBlankDeckId_fkey" FOREIGN KEY ("fillInTheBlankDeckId") REFERENCES "FillInTheBlankDeck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FillInTheBlankDeck" ADD CONSTRAINT "FillInTheBlankDeck_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FillInTheBlankDeck" ADD CONSTRAINT "FillInTheBlankDeck_boundVocabularyDeckId_fkey" FOREIGN KEY ("boundVocabularyDeckId") REFERENCES "VocabularyDeck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FillInTheBlankCard" ADD CONSTRAINT "FillInTheBlankCard_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "FillInTheBlankDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FillInTheBlankCard" ADD CONSTRAINT "FillInTheBlankCard_boundVocabularyCardId_fkey" FOREIGN KEY ("boundVocabularyCardId") REFERENCES "VocabularyCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFillInTheBlankCardDone" ADD CONSTRAINT "StudentFillInTheBlankCardDone_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFillInTheBlankCardDone" ADD CONSTRAINT "StudentFillInTheBlankCardDone_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "FillInTheBlankCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
