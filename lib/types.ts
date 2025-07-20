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
      data: Omit<
        VocabularyDeck,
        'id' | 'creatorId' | 'createdAt' | 'updatedAt'
      >;
    }
  | {
      type: 'GRAMMAR_EXERCISE';
      data: Omit<
        GrammarExercise,
        'id' | 'creatorId' | 'createdAt' | 'updatedAt'
      >;
    }
  | {
      type: 'LISTENING_EXERCISE';
      data: Omit<
        ListeningExercise,
        'id' | 'creatorId' | 'createdAt' | 'updatedAt'
      >;
    }
  | {
      type: 'VOCAB_FILL_IN_BLANK_EXERCISE';
      data: Omit<
        VocabFillInBlankExercise,
        'id' | 'creatorId' | 'createdAt' | 'updatedAt'
      >;
    };

// A generic type for answer submissions, to be handled by the dispatcher.
export type AnswerPayload = {
  [key: string]: any; // This will be validated by the specific exercise handler.
};
