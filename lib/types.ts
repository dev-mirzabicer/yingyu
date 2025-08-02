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
  Teacher,
} from '@prisma/client';

export type PopulatedUnitItem = UnitItem & {
  vocabularyDeck: (VocabularyDeck & { cards: { id: string }[] }) | null;
  grammarExercise: GrammarExercise | null;
  listeningExercise: ListeningExercise | null;
  vocabFillInBlankExercise: VocabFillInBlankExercise | null;
  config?: VocabularyExerciseConfig;
};

export type FullUnit = Unit & {
  items: PopulatedUnitItem[];
};

export type PopulatedStudentDeck = StudentDeck & {
  deck: VocabularyDeck & {
    cards?: { id: string }[];
  };
};

export type FullStudentProfile = Student & {
  classesRemaining: number;
  payments: Payment[];
  studentDecks: PopulatedStudentDeck[];
  upcomingClasses: ClassSchedule[];
};

// ================================================================= //
// DEFINITIVE STATE & DTO CONTRACTS (v6.0 - Unified Vocabulary Engine)
// ================================================================= //

/**
 * Defines the configuration for a unified vocabulary session, stored in UnitItem.exerciseConfig.
 * All properties are optional, allowing the handler to use teacher-defined defaults.
 */
export type VocabularyExerciseConfig = {
  newCards?: number;
  maxDue?: number;
  minDue?: number;
};

/**
 * Represents a single item in the live review queue.
 */
export type VocabularyQueueItem = {
  cardId: string;
  /** The timestamp when the card is due. Used for sorting. */
  due: Date;
  /** A flag to differentiate new cards from review cards for potential UI differences. */
  isNew: boolean;
};

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
  data?: { [key: string]: unknown };
};

// --- Session Progress State Machine Types ---

/**
 * The new, definitive progress state for the unified vocabulary handler.
 */
export type VocabularyDeckProgress = {
  type: 'VOCABULARY_DECK';
  stage: 'PRESENTING_CARD' | 'AWAITING_RATING';
  payload: {
    /** The dynamic, sorted queue of cards to be reviewed. The card at index 0 is the current card. */
    queue: VocabularyQueueItem[];
    /** The full data for the current card (queue[0]). Pre-fetched for the UI. */
    currentCardData?: VocabularyCard;
    /** The original configuration for this session, kept for reference. */
    config: VocabularyExerciseConfig;
    /**
     * REFINEMENT: A static list of all card IDs included at the start of the session.
     * This is used to efficiently scope the dynamic re-evaluation of the queue.
     */
    initialCardIds: string[];
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
export type SessionProgress = VocabularyDeckProgress;
// | GrammarExerciseProgress etc. will be added here.

/**
 * The complete state of a session, now including the typed progress object.
 * This gives the frontend everything it needs to render the current state of the application.
 */
export type FullSessionState = Omit<Session, 'progress'> & {
  teacher: Teacher;
  student: Student;
  unit: FullUnit;
  currentUnitItem: PopulatedUnitItem | null;
  progress: SessionProgress | null; // The progress field is now strongly typed.
};

// --- Input/Data Transfer Object Types ---

export type NewUnitItemData =
  | {
    type: 'VOCABULARY_DECK';
    order?: number;
    config?: VocabularyExerciseConfig;
    mode: 'new';
    data: {
      name: string;
      description?: string;
      isPublic?: boolean;
    };
  }
  | {
    type: 'VOCABULARY_DECK';
    order?: number;
    config?: VocabularyExerciseConfig;
    mode: 'existing';
    existingDeckId: string;
  }
  | {
    type: 'GRAMMAR_EXERCISE';
    order?: number;
    config?: any;
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
    order?: number;
    config?: any;
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
    order?: number;
    config?: any;
    data: {
      title: string;
      difficultyLevel?: number;
      exerciseData: Prisma.InputJsonValue; // Use the correct input type
      explanation?: string;
      tags?: string[];
      isPublic?: boolean;
    };
  };

// ================================================================= //
// SESSION STARTING WORKFLOW TYPES
// ================================================================= //

/**
 * Extended unit type with availability information for session starting
 */
export type AvailableUnit = Unit & {
  items: PopulatedUnitItem[];
  isAvailable: boolean;
  missingPrerequisites: string[];
  cardStats: {
    total: number;
    ready: number;
  };
  exerciseCount: number;
};
