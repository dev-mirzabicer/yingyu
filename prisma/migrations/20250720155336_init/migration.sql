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
CREATE TYPE "ReviewType" AS ENUM ('VOCABULARY', 'LISTENING', 'SPELLING', 'GRAMMAR');

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

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherSettings" (
    "id" UUID NOT NULL,
    "teacherId" UUID NOT NULL,
    "paymentAlertThreshold" INTEGER NOT NULL DEFAULT 3,
    "autoScheduleNextClass" BOOLEAN NOT NULL DEFAULT true,
    "preferredLessonDuration" INTEGER NOT NULL DEFAULT 60,
    "dashboardLayout" JSONB NOT NULL DEFAULT '{"view": "grid", "sortBy": "nextClass"}',
    "notificationPreferences" JSONB NOT NULL DEFAULT '{"email": true, "inApp": true}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

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
    "learningGoal" TEXT,
    "weeklyStudyHours" INTEGER NOT NULL DEFAULT 3,
    "notes" TEXT,
    "avatarUrl" TEXT,
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "totalLessons" INTEGER NOT NULL DEFAULT 0,
    "totalStudyTimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "classesPurchased" INTEGER NOT NULL,
    "classesUsed" INTEGER NOT NULL DEFAULT 0,
    "paymentDate" DATE NOT NULL,
    "expiryDate" DATE,
    "paymentMethod" TEXT,
    "receiptUrl" TEXT,
    "notes" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassSchedule" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "scheduledTime" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "status" "ClassStatus" NOT NULL DEFAULT 'SCHEDULED',
    "teacherNotes" TEXT,
    "studentFeedback" TEXT,
    "effectivenessRating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" UUID NOT NULL,
    "creatorId" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tags" TEXT[],
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitItem" (
    "id" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "vocabularyDeckId" UUID,
    "grammarExerciseId" UUID,
    "listeningExerciseId" UUID,
    "vocabFillInBlankExerciseId" UUID,

    CONSTRAINT "UnitItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocabularyDeck" (
    "id" UUID NOT NULL,
    "creatorId" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "difficultyLevel" INTEGER,
    "totalCards" INTEGER NOT NULL DEFAULT 0,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[],
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrammarExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListeningExercise" (
    "id" UUID NOT NULL,
    "creatorId" UUID,
    "title" TEXT NOT NULL,
    "difficultyLevel" INTEGER NOT NULL DEFAULT 1,
    "audioUrl" TEXT NOT NULL,
    "correctSpelling" TEXT NOT NULL,
    "explanation" TEXT,
    "tags" TEXT[],
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListeningExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocabFillInBlankExercise" (
    "id" UUID NOT NULL,
    "creatorId" UUID,
    "title" TEXT NOT NULL,
    "difficultyLevel" INTEGER NOT NULL DEFAULT 1,
    "exerciseData" JSONB NOT NULL,
    "explanation" TEXT,
    "tags" TEXT[],
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VocabFillInBlankExercise_pkey" PRIMARY KEY ("id")
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
    "lessonId" UUID,
    "reviewType" "ReviewType" NOT NULL,
    "rating" INTEGER NOT NULL,
    "responseTimeMs" INTEGER,
    "previousStability" DOUBLE PRECISION,
    "previousDifficulty" DOUBLE PRECISION,
    "previousDue" TIMESTAMP(3),
    "previousState" "CardState",
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
CREATE TABLE "Lesson" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "teacherId" UUID NOT NULL,
    "classScheduleId" UUID,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "lessonSummary" TEXT,
    "homeworkAssigned" JSONB,
    "nextLessonNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "UnitItem_vocabFillInBlankExerciseId_key" ON "UnitItem"("vocabFillInBlankExerciseId");

-- CreateIndex
CREATE INDEX "UnitItem_unitId_idx" ON "UnitItem"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentDeck_studentId_deckId_key" ON "StudentDeck"("studentId", "deckId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentCardState_studentId_cardId_key" ON "StudentCardState"("studentId", "cardId");

-- CreateIndex
CREATE INDEX "ReviewHistory_studentId_cardId_idx" ON "ReviewHistory"("studentId", "cardId");

-- CreateIndex
CREATE INDEX "ReviewHistory_reviewedAt_idx" ON "ReviewHistory"("reviewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentFsrsParams_studentId_key" ON "StudentFsrsParams"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_classScheduleId_key" ON "Lesson"("classScheduleId");

-- AddForeignKey
ALTER TABLE "TeacherSettings" ADD CONSTRAINT "TeacherSettings_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSchedule" ADD CONSTRAINT "ClassSchedule_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitItem" ADD CONSTRAINT "UnitItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitItem" ADD CONSTRAINT "UnitItem_vocabularyDeckId_fkey" FOREIGN KEY ("vocabularyDeckId") REFERENCES "VocabularyDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitItem" ADD CONSTRAINT "UnitItem_grammarExerciseId_fkey" FOREIGN KEY ("grammarExerciseId") REFERENCES "GrammarExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitItem" ADD CONSTRAINT "UnitItem_listeningExerciseId_fkey" FOREIGN KEY ("listeningExerciseId") REFERENCES "ListeningExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitItem" ADD CONSTRAINT "UnitItem_vocabFillInBlankExerciseId_fkey" FOREIGN KEY ("vocabFillInBlankExerciseId") REFERENCES "VocabFillInBlankExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabularyDeck" ADD CONSTRAINT "VocabularyDeck_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabularyCard" ADD CONSTRAINT "VocabularyCard_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "VocabularyDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrammarExercise" ADD CONSTRAINT "GrammarExercise_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListeningExercise" ADD CONSTRAINT "ListeningExercise_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabFillInBlankExercise" ADD CONSTRAINT "VocabFillInBlankExercise_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "ReviewHistory" ADD CONSTRAINT "ReviewHistory_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFsrsParams" ADD CONSTRAINT "StudentFsrsParams_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_classScheduleId_fkey" FOREIGN KEY ("classScheduleId") REFERENCES "ClassSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
