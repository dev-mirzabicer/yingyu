/*
  Warnings:

  - You are about to drop the column `audioUrl` on the `ListeningExercise` table. All the data in the column will be lost.
  - You are about to drop the column `correctSpelling` on the `ListeningExercise` table. All the data in the column will be lost.
  - Added the required column `vocabularyDeckId` to the `ListeningExercise` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JobType" ADD VALUE 'INITIALIZE_LISTENING_CARD_STATES';
ALTER TYPE "JobType" ADD VALUE 'OPTIMIZE_LISTENING_FSRS_PARAMS';
ALTER TYPE "JobType" ADD VALUE 'REBUILD_LISTENING_FSRS_CACHE';

-- AlterTable
ALTER TABLE "ListeningExercise" DROP COLUMN "audioUrl",
DROP COLUMN "correctSpelling",
ADD COLUMN     "vocabularyDeckId" UUID NOT NULL;

-- CreateTable
CREATE TABLE "ListeningCardState" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "stability" DOUBLE PRECISION NOT NULL,
    "difficulty" DOUBLE PRECISION NOT NULL,
    "due" TIMESTAMP(3) NOT NULL,
    "lastReview" TIMESTAMP(3),
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "state" "CardState" NOT NULL DEFAULT 'NEW',
    "averageResponseTimeMs" INTEGER NOT NULL DEFAULT 0,
    "consecutiveCorrect" INTEGER NOT NULL DEFAULT 0,
    "retrievability" DOUBLE PRECISION,
    "intervalDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListeningCardState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListeningFsrsParams" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "w" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "optimizationScore" DOUBLE PRECISION,
    "trainingDataSize" INTEGER,
    "lastOptimized" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ListeningFsrsParams_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListeningCardState_studentId_due_idx" ON "ListeningCardState"("studentId", "due");

-- CreateIndex
CREATE INDEX "ListeningCardState_studentId_state_idx" ON "ListeningCardState"("studentId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "ListeningCardState_studentId_cardId_key" ON "ListeningCardState"("studentId", "cardId");

-- CreateIndex
CREATE INDEX "ListeningFsrsParams_studentId_isActive_idx" ON "ListeningFsrsParams"("studentId", "isActive");

-- AddForeignKey
ALTER TABLE "ListeningExercise" ADD CONSTRAINT "ListeningExercise_vocabularyDeckId_fkey" FOREIGN KEY ("vocabularyDeckId") REFERENCES "VocabularyDeck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListeningCardState" ADD CONSTRAINT "ListeningCardState_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListeningCardState" ADD CONSTRAINT "ListeningCardState_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "VocabularyCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListeningFsrsParams" ADD CONSTRAINT "ListeningFsrsParams_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
