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
  Lesson,
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

// The shape of a student's assigned deck, including the deck's details.
export type PopulatedStudentDeck = StudentDeck & {
  deck: VocabularyDeck;
};

export type FullStudentProfile = Student & {
  classesRemaining: number;
  payments: Payment[];
  studentDecks: PopulatedStudentDeck[];
  upcomingClasses: ClassSchedule[];
};

export type FullLessonState = Lesson & {
  student: Student;
  unit: FullUnit;
  currentUnitItem: PopulatedUnitItem | null;
};
