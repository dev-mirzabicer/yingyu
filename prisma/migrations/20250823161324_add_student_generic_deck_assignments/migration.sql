-- CreateTable
CREATE TABLE "StudentGenericDeck" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "deckId" UUID NOT NULL,
    "dailyNewCards" INTEGER NOT NULL DEFAULT 10,
    "dailyReviewLimit" INTEGER NOT NULL DEFAULT 50,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "StudentGenericDeck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentGenericDeck_studentId_deckId_key" ON "StudentGenericDeck"("studentId", "deckId");

-- AddForeignKey
ALTER TABLE "StudentGenericDeck" ADD CONSTRAINT "StudentGenericDeck_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGenericDeck" ADD CONSTRAINT "StudentGenericDeck_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "GenericDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
