-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ProficiencyLevel" AS ENUM ('BEGINNER', 'ELEMENTARY', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ClassStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "CardState" AS ENUM ('NEW', 'LEARNING', 'REVIEW', 'RELEARNING');

-- CreateEnum
CREATE TYPE "ReviewType" AS ENUM ('VOCABULARY', 'LISTENING', 'SPELLING', 'GRAMMAR', 'GENERIC');

-- CreateEnum
CREATE TYPE "UnitItemType" AS ENUM ('VOCABULARY_DECK', 'GRAMMAR_EXERCISE', 'LISTENING_EXERCISE', 'FILL_IN_THE_BLANK_EXERCISE', 'GENERIC_DECK');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('INITIALIZE_CARD_STATES', 'INITIALIZE_LISTENING_CARD_STATES', 'GENERATE_PRACTICE_PDF', 'OPTIMIZE_FSRS_PARAMS', 'OPTIMIZE_LISTENING_FSRS_PARAMS', 'REBUILD_FSRS_CACHE', 'REBUILD_LISTENING_FSRS_CACHE', 'BULK_IMPORT_VOCABULARY', 'BULK_IMPORT_STUDENTS', 'BULK_IMPORT_SCHEDULES', 'BULK_IMPORT_FILL_IN_THE_BLANK', 'BULK_IMPORT_GENERIC_DECK');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "Teacher" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "validityUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherSettings" (
    "id" UUID NOT NULL,
    "teacherId" UUID NOT NULL,
    "paymentAlertThreshold" INTEGER NOT NULL DEFAULT 3,
    "preferredLessonDuration" INTEGER NOT NULL DEFAULT 60,

    CONSTRAINT "TeacherSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" UUID NOT NULL,
    "teacherId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "proficiencyLevel" "ProficiencyLevel" NOT NULL DEFAULT 'BEGINNER',
    "notes" TEXT,
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" UUID NOT NULL,
    "creatorId" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "estimatedMinimumDuration" INTEGER,
    "estimatedMaximumDuration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitItem" (
    "id" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "type" "UnitItemType" NOT NULL,
    "exerciseConfig" JSONB,
    "vocabularyDeckId" UUID,
    "grammarExerciseId" UUID,
    "listeningExerciseId" UUID,
    "fillInTheBlankDeckId" UUID,
    "genericDeckId" UUID,

    CONSTRAINT "UnitItem_pkey" PRIMARY KEY ("id")
);

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
    "progress" JSONB,

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

-- CreateTable
CREATE TABLE "VocabularyDeck" (
    "id" UUID NOT NULL,
    "creatorId" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "originExerciseId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VocabularyDeck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocabularyCard" (
    "id" UUID NOT NULL,
    "deckId" UUID NOT NULL,
    "englishWord" TEXT NOT NULL,
    "chineseTranslation" TEXT NOT NULL,
    "pinyin" TEXT,
    "ipaPronunciation" TEXT,
    "exampleSentences" JSONB,
    "wordType" TEXT,
    "difficultyLevel" INTEGER NOT NULL DEFAULT 1,
    "audioUrl" TEXT,
    "imageUrl" TEXT,
    "videoUrl" TEXT,
    "frequencyRank" INTEGER,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VocabularyCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrammarExercise" (
    "id" UUID NOT NULL,
    "creatorId" UUID,
    "title" TEXT NOT NULL,
    "grammarTopic" TEXT NOT NULL,
    "difficultyLevel" INTEGER NOT NULL DEFAULT 1,
    "exerciseData" JSONB NOT NULL,
    "explanation" TEXT,
    "tags" TEXT[],
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "originExerciseId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrammarExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListeningExercise" (
    "id" UUID NOT NULL,
    "creatorId" UUID,
    "title" TEXT NOT NULL,
    "vocabularyDeckId" UUID NOT NULL,
    "difficultyLevel" INTEGER NOT NULL DEFAULT 1,
    "explanation" TEXT,
    "tags" TEXT[],
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "originExerciseId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListeningExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FillInTheBlankDeck" (
    "id" UUID NOT NULL,
    "creatorId" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "originExerciseId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "boundVocabularyDeckId" UUID,

    CONSTRAINT "FillInTheBlankDeck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FillInTheBlankCard" (
    "id" UUID NOT NULL,
    "deckId" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "options" JSONB,
    "explanation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "boundVocabularyCardId" UUID,

    CONSTRAINT "FillInTheBlankCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentFillInTheBlankCardDone" (
    "studentId" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentFillInTheBlankCardDone_pkey" PRIMARY KEY ("studentId","cardId")
);

-- CreateTable
CREATE TABLE "GenericDeck" (
    "id" UUID NOT NULL,
    "creatorId" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "originExerciseId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "boundVocabularyDeckId" UUID,

    CONSTRAINT "GenericDeck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenericCard" (
    "id" UUID NOT NULL,
    "deckId" UUID NOT NULL,
    "front" TEXT NOT NULL,
    "back" TEXT NOT NULL,
    "exampleSentences" JSONB,
    "audioUrl" TEXT,
    "imageUrl" TEXT,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "boundVocabularyCardId" UUID,

    CONSTRAINT "GenericCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentDeck" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "deckId" UUID NOT NULL,
    "dailyNewCards" INTEGER NOT NULL DEFAULT 10,
    "dailyReviewLimit" INTEGER NOT NULL DEFAULT 50,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "StudentDeck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentCardState" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "stability" DOUBLE PRECISION NOT NULL,
    "difficulty" DOUBLE PRECISION NOT NULL,
    "due" TIMESTAMP(3) NOT NULL,
    "lastReview" TIMESTAMP(3),
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "state" "CardState" NOT NULL DEFAULT 'NEW',
    "averageResponseTimeMs" INTEGER NOT NULL DEFAULT 0,
    "consecutiveCorrect" INTEGER NOT NULL DEFAULT 0,
    "retrievability" DOUBLE PRECISION,
    "intervalDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentCardState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewHistory" (
    "id" BIGSERIAL NOT NULL,
    "studentId" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "sessionId" UUID,
    "reviewType" "ReviewType" NOT NULL,
    "rating" INTEGER NOT NULL,
    "responseTimeMs" INTEGER,
    "previousStability" DOUBLE PRECISION,
    "previousDifficulty" DOUBLE PRECISION,
    "previousDue" TIMESTAMP(3),
    "previousState" "CardState",
    "isLearningStep" BOOLEAN NOT NULL DEFAULT false,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentFsrsParams" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "w" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "optimizationScore" DOUBLE PRECISION,
    "trainingDataSize" INTEGER,
    "lastOptimized" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "StudentFsrsParams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListeningCardState" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "stability" DOUBLE PRECISION NOT NULL,
    "difficulty" DOUBLE PRECISION NOT NULL,
    "due" TIMESTAMP(3) NOT NULL,
    "lastReview" TIMESTAMP(3),
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "state" "CardState" NOT NULL DEFAULT 'NEW',
    "averageResponseTimeMs" INTEGER NOT NULL DEFAULT 0,
    "consecutiveCorrect" INTEGER NOT NULL DEFAULT 0,
    "retrievability" DOUBLE PRECISION,
    "intervalDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListeningCardState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListeningFsrsParams" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "w" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "optimizationScore" DOUBLE PRECISION,
    "trainingDataSize" INTEGER,
    "lastOptimized" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ListeningFsrsParams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentGenericCardState" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "stability" DOUBLE PRECISION NOT NULL,
    "difficulty" DOUBLE PRECISION NOT NULL,
    "due" TIMESTAMP(3) NOT NULL,
    "lastReview" TIMESTAMP(3),
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "state" "CardState" NOT NULL DEFAULT 'NEW',
    "averageResponseTimeMs" INTEGER NOT NULL DEFAULT 0,
    "consecutiveCorrect" INTEGER NOT NULL DEFAULT 0,
    "retrievability" DOUBLE PRECISION,
    "intervalDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentGenericCardState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenericFsrsParams" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "w" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "optimizationScore" DOUBLE PRECISION,
    "trainingDataSize" INTEGER,
    "lastOptimized" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "GenericFsrsParams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "classesPurchased" INTEGER NOT NULL,
    "classesUsed" INTEGER NOT NULL DEFAULT 0,
    "paymentDate" DATE NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassSchedule" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "scheduledTime" TIMESTAMP(3) NOT NULL,
    "status" "ClassStatus" NOT NULL DEFAULT 'SCHEDULED',
    "duration" INTEGER,
    "notes" TEXT,

    CONSTRAINT "ClassSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" UUID NOT NULL,
    "teacherId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_email_key" ON "Teacher"("email");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherSettings_teacherId_key" ON "TeacherSettings"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "UnitItem_vocabularyDeckId_key" ON "UnitItem"("vocabularyDeckId");

-- CreateIndex
CREATE UNIQUE INDEX "UnitItem_grammarExerciseId_key" ON "UnitItem"("grammarExerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "UnitItem_listeningExerciseId_key" ON "UnitItem"("listeningExerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "UnitItem_fillInTheBlankDeckId_key" ON "UnitItem"("fillInTheBlankDeckId");

-- CreateIndex
CREATE UNIQUE INDEX "UnitItem_genericDeckId_key" ON "UnitItem"("genericDeckId");

-- CreateIndex
CREATE INDEX "UnitItem_unitId_idx" ON "UnitItem"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_currentUnitItemId_key" ON "Session"("currentUnitItemId");

-- CreateIndex
CREATE INDEX "Job_status_type_idx" ON "Job"("status", "type");

-- CreateIndex
CREATE INDEX "FillInTheBlankCard_deckId_idx" ON "FillInTheBlankCard"("deckId");

-- CreateIndex
CREATE INDEX "GenericCard_deckId_idx" ON "GenericCard"("deckId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentDeck_studentId_deckId_key" ON "StudentDeck"("studentId", "deckId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentCardState_studentId_cardId_key" ON "StudentCardState"("studentId", "cardId");

-- CreateIndex
CREATE INDEX "ReviewHistory_studentId_cardId_idx" ON "ReviewHistory"("studentId", "cardId");

-- CreateIndex
CREATE INDEX "ReviewHistory_studentId_cardId_isLearningStep_idx" ON "ReviewHistory"("studentId", "cardId", "isLearningStep");

-- CreateIndex
CREATE INDEX "ReviewHistory_reviewedAt_idx" ON "ReviewHistory"("reviewedAt");

-- CreateIndex
CREATE INDEX "ReviewHistory_sessionId_idx" ON "ReviewHistory"("sessionId");

-- CreateIndex
CREATE INDEX "StudentFsrsParams_studentId_isActive_idx" ON "StudentFsrsParams"("studentId", "isActive");

-- CreateIndex
CREATE INDEX "ListeningCardState_studentId_due_idx" ON "ListeningCardState"("studentId", "due");

-- CreateIndex
CREATE INDEX "ListeningCardState_studentId_state_idx" ON "ListeningCardState"("studentId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "ListeningCardState_studentId_cardId_key" ON "ListeningCardState"("studentId", "cardId");

-- CreateIndex
CREATE INDEX "ListeningFsrsParams_studentId_isActive_idx" ON "ListeningFsrsParams"("studentId", "isActive");

-- CreateIndex
CREATE INDEX "StudentGenericCardState_studentId_due_idx" ON "StudentGenericCardState"("studentId", "due");

-- CreateIndex
CREATE INDEX "StudentGenericCardState_studentId_state_idx" ON "StudentGenericCardState"("studentId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "StudentGenericCardState_studentId_cardId_key" ON "StudentGenericCardState"("studentId", "cardId");

-- CreateIndex
CREATE INDEX "GenericFsrsParams_studentId_isActive_idx" ON "GenericFsrsParams"("studentId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_teacherId_expiresAt_idx" ON "AuthSession"("teacherId", "expiresAt");

-- AddForeignKey
ALTER TABLE "TeacherSettings" ADD CONSTRAINT "TeacherSettings_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitItem" ADD CONSTRAINT "UnitItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitItem" ADD CONSTRAINT "UnitItem_vocabularyDeckId_fkey" FOREIGN KEY ("vocabularyDeckId") REFERENCES "VocabularyDeck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitItem" ADD CONSTRAINT "UnitItem_grammarExerciseId_fkey" FOREIGN KEY ("grammarExerciseId") REFERENCES "GrammarExercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitItem" ADD CONSTRAINT "UnitItem_listeningExerciseId_fkey" FOREIGN KEY ("listeningExerciseId") REFERENCES "ListeningExercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitItem" ADD CONSTRAINT "UnitItem_fillInTheBlankDeckId_fkey" FOREIGN KEY ("fillInTheBlankDeckId") REFERENCES "FillInTheBlankDeck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitItem" ADD CONSTRAINT "UnitItem_genericDeckId_fkey" FOREIGN KEY ("genericDeckId") REFERENCES "GenericDeck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "VocabularyDeck" ADD CONSTRAINT "VocabularyDeck_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabularyCard" ADD CONSTRAINT "VocabularyCard_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "VocabularyDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrammarExercise" ADD CONSTRAINT "GrammarExercise_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListeningExercise" ADD CONSTRAINT "ListeningExercise_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListeningExercise" ADD CONSTRAINT "ListeningExercise_vocabularyDeckId_fkey" FOREIGN KEY ("vocabularyDeckId") REFERENCES "VocabularyDeck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FillInTheBlankDeck" ADD CONSTRAINT "FillInTheBlankDeck_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FillInTheBlankDeck" ADD CONSTRAINT "FillInTheBlankDeck_boundVocabularyDeckId_fkey" FOREIGN KEY ("boundVocabularyDeckId") REFERENCES "VocabularyDeck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FillInTheBlankCard" ADD CONSTRAINT "FillInTheBlankCard_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "FillInTheBlankDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FillInTheBlankCard" ADD CONSTRAINT "FillInTheBlankCard_boundVocabularyCardId_fkey" FOREIGN KEY ("boundVocabularyCardId") REFERENCES "VocabularyCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFillInTheBlankCardDone" ADD CONSTRAINT "StudentFillInTheBlankCardDone_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFillInTheBlankCardDone" ADD CONSTRAINT "StudentFillInTheBlankCardDone_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "FillInTheBlankCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenericDeck" ADD CONSTRAINT "GenericDeck_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenericDeck" ADD CONSTRAINT "GenericDeck_boundVocabularyDeckId_fkey" FOREIGN KEY ("boundVocabularyDeckId") REFERENCES "VocabularyDeck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenericCard" ADD CONSTRAINT "GenericCard_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "GenericDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenericCard" ADD CONSTRAINT "GenericCard_boundVocabularyCardId_fkey" FOREIGN KEY ("boundVocabularyCardId") REFERENCES "VocabularyCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDeck" ADD CONSTRAINT "StudentDeck_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDeck" ADD CONSTRAINT "StudentDeck_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "VocabularyDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCardState" ADD CONSTRAINT "StudentCardState_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCardState" ADD CONSTRAINT "StudentCardState_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "VocabularyCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewHistory" ADD CONSTRAINT "ReviewHistory_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewHistory" ADD CONSTRAINT "ReviewHistory_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFsrsParams" ADD CONSTRAINT "StudentFsrsParams_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListeningCardState" ADD CONSTRAINT "ListeningCardState_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListeningCardState" ADD CONSTRAINT "ListeningCardState_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "VocabularyCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListeningFsrsParams" ADD CONSTRAINT "ListeningFsrsParams_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGenericCardState" ADD CONSTRAINT "StudentGenericCardState_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGenericCardState" ADD CONSTRAINT "StudentGenericCardState_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "GenericCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenericFsrsParams" ADD CONSTRAINT "GenericFsrsParams_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSchedule" ADD CONSTRAINT "ClassSchedule_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
