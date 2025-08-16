/*
  Warnings:

  - The values [VOCAB_FILL_IN_BLANK_EXERCISE] on the enum `UnitItemType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `vocabFillInBlankExerciseId` on the `UnitItem` table. All the data in the column will be lost.
  - You are about to drop the `VocabFillInBlankExercise` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "UnitItemType_new" AS ENUM ('VOCABULARY_DECK', 'GRAMMAR_EXERCISE', 'LISTENING_EXERCISE');
ALTER TABLE "UnitItem" ALTER COLUMN "type" TYPE "UnitItemType_new" USING ("type"::text::"UnitItemType_new");
ALTER TYPE "UnitItemType" RENAME TO "UnitItemType_old";
ALTER TYPE "UnitItemType_new" RENAME TO "UnitItemType";
DROP TYPE "UnitItemType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "UnitItem" DROP CONSTRAINT "UnitItem_vocabFillInBlankExerciseId_fkey";

-- DropForeignKey
ALTER TABLE "VocabFillInBlankExercise" DROP CONSTRAINT "VocabFillInBlankExercise_creatorId_fkey";

-- DropIndex
DROP INDEX "UnitItem_vocabFillInBlankExerciseId_key";

-- AlterTable
ALTER TABLE "UnitItem" DROP COLUMN "vocabFillInBlankExerciseId";

-- DropTable
DROP TABLE "VocabFillInBlankExercise";
