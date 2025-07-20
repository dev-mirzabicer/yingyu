/*
  Warnings:

  - You are about to drop the column `createdAt` on the `ClassSchedule` table. All the data in the column will be lost.
  - You are about to drop the column `durationMinutes` on the `ClassSchedule` table. All the data in the column will be lost.
  - You are about to drop the column `effectivenessRating` on the `ClassSchedule` table. All the data in the column will be lost.
  - You are about to drop the column `studentFeedback` on the `ClassSchedule` table. All the data in the column will be lost.
  - You are about to drop the column `teacherNotes` on the `ClassSchedule` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `ClassSchedule` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `currency` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `expiryDate` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `paymentMethod` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `receiptUrl` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `avatarUrl` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `learningGoal` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `totalLessons` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `totalStudyTimeMinutes` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `weeklyStudyHours` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `autoScheduleNextClass` on the `TeacherSettings` table. All the data in the column will be lost.
  - You are about to drop the column `dashboardLayout` on the `TeacherSettings` table. All the data in the column will be lost.
  - You are about to drop the column `notificationPreferences` on the `TeacherSettings` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `TeacherSettings` table. All the data in the column will be lost.
  - You are about to drop the column `tags` on the `Unit` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `VocabularyDeck` table. All the data in the column will be lost.
  - You are about to drop the column `difficultyLevel` on the `VocabularyDeck` table. All the data in the column will be lost.
  - You are about to drop the column `tags` on the `VocabularyDeck` table. All the data in the column will be lost.
  - You are about to drop the column `totalCards` on the `VocabularyDeck` table. All the data in the column will be lost.
  - You are about to drop the `Lesson` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `type` to the `UnitItem` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UnitItemType" AS ENUM ('FSRS_REVIEW_SESSION', 'VOCABULARY_DECK', 'GRAMMAR_EXERCISE', 'LISTENING_EXERCISE', 'VOCAB_FILL_IN_BLANK_EXERCISE');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('INITIALIZE_CARD_STATES', 'GENERATE_PRACTICE_PDF', 'OPTIMIZE_FSRS_PARAMS');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- DropForeignKey
ALTER TABLE "Lesson" DROP CONSTRAINT "Lesson_classScheduleId_fkey";

-- DropForeignKey
ALTER TABLE "Lesson" DROP CONSTRAINT "Lesson_studentId_fkey";

-- DropForeignKey
ALTER TABLE "Lesson" DROP CONSTRAINT "Lesson_teacherId_fkey";

-- DropForeignKey
ALTER TABLE "ReviewHistory" DROP CONSTRAINT "ReviewHistory_lessonId_fkey";

-- AlterTable
ALTER TABLE "ClassSchedule" DROP COLUMN "createdAt",
DROP COLUMN "durationMinutes",
DROP COLUMN "effectivenessRating",
DROP COLUMN "studentFeedback",
DROP COLUMN "teacherNotes",
DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "createdAt",
DROP COLUMN "currency",
DROP COLUMN "expiryDate",
DROP COLUMN "notes",
DROP COLUMN "paymentMethod",
DROP COLUMN "receiptUrl",
DROP COLUMN "status";

-- AlterTable
ALTER TABLE "Student" DROP COLUMN "avatarUrl",
DROP COLUMN "learningGoal",
DROP COLUMN "totalLessons",
DROP COLUMN "totalStudyTimeMinutes",
DROP COLUMN "weeklyStudyHours";

-- AlterTable
ALTER TABLE "TeacherSettings" DROP COLUMN "autoScheduleNextClass",
DROP COLUMN "dashboardLayout",
DROP COLUMN "notificationPreferences",
DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "Unit" DROP COLUMN "tags";

-- AlterTable
ALTER TABLE "UnitItem" ADD COLUMN     "type" "UnitItemType" NOT NULL;

-- AlterTable
ALTER TABLE "VocabularyDeck" DROP COLUMN "category",
DROP COLUMN "difficultyLevel",
DROP COLUMN "tags",
DROP COLUMN "totalCards";

-- DropTable
DROP TABLE "Lesson";

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "teacherId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "currentUnitItemId" UUID,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_currentUnitItemId_key" ON "Session"("currentUnitItemId");

-- CreateIndex
CREATE INDEX "Job_status_type_idx" ON "Job"("status", "type");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_currentUnitItemId_fkey" FOREIGN KEY ("currentUnitItemId") REFERENCES "UnitItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
