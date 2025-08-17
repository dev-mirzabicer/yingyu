/*
  Warnings:

  - A unique constraint covering the columns `[fillInBlankExerciseId]` on the table `UnitItem` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "UnitItemType" ADD VALUE 'FILL_IN_BLANK_EXERCISE';

-- AlterTable
ALTER TABLE "UnitItem" ADD COLUMN     "fillInBlankExerciseId" UUID;

-- CreateTable
CREATE TABLE "FillInBlankExercise" (
    "id" UUID NOT NULL,
    "creatorId" UUID,
    "title" TEXT NOT NULL,
    "vocabularyDeckId" UUID NOT NULL,
    "difficultyLevel" INTEGER NOT NULL DEFAULT 1,
    "explanation" TEXT,
    "tags" TEXT[],
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "originExerciseId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FillInBlankExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FillInBlankCardState" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "isSeen" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "lastResult" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FillInBlankCardState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FillInBlankCardState_studentId_isSeen_idx" ON "FillInBlankCardState"("studentId", "isSeen");

-- CreateIndex
CREATE INDEX "FillInBlankCardState_studentId_cardId_idx" ON "FillInBlankCardState"("studentId", "cardId");

-- CreateIndex
CREATE UNIQUE INDEX "FillInBlankCardState_studentId_cardId_key" ON "FillInBlankCardState"("studentId", "cardId");

-- CreateIndex
CREATE UNIQUE INDEX "UnitItem_fillInBlankExerciseId_key" ON "UnitItem"("fillInBlankExerciseId");

-- AddForeignKey
ALTER TABLE "UnitItem" ADD CONSTRAINT "UnitItem_fillInBlankExerciseId_fkey" FOREIGN KEY ("fillInBlankExerciseId") REFERENCES "FillInBlankExercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FillInBlankExercise" ADD CONSTRAINT "FillInBlankExercise_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FillInBlankExercise" ADD CONSTRAINT "FillInBlankExercise_vocabularyDeckId_fkey" FOREIGN KEY ("vocabularyDeckId") REFERENCES "VocabularyDeck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FillInBlankCardState" ADD CONSTRAINT "FillInBlankCardState_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FillInBlankCardState" ADD CONSTRAINT "FillInBlankCardState_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "VocabularyCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
