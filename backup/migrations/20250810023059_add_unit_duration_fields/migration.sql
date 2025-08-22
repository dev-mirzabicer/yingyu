-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."JobType" ADD VALUE 'BULK_IMPORT_VOCABULARY';
ALTER TYPE "public"."JobType" ADD VALUE 'BULK_IMPORT_STUDENTS';
ALTER TYPE "public"."JobType" ADD VALUE 'BULK_IMPORT_SCHEDULES';

-- AlterTable
ALTER TABLE "public"."ClassSchedule" ADD COLUMN     "duration" INTEGER;

-- AlterTable
ALTER TABLE "public"."Payment" ADD COLUMN     "status" "public"."PaymentStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "public"."Unit" ADD COLUMN     "estimatedMaximumDuration" INTEGER,
ADD COLUMN     "estimatedMinimumDuration" INTEGER;
