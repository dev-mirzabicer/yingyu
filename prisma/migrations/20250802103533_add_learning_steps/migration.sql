-- AlterTable
ALTER TABLE "ReviewHistory" ADD COLUMN     "isLearningStep" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "ReviewHistory_studentId_cardId_isLearningStep_idx" ON "ReviewHistory"("studentId", "cardId", "isLearningStep");
