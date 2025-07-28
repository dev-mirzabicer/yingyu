/*
  Warnings:

  - You are about to drop the column `lessonId` on the `ReviewHistory` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "StudentFsrsParams_studentId_key";

-- AlterTable
ALTER TABLE "ReviewHistory" DROP COLUMN "lessonId",
ADD COLUMN     "sessionId" UUID;

-- CreateIndex
CREATE INDEX "ReviewHistory_sessionId_idx" ON "ReviewHistory"("sessionId");

-- CreateIndex
CREATE INDEX "StudentFsrsParams_studentId_isActive_idx" ON "StudentFsrsParams"("studentId", "isActive");

-- AddForeignKey
ALTER TABLE "ReviewHistory" ADD CONSTRAINT "ReviewHistory_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;
