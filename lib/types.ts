import {
  Unit,
  UnitItem,
  UnitItemType,
  VocabularyDeck,
  GrammarExercise,
  ListeningExercise,
  FillInTheBlankDeck,
  FillInTheBlankCard,
  GenericDeck,
  GenericCard,
  Student,
  Payment,
  StudentDeck,
  StudentGenericDeck,
  ClassSchedule,
  Session,
  Prisma,
  VocabularyCard,
  Teacher,
  StudentCardState,
  StudentGenericCardState,
  ListeningCardState,
} from '@prisma/client';
import { DataTableCompatible } from '@/components/data-table';
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
  fillInTheBlankDeck: (FillInTheBlankDeck & { cards: { id: string }[] }) | null;
  genericDeck: (GenericDeck & { cards: { id: string }[] }) | null;
  config?: VocabularyExerciseConfig | ListeningExerciseConfig | FillInTheBlankExerciseConfig | GrammarExerciseConfig;
};

export type FullUnit = Unit & {
  items: PopulatedUnitItem[];
};

export type UnitWithItems = Unit & {
  items: UnitItem[];
};

export type UnitWithCount = Unit & DataTableCompatible & {
  _count: {
    items: number;
  };
  [key: string]: unknown;
};

export type VocabularyDeckWithCount = VocabularyDeck & DataTableCompatible & {
  _count: {
    cards: number;
  };
  [key: string]: unknown;
};

export type FillInTheBlankDeckWithCount = FillInTheBlankDeck & DataTableCompatible & {
  _count: {
    cards: number;
  };
  [key: string]: unknown;
};

export type GenericDeckWithCount = GenericDeck & DataTableCompatible & {
  _count: {
    cards: number;
  };
  [key: string]: unknown;
};

export type PopulatedStudentDeck = StudentDeck & {
  deck: VocabularyDeck & {
    cards?: { id: string }[];
  };
};

export type FullStudentProfile = Student & DataTableCompatible & {
  classesRemaining: number;
  studentDecks: (StudentDeck & {
    deck: VocabularyDeck & {
      _count: {
        cards: number;
      };
    };
  })[];
  studentGenericDecks: (StudentGenericDeck & {
    deck: GenericDeck & {
      _count: {
        cards: number;
      };
    };
  })[];
  payments: Payment[];
  classSchedules: ClassSchedule[];
  notes: string | null;
  upcomingClasses: ClassSchedule[];
  [key: string]: unknown;
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
  action: 'REVEAL_ANSWER' | 'SUBMIT_RATING' | 'SUBMIT_TEXT_ANSWER' | 'PLAY_AUDIO';
  /**
   * The data associated with the action, to be validated by the specific operator.
   * Frontend sends numbers/booleans which are converted to proper object format:
   * - number -> { rating: number } for FSRS ratings
   * - boolean -> { isCorrect: boolean } for correctness ratings
   */
  data?: { [key: string]: unknown } | number | boolean;
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
 * The progress state for the generic deck handler.
 * This mirrors VocabularyDeckProgress but works with GenericCard states.
 */
export type GenericDeckProgress = {
  type: 'GENERIC_DECK';
  stage: 'PRESENTING_CARD' | 'AWAITING_RATING';
  payload: {
    /** The dynamic, sorted queue of cards to be reviewed. The card at index 0 is the current card. */
    queue: (StudentGenericCardState & { card: GenericCard })[];
    /** The full data for the current card (queue[0]). Pre-fetched for the UI. */
    currentCardData?: StudentGenericCardState & { card: GenericCard };
    /** The original configuration for this session, kept for reference. */
    config: VocabularyExerciseConfig; // Uses the same config as vocabulary deck
    /**
     * A static list of all card IDs included at the start of the session.
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
 * Configuration for grammar exercises, stored in UnitItem.exerciseConfig.
 * Supports dynamic question generation and difficulty scaling.
 */
export type GrammarExerciseConfig = {
  /** Title of the grammar exercise */
  title?: string;
  /** Grammar topic/category (e.g., "Present Perfect", "Conditionals") */
  grammarTopic?: string;
  /** Difficulty level from 1 (beginner) to 5 (advanced) */
  difficulty?: number;
  /** Structured exercise data containing questions, instructions, etc. */
  exerciseData?: {
    /** Instructions shown to the student */
    instructions?: string;
    /** Array of question objects with their answers and options */
    questions?: {
      id?: string;
      question: string;
      options?: string[];
      correctAnswer: string;
      explanation?: string;
    }[];
    /** Additional configuration for question presentation */
    settings?: {
      randomizeQuestions?: boolean;
      randomizeOptions?: boolean;
      showExplanations?: boolean;
    };
  };
  /** Optional explanation text for the grammar concept */
  explanation?: string;
  /** Tags for categorization and filtering */
  tags?: string[];
};

/**
 * Configuration for fill-in-the-blank exercises, stored in UnitItem.exerciseConfig.
 */
export type FillInTheBlankExerciseConfig = {
  vocabularyConfidenceThreshold?: number; // Min vocabulary retrievability (e.g., 0.8)
};

/**
 * Progress state for listening exercises.
 */
export type ListeningDeckProgress = {
  type: 'LISTENING_EXERCISE';
  stage: 'PLAYING_AUDIO' | 'AWAITING_RATING';
  payload: {
    /** The dynamic, sorted queue of listening cards to be reviewed */
    queue: (ListeningCardState & { card: VocabularyCard })[];
    /** The full data for the current card (queue[0]) */
    currentCardData?: ListeningCardState & { card: VocabularyCard };
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
 * Progress state for fill-in-the-blank exercises.
 */
export type FillInTheBlankProgress = {
  type: 'FILL_IN_THE_BLANK_EXERCISE';
  stage: 'PRESENTING_CARD' | 'AWAITING_CORRECTNESS';
  payload: {
    /** The queue of fill-in-the-blank cards to be reviewed */
    queue: FillInTheBlankCard[];
    /** The full data for the current card (queue[0]) */
    currentCardData?: FillInTheBlankCard;
    /** The original configuration for this session */
    config: FillInTheBlankExerciseConfig;
    /** Static list of all card IDs included at the start of the session */
    initialCardIds: string[];
  };
};

/**
 * A union type representing all possible progress states for any exercise.
 * The `Session.progress` field will always conform to one of these shapes.
 */
export type SessionProgress = VocabularyDeckProgress | ListeningDeckProgress | FillInTheBlankProgress | GenericDeckProgress;
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
    config?: GrammarExerciseConfig;
    data: {
      title: string;
      grammarTopic: string;
      difficultyLevel?: number;
      exerciseData: Prisma.InputJsonValue;
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
    type: 'FILL_IN_THE_BLANK_EXERCISE';
    mode: 'existing';
    order?: number;
    config?: FillInTheBlankExerciseConfig;
    existingDeckId: string;
  }
  | {
    type: 'GENERIC_DECK';
    order?: number;
    config?: VocabularyExerciseConfig;
    mode: 'new';
    data: {
      name: string;
      description?: string;
      isPublic?: boolean;
      boundVocabularyDeckId?: string;
    };
  }
  | {
    type: 'GENERIC_DECK';
    order?: number;
    config?: VocabularyExerciseConfig;
    mode: 'existing';
    existingDeckId: string;
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

// ================================================================= //
// JOB SYSTEM TYPES (for type-safe job payloads)
// ================================================================= //
import { 
  BulkImportVocabularyPayloadSchema,
  BulkImportStudentsPayloadSchema, 
  BulkImportSchedulesPayloadSchema,
  BulkImportGenericDeckPayloadSchema,
  OptimizeParamsPayloadSchema,
  RebuildCachePayloadSchema,
  InitializeCardStatesPayloadSchema
} from './schemas';
import { JobType, SessionStatus } from '@prisma/client';

/**
 * Union of all validated job payload types
 */
export type ValidatedJobPayload = 
  | z.infer<typeof BulkImportVocabularyPayloadSchema>
  | z.infer<typeof BulkImportStudentsPayloadSchema>
  | z.infer<typeof BulkImportSchedulesPayloadSchema>
  | z.infer<typeof BulkImportGenericDeckPayloadSchema>
  | z.infer<typeof OptimizeParamsPayloadSchema>
  | z.infer<typeof RebuildCachePayloadSchema>
  | z.infer<typeof InitializeCardStatesPayloadSchema>;

/**
 * Job payload map that connects job types to their specific payload schemas
 */
export type JobPayloadMap = {
  [JobType.BULK_IMPORT_VOCABULARY]: z.infer<typeof BulkImportVocabularyPayloadSchema>;
  [JobType.BULK_IMPORT_STUDENTS]: z.infer<typeof BulkImportStudentsPayloadSchema>;
  [JobType.BULK_IMPORT_SCHEDULES]: z.infer<typeof BulkImportSchedulesPayloadSchema>;
  [JobType.BULK_IMPORT_GENERIC_DECK]: z.infer<typeof BulkImportGenericDeckPayloadSchema>;
  [JobType.OPTIMIZE_VOCABULARY_FSRS_PARAMS]: z.infer<typeof OptimizeParamsPayloadSchema>;
  [JobType.OPTIMIZE_GENERIC_FSRS_PARAMS]: z.infer<typeof OptimizeParamsPayloadSchema>;
  [JobType.OPTIMIZE_LISTENING_FSRS_PARAMS]: z.infer<typeof OptimizeParamsPayloadSchema>;
  [JobType.REBUILD_VOCABULARY_FSRS_CACHE]: z.infer<typeof RebuildCachePayloadSchema>;
  [JobType.REBUILD_GENERIC_FSRS_CACHE]: z.infer<typeof RebuildCachePayloadSchema>;
  [JobType.REBUILD_LISTENING_FSRS_CACHE]: z.infer<typeof RebuildCachePayloadSchema>;
  [JobType.INITIALIZE_CARD_STATES]: z.infer<typeof InitializeCardStatesPayloadSchema>;
  [JobType.INITIALIZE_GENERIC_CARD_STATES]: z.infer<typeof InitializeCardStatesPayloadSchema>;
  [JobType.INITIALIZE_LISTENING_CARD_STATES]: z.infer<typeof InitializeCardStatesPayloadSchema>;
};

// ================================================================= //
// SESSION SYSTEM TYPES (for type-safe session management)
// ================================================================= //

/**
 * Type-safe exercise config overrides for session initialization
 */
export type ExerciseConfigOverrides = {
  [itemId: string]: 
    | VocabularyExerciseConfig 
    | ListeningExerciseConfig 
    | FillInTheBlankExerciseConfig
    | GrammarExerciseConfig;
};

/**
 * Session summary type for getAllSessionsForTeacher return value
 */
export interface SessionSummary extends DataTableCompatible {
  id: string;
  studentId: string;
  studentName: string;
  unitName: string;
  status: SessionStatus;
  startedAt: Date;
  endedAt: Date | null;
  duration: number;
  cardsReviewed: number;
  [key: string]: unknown;
}

/**
 * Session list item type for sessions page DataTable compatibility
 */
export interface SessionListItem extends DataTableCompatible {
  id: string;
  studentId: string;
  studentName: string;
  unitId: string;
  unitName: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'CANCELLED';
  startedAt: string;
  duration: number;
  cardsReviewed: number;
  [key: string]: unknown;
}

// ================================================================= //
// TYPE GUARDS AND UTILITY FUNCTIONS
// ================================================================= //

/**
 * Type guard to safely cast unknown JSON values to SessionProgress
 */
export function isSessionProgress(value: unknown): value is SessionProgress {
  if (!value || typeof value !== 'object') return false;
  
  const obj = value as Record<string, unknown>;
  const validTypes = ['VOCABULARY_DECK', 'LISTENING_EXERCISE', 'FILL_IN_THE_BLANK_EXERCISE', 'GENERIC_DECK'];
  
  return typeof obj.type === 'string' && 
         validTypes.includes(obj.type) &&
         typeof obj.stage === 'string' &&
         obj.payload !== undefined;
}

/**
 * Type guard to safely cast unknown JSON values to exercise configs
 */
export function isExerciseConfig(value: unknown): value is VocabularyExerciseConfig | ListeningExerciseConfig | FillInTheBlankExerciseConfig | GrammarExerciseConfig {
  if (!value || typeof value !== 'object') return false;
  
  // Exercise configs are objects that may contain optional properties
  // The presence of typical config properties indicates it's likely a config object
  const obj = value as Record<string, unknown>;
  const configProps = [
    'newCards', 'maxDue', 'minDue', 'deckId', 'learningSteps', 
    'vocabularyConfidenceThreshold', 'title', 'grammarTopic', 
    'difficulty', 'exerciseData', 'explanation', 'tags'
  ];
  
  return Object.keys(obj).some(key => configProps.includes(key));
}

/**
 * Specific type guard for vocabulary exercise configs
 */
export function isVocabularyExerciseConfig(value: unknown): value is VocabularyExerciseConfig {
  if (!value || typeof value !== 'object') return false;
  
  const obj = value as Record<string, unknown>;
  const vocabularyProps = ['newCards', 'maxDue', 'minDue', 'deckId', 'learningSteps'];
  
  // Check for vocabulary-specific properties or empty object (all properties are optional)
  return Object.keys(obj).length === 0 || Object.keys(obj).some(key => vocabularyProps.includes(key));
}

/**
 * Specific type guard for listening exercise configs
 */
export function isListeningExerciseConfig(value: unknown): value is ListeningExerciseConfig {
  if (!value || typeof value !== 'object') return false;
  
  const obj = value as Record<string, unknown>;
  const listeningProps = ['deckId', 'newCards', 'maxDue', 'minDue', 'vocabularyConfidenceThreshold', 'listeningCandidateThreshold', 'learningSteps'];
  
  // Listening configs typically have a deckId or other listening-specific properties
  return Object.keys(obj).some(key => listeningProps.includes(key));
}

/**
 * Specific type guard for grammar exercise configs
 */
export function isGrammarExerciseConfig(value: unknown): value is GrammarExerciseConfig {
  if (!value || typeof value !== 'object') return false;
  
  const obj = value as Record<string, unknown>;
  const grammarProps = ['title', 'grammarTopic', 'difficulty', 'exerciseData', 'explanation', 'tags'];
  
  // Grammar configs typically have grammar-specific properties
  return Object.keys(obj).some(key => grammarProps.includes(key));
}

/**
 * Specific type guard for fill-in-the-blank exercise configs
 */
export function isFillInTheBlankExerciseConfig(value: unknown): value is FillInTheBlankExerciseConfig {
  if (!value || typeof value !== 'object') return false;
  
  const obj = value as Record<string, unknown>;
  const fitbProps = ['vocabularyConfidenceThreshold'];
  
  // FITB configs are simple and may be empty objects
  return Object.keys(obj).length === 0 || Object.keys(obj).some(key => fitbProps.includes(key));
}

/**
 * Safe converter for exercise configs with proper type casting
 */
export function safeExerciseConfigConversion<T extends VocabularyExerciseConfig | ListeningExerciseConfig | FillInTheBlankExerciseConfig | GrammarExerciseConfig>(
  value: unknown,
  defaultConfig: T
): T {
  if (!isExerciseConfig(value)) {
    return defaultConfig;
  }
  
  // Merge the unknown config with the default to ensure all required properties exist
  return { ...defaultConfig, ...value } as T;
}

/**
 * Type-safe exercise config getter that narrows unknown configs to specific types
 */
export function getTypedExerciseConfig(
  config: unknown,
  exerciseType: UnitItemType
): VocabularyExerciseConfig | ListeningExerciseConfig | FillInTheBlankExerciseConfig {
  if (!config || typeof config !== 'object') {
    // Return appropriate default based on exercise type
    switch (exerciseType) {
      case UnitItemType.VOCABULARY_DECK:
        return {};
      case UnitItemType.LISTENING_EXERCISE:
        return { deckId: '' };
      case UnitItemType.FILL_IN_THE_BLANK_EXERCISE:
        return {};
      case UnitItemType.GENERIC_DECK:
        return {};
      default:
        return {};
    }
  }

  const obj = config as Record<string, unknown>;
  
  switch (exerciseType) {
    case UnitItemType.VOCABULARY_DECK:
    case UnitItemType.GENERIC_DECK:
      return safeExerciseConfigConversion(obj, {} as VocabularyExerciseConfig);
    case UnitItemType.LISTENING_EXERCISE:
      return safeExerciseConfigConversion(obj, { deckId: '' } as ListeningExerciseConfig);
    case UnitItemType.FILL_IN_THE_BLANK_EXERCISE:
      return safeExerciseConfigConversion(obj, {} as FillInTheBlankExerciseConfig);
    default:
      return {};
  }
}

/**
 * Safely converts validated job payloads to Prisma.InputJsonValue
 */
export function toJobPayload(payload: ValidatedJobPayload): Prisma.InputJsonValue {
  return payload as Prisma.InputJsonValue;
}