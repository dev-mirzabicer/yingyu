-- AlterEnum
ALTER TYPE "JobStatus" ADD VALUE 'SKIPPED';

-- DropForeignKey
ALTER TABLE "UnitItem" DROP CONSTRAINT "UnitItem_grammarExerciseId_fkey";

-- DropForeignKey
ALTER TABLE "UnitItem" DROP CONSTRAINT "UnitItem_listeningExerciseId_fkey";

-- DropForeignKey
ALTER TABLE "UnitItem" DROP CONSTRAINT "UnitItem_vocabFillInBlankExerciseId_fkey";

-- DropForeignKey
ALTER TABLE "UnitItem" DROP CONSTRAINT "UnitItem_vocabularyDeckId_fkey";

-- AlterTable
ALTER TABLE "GrammarExercise" ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "originExerciseId" UUID;

-- AlterTable
ALTER TABLE "ListeningExercise" ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "originExerciseId" UUID;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "progress" JSONB;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "VocabFillInBlankExercise" ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "originExerciseId" UUID;

-- AlterTable
ALTER TABLE "VocabularyDeck" ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "originExerciseId" UUID;

-- AddForeignKey
ALTER TABLE "UnitItem" ADD CONSTRAINT "UnitItem_vocabularyDeckId_fkey" FOREIGN KEY ("vocabularyDeckId") REFERENCES "VocabularyDeck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitItem" ADD CONSTRAINT "UnitItem_grammarExerciseId_fkey" FOREIGN KEY ("grammarExerciseId") REFERENCES "GrammarExercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitItem" ADD CONSTRAINT "UnitItem_listeningExerciseId_fkey" FOREIGN KEY ("listeningExerciseId") REFERENCES "ListeningExercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitItem" ADD CONSTRAINT "UnitItem_vocabFillInBlankExerciseId_fkey" FOREIGN KEY ("vocabFillInBlankExerciseId") REFERENCES "VocabFillInBlankExercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;
