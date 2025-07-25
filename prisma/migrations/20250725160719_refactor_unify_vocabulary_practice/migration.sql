/*
  Warnings:

  - The values [FSRS_REVIEW_SESSION] on the enum `UnitItemType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
ALTER TYPE "JobType" ADD VALUE 'REBUILD_FSRS_CACHE';

-- AlterEnum
BEGIN;
CREATE TYPE "UnitItemType_new" AS ENUM ('VOCABULARY_DECK', 'GRAMMAR_EXERCISE', 'LISTENING_EXERCISE', 'VOCAB_FILL_IN_BLANK_EXERCISE');
ALTER TABLE "UnitItem" ALTER COLUMN "type" TYPE "UnitItemType_new" USING ("type"::text::"UnitItemType_new");
ALTER TYPE "UnitItemType" RENAME TO "UnitItemType_old";
ALTER TYPE "UnitItemType_new" RENAME TO "UnitItemType";
DROP TYPE "UnitItemType_old";
COMMIT;

-- AlterTable
ALTER TABLE "UnitItem" ADD COLUMN     "exerciseConfig" JSONB;
