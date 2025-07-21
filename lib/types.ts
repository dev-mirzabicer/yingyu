import {
  Unit,
  UnitItem,
  VocabularyDeck,
  GrammarExercise,
  ListeningExercise,
  VocabFillInBlankExercise,
  Student,
  Payment,
  StudentDeck,
  ClassSchedule,
  Session,
  Prisma,
} from '@prisma/client';

export type PopulatedUnitItem = UnitItem & {
  vocabularyDeck: (VocabularyDeck & { cards: { id: string }[] }) | null;
  grammarExercise: GrammarExercise | null;
  listeningExercise: ListeningExercise | null;
  vocabFillInBlankExercise: VocabFillInBlankExercise | null;
};

export type FullUnit = Unit & {
  items: PopulatedUnitItem[];
};

export type PopulatedStudentDeck = StudentDeck & {
  deck: VocabularyDeck;
};

export type FullStudentProfile = Student & {
  classesRemaining: number;
  payments: Payment[];
  studentDecks: PopulatedStudentDeck[];
  upcomingClasses: ClassSchedule[];
};

// RENAMED and UPDATED: The complete state of a session, giving the frontend everything it needs.
export type FullSessionState = Session & {
  student: Student;
  unit: FullUnit;
  currentUnitItem: PopulatedUnitItem | null;
};

// --- Input/Data Transfer Object Types ---

export type NewUnitItemData =
  | {
      type: 'VOCABULARY_DECK';
      data: {
        name: string;
        description?: string;
        isPublic?: boolean;
      };
    }
  | {
      type: 'GRAMMAR_EXERCISE';
      data: {
        title: string;
        grammarTopic: string;
        difficultyLevel?: number;
        exerciseData: Prisma.InputJsonValue; // Use the correct input type
        explanation?: string;
        tags?: string[];
        isPublic?: boolean;
      };
    }
  | {
      type: 'LISTENING_EXERCISE';
      data: {
        title: string;
        difficultyLevel?: number;
        audioUrl: string;
        correctSpelling: string;
        explanation?: string;
        tags?: string[];
        isPublic?: boolean;
      };
    }
  | {
      type: 'VOCAB_FILL_IN_BLANK_EXERCISE';
      data: {
        title: string;
        difficultyLevel?: number;
        exerciseData: Prisma.InputJsonValue; // Use the correct input type
        explanation?: string;
        tags?: string[];
        isPublic?: boolean;
      };
    };

// A generic type for answer submissions, to be handled by the dispatcher.
export type AnswerPayload = {
  [key: string]: unknown; // This will be validated by the specific exercise handler.
};
