import {
  Unit,
  UnitItem,
  VocabularyDeck,
  GrammarExercise,
  ListeningExercise,
  FillInBlankExercise,
  Student,
  Payment,
  StudentDeck,
  ClassSchedule,
  Session,
  Prisma,
  VocabularyCard,
  Teacher,
  StudentCardState,
  FillInBlankCardState,
  Job,
} from '@prisma/client';
import { z } from 'zod';
import {
  BulkImportResultSchema,
  BulkImportErrorSchema,
  BulkImportSummarySchema,
} from './schemas/jobs';

export type BulkImportSummary = z.infer<typeof BulkImportSummarySchema>;
export type BulkImportError = z.infer<typeof BulkImportErrorSchema>;
export type BulkImportResult = z.infer<typeof BulkImportResultSchema>;

export type PopulatedUnitItem = UnitItem & {
  vocabularyDeck: (VocabularyDeck & { cards: { id: string }[] }) | null;
  grammarExercise: GrammarExercise | null;
  listeningExercise: ListeningExercise | null;
  fillInBlankExercise: FillInBlankExercise | null;
  config?: VocabularyExerciseConfig;
};

export type FullUnit = Unit & {
  items: PopulatedUnitItem[];
};

export type UnitWithItems = Unit & {
  items: UnitItem[];
};

export type UnitWithCount = Unit & {
  _count: {
    items: number;
  };
};

export type VocabularyDeckWithCount = VocabularyDeck & {
  _count: {
    cards: number;
  };
};

export type PopulatedStudentDeck = StudentDeck & {
  deck: VocabularyDeck & {
    cards?: { id: string }[];
  };
};

export type FullStudentProfile = Student & {
  classesRemaining: number;
  studentDecks: (StudentDeck & {
    deck: VocabularyDeck & {
      _count: {
        cards: number;
      };
    };
  })[];
  payments: Payment[];
  classSchedules: ClassSchedule[];
  notes: string | null;
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
  deckId?: string; // Added to support dynamic queue expansion
  learningSteps?: string[]; // Added to support configurable learning steps (e.g., ['3m', '15m', '30m'])
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
  action: 'REVEAL_ANSWER' | 'SUBMIT_RATING' | 'SUBMIT_TEXT_ANSWER' | 'PLAY_AUDIO' | 'SUBMIT_STUDENT_ANSWER' | 'MARK_CORRECT' | 'MARK_INCORRECT';
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
    queue: (StudentCardState & { card: VocabularyCard })[];
    /** The full data for the current card (queue[0]). Pre-fetched for the UI. */
    currentCardData?: StudentCardState & { card: VocabularyCard };
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
 * Configuration for listening exercises, stored in UnitItem.exerciseConfig.
 */
export type ListeningExerciseConfig = {
  deckId: string; // The vocabulary deck to use for listening
  newCards?: number;
  maxDue?: number;
  minDue?: number;
  vocabularyConfidenceThreshold?: number; // Min vocabulary retrievability (default 0.8)
  listeningCandidateThreshold?: number; // Min threshold for listening readiness (default 0.6)
  learningSteps?: string[]; // Listening-specific learning steps
};

/**
 * Configuration for fill-in-blank exercises, stored in UnitItem.exerciseConfig.
 */
export type FillInBlankExerciseConfig = {
  deckId: string; // The vocabulary deck to use for fill-in-blank
  maxCards?: number; // How many cards in session (default 20)
  vocabularyConfidenceThreshold?: number; // Min vocab confidence (default 0.8)
  shuffleCards?: boolean; // Randomize order (default true)
};

/**
 * Progress state for listening exercises.
 */
export type ListeningDeckProgress = {
  type: 'LISTENING_EXERCISE';
  stage: 'PLAYING_AUDIO' | 'AWAITING_RATING';
  payload: {
    /** The dynamic, sorted queue of listening cards to be reviewed */
    queue: Array<any>; // Will be typed as (ListeningCardState & { card: VocabularyCard })[]
    /** The full data for the current card (queue[0]) */
    currentCardData?: any; // Will be typed as ListeningCardState & { card: VocabularyCard }
    /** The original configuration for this session */
    config: ListeningExerciseConfig;
    /** Static list of all card IDs included at the start of the session */
    initialCardIds: string[];
    /** Warnings about session composition */
    sessionWarnings?: {
      suboptimalCandidates: number;
      recommendedMaxCards: number;
    };
  };
};

/**
 * Progress state for fill-in-blank exercises.
 */
export type FillInBlankExerciseProgress = {
  type: 'FILL_IN_BLANK_EXERCISE';
  stage: 'SHOWING_QUESTION' | 'SHOWING_ANSWER' | 'AWAITING_TEACHER_JUDGMENT';
  payload: {
    /** The dynamic queue of cards not yet seen */
    queue: Array<{ cardId: string }>;
    /** The full data for the current card */
    currentCardData: {
      cardId: string;
      englishWord: string;
      chineseTranslation: string;
      pinyin?: string;
    } | null;
    /** The student's typed answer */
    studentAnswer?: string;
    /** The original configuration for this session */
    config: FillInBlankExerciseConfig;
    /** Warnings from candidate selection */
    sessionWarnings?: any;
  };
};

/**
 * A union type representing all possible progress states for any exercise.
 * The `Session.progress` field will always conform to one of these shapes.
 */
export type SessionProgress = VocabularyDeckProgress | ListeningDeckProgress | FillInBlankExerciseProgress;
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
    config?: ListeningExerciseConfig;
    mode: 'existing';
    existingDeckId: string; // Must reference an existing vocabulary deck
    data: {
      title: string;
      difficultyLevel?: number;
      explanation?: string;
      tags?: string[];
      isPublic?: boolean;
    };
  }
  | {
    type: 'FILL_IN_BLANK_EXERCISE';
    order?: number;
    config?: FillInBlankExerciseConfig;
    mode: 'existing';
    existingDeckId: string;
    data: {
      title: string;
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

export type FsrsStats = {
  totalCards: number;
  newCards: number;
  learningCards: number;
  reviewCards: number;
  relearningCards: number;
  dueToday: number;
  dueThisWeek: number;
  overdue: number;
  totalReviews: number;
  averageRetention: number;
  averageResponseTime: number;
};