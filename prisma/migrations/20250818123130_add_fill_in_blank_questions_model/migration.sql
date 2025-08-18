-- AlterTable
ALTER TABLE "FillInBlankExercise" ADD COLUMN     "placeholderToken" TEXT NOT NULL DEFAULT '_____';

-- CreateTable
CREATE TABLE "FillInBlankQuestion" (
    "id" UUID NOT NULL,
    "exerciseId" UUID NOT NULL,
    "sentence" TEXT NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "vocabularyCardId" UUID,
    "distractors" TEXT[],
    "difficultyLevel" INTEGER NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FillInBlankQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FillInBlankQuestion_exerciseId_order_idx" ON "FillInBlankQuestion"("exerciseId", "order");

-- CreateIndex
CREATE INDEX "FillInBlankQuestion_exerciseId_isActive_idx" ON "FillInBlankQuestion"("exerciseId", "isActive");

-- AddForeignKey
ALTER TABLE "FillInBlankQuestion" ADD CONSTRAINT "FillInBlankQuestion_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "FillInBlankExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FillInBlankQuestion" ADD CONSTRAINT "FillInBlankQuestion_vocabularyCardId_fkey" FOREIGN KEY ("vocabularyCardId") REFERENCES "VocabularyCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
