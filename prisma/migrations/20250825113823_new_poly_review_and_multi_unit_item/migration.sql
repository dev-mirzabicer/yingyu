/*
  Warnings:

  - You are about to drop the `ReviewHistory` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ReviewHistory" DROP CONSTRAINT "ReviewHistory_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "ReviewHistory" DROP CONSTRAINT "ReviewHistory_studentId_fkey";

-- DropIndex
DROP INDEX "UnitItem_fillInTheBlankDeckId_key";

-- DropIndex
DROP INDEX "UnitItem_genericDeckId_key";

-- DropIndex
DROP INDEX "UnitItem_grammarExerciseId_key";

-- DropIndex
DROP INDEX "UnitItem_listeningExerciseId_key";

-- DropIndex
DROP INDEX "UnitItem_vocabularyDeckId_key";

-- DropTable
DROP TABLE "ReviewHistory";

-- CreateTable
CREATE TABLE "VocabularyReviewHistory" (
    "id" BIGSERIAL NOT NULL,
    "studentId" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "sessionId" UUID,
    "rating" INTEGER NOT NULL,
    "responseTimeMs" INTEGER,
    "previousStability" DOUBLE PRECISION,
    "previousDifficulty" DOUBLE PRECISION,
    "previousDue" TIMESTAMP(3),
    "previousState" "CardState",
    "isLearningStep" BOOLEAN NOT NULL DEFAULT false,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VocabularyReviewHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenericReviewHistory" (
    "id" BIGSERIAL NOT NULL,
    "studentId" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "sessionId" UUID,
    "rating" INTEGER NOT NULL,
    "responseTimeMs" INTEGER,
    "previousStability" DOUBLE PRECISION,
    "previousDifficulty" DOUBLE PRECISION,
    "previousDue" TIMESTAMP(3),
    "previousState" "CardState",
    "isLearningStep" BOOLEAN NOT NULL DEFAULT false,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenericReviewHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VocabularyReviewHistory_studentId_cardId_idx" ON "VocabularyReviewHistory"("studentId", "cardId");

-- CreateIndex
CREATE INDEX "VocabularyReviewHistory_studentId_cardId_isLearningStep_idx" ON "VocabularyReviewHistory"("studentId", "cardId", "isLearningStep");

-- CreateIndex
CREATE INDEX "VocabularyReviewHistory_reviewedAt_idx" ON "VocabularyReviewHistory"("reviewedAt");

-- CreateIndex
CREATE INDEX "VocabularyReviewHistory_sessionId_idx" ON "VocabularyReviewHistory"("sessionId");

-- CreateIndex
CREATE INDEX "GenericReviewHistory_studentId_cardId_idx" ON "GenericReviewHistory"("studentId", "cardId");

-- CreateIndex
CREATE INDEX "GenericReviewHistory_studentId_cardId_isLearningStep_idx" ON "GenericReviewHistory"("studentId", "cardId", "isLearningStep");

-- CreateIndex
CREATE INDEX "GenericReviewHistory_reviewedAt_idx" ON "GenericReviewHistory"("reviewedAt");

-- CreateIndex
CREATE INDEX "GenericReviewHistory_sessionId_idx" ON "GenericReviewHistory"("sessionId");

-- AddForeignKey
ALTER TABLE "VocabularyReviewHistory" ADD CONSTRAINT "VocabularyReviewHistory_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabularyReviewHistory" ADD CONSTRAINT "VocabularyReviewHistory_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "VocabularyCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabularyReviewHistory" ADD CONSTRAINT "VocabularyReviewHistory_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenericReviewHistory" ADD CONSTRAINT "GenericReviewHistory_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenericReviewHistory" ADD CONSTRAINT "GenericReviewHistory_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "GenericCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenericReviewHistory" ADD CONSTRAINT "GenericReviewHistory_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;
