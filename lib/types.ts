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
  VocabularyCard,
  StudentCardState,
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

// ================================================================= //
// DEFINITIVE STATE & DTO CONTRACTS (v5.0)
// ================================================================= //

/**
 * The definitive structure for all answer submissions from the frontend.
 * This contract enforces that every user action has a clear, explicit intent.
 */
export type AnswerPayload = {
  /**
   * The specific, enumerated action the user is performing. This determines
   * which ProgressOperator the handler will dispatch to.
   */
  action: 'REVEAL_ANSWER' | 'SUBMIT_RATING' | 'SUBMIT_TEXT_ANSWER';
  /**
   * The data associated with the action, to be validated by the specific operator.
   */
  data: { [key: string]: unknown };
};

// --- Session Progress State Machine Types ---

/**
 * The state for a vocabulary deck exercise. It tracks the current stage (presenting a word
 * or awaiting a rating) and the user's progress through the deck.
 */
export type VocabularyDeckProgress = {
  type: 'VOCABULARY_DECK';
  stage: 'PRESENTING_WORD' | 'AWAITING_RATING';
  payload: {
    cardIds: string[];
    currentCardIndex: number;
    /**
     * The full data for the current card. This is populated by the 'REVEAL_ANSWER'
     * operator and used by the UI to display the card details.
     */
    currentCardData?: VocabularyCard;
  };
};

/**
 * The state for a comprehensive FSRS review session. It tracks the queue of due cards
 * and the user's progress through them.
 */
export type FsrsReviewProgress = {
  type: 'FSRS_REVIEW_SESSION';
  stage: 'PRESENTING_CARD' | 'AWAITING_RATING';
  payload: {
    /**
     * The full list of card states being reviewed in this session.
     * This is populated once by the initialize method.
     */
    cardStates: (StudentCardState & { card: VocabularyCard })[];
    /**
     * The index of the card currently being displayed to the user.
     */
    currentCardIndex: number;
  };
};

/**
 * Defines the result of an answer submission.
 * This provides a structured way to give feedback to the frontend.
 */
export interface SubmissionResult {
  isCorrect: boolean;
  correctAnswer?: unknown;
  feedback?: string;
}

/**
 * A union type representing all possible progress states for any exercise.
 * The `Session.progress` field will always conform to one of these shapes.
 */
export type SessionProgress = VocabularyDeckProgress | FsrsReviewProgress;
// | GrammarExerciseProgress etc. will be added here.

/**
 * The complete state of a session, now including the typed progress object.
 * This gives the frontend everything it needs to render the current state of the application.
 */
export type FullSessionState = Omit<Session, 'progress'> & {
  student: Student;
  unit: FullUnit;
  currentUnitItem: PopulatedUnitItem | null;
  progress: SessionProgress | null; // The progress field is now strongly typed.
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
