import { z } from 'zod';
import { ClassStatus } from '@prisma/client';

// Schema for creating a new student.
// Ensures that essential data is present and correctly formatted.
export const CreateStudentSchema = z.object({
  name: z.string().min(1, { message: 'Student name cannot be empty.' }),
  email: z.string().email({ message: 'Invalid email address.' }).optional(),
  phone: z.string().optional(),
  proficiencyLevel: z
    .enum(['BEGINNER', 'ELEMENTARY', 'INTERMEDIATE', 'ADVANCED'])
    .optional(),
  notes: z.string().optional(),
});

// Schema for recording a payment.
// Enforces business rules, e.g., payments and classes must be positive numbers.
// REFINEMENT: Use `z.coerce.date()` to robustly handle date strings from JSON.
export const RecordPaymentSchema = z.object({
  amount: z.number().positive({ message: 'Payment amount must be positive.' }),
  classesPurchased: z
    .number()
    .int()
    .positive({ message: 'Number of classes must be a positive integer.' }),
  paymentDate: z.coerce.date({
    errorMap: () => ({ message: 'Invalid payment date format.' }),
  }),
});

// Schema for creating a new Unit (lesson plan).
export const CreateUnitSchema = z.object({
  name: z
    .string()
    .min(3, { message: 'Unit name must be at least 3 characters long.' }),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
});

// Schema for creating a new Vocabulary Deck.
export const CreateDeckSchema = z.object({
  name: z
    .string()
    .min(3, { message: 'Deck name must be at least 3 characters long.' }),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
});

// Schema for updating an existing Unit. All fields are optional.
export const UpdateUnitSchema = z.object({
  name: z
    .string()
    .min(3, { message: 'Unit name must be at least 3 characters long.' })
    .optional(),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
});

// Schema for updating a student's notes.
export const UpdateNotesSchema = z.object({
  notes: z.string().max(5000, 'Notes cannot exceed 5000 characters.').optional(),
});

// Schema for updating student details.
export const UpdateStudentSchema = z.object({
  name: z.string().min(1, { message: 'Student name cannot be empty.' }).optional(),
  email: z.string().email({ message: 'Invalid email address.' }).optional(),
  phone: z.string().optional(),
  proficiencyLevel: z
    .enum(['BEGINNER', 'ELEMENTARY', 'INTERMEDIATE', 'ADVANCED'])
    .optional(),
  notes: z.string().max(5000, 'Notes cannot exceed 5000 characters.').optional(),
});

/**
 * Validates the payload for the job that initializes FSRS states for a new deck assignment.
 */
export const InitializeCardStatesPayloadSchema = z.object({
  studentId: z.string().uuid({ message: 'Invalid student UUID.' }),
  deckId: z.string().uuid({ message: 'Invalid deck UUID.' }),
});

/**
 * Validates the payload for the job that rebuilds the FSRS cache for a student.
 */
export const RebuildCachePayloadSchema = z.object({
  studentId: z.string().uuid({ message: 'Invalid student UUID.' }),
});

/**
 * Validates the configuration object for a vocabulary exercise unit item.
 */
export const VocabularyExerciseConfigSchema = z
  .object({
    newCards: z.number().int().min(0).optional(),
    maxDue: z.number().int().min(0).optional(),
    minDue: z.number().int().min(0).optional(),
    deckId: z.string().uuid().optional(), // Added to support dynamic queue expansion
    learningSteps: z.array(
      z.string().regex(/^\d+[smhd]$/, 'Learning step must be in format like "3m", "15m", "1h", "2d"')
    ).optional(), // Added to support configurable learning steps
  })
  .optional();

// --- NEW SCHEMAS ---

/**
 * Validates the payload for the job that optimizes FSRS parameters.
 */
export const OptimizeParamsPayloadSchema = z.object({
  studentId: z.string().uuid({ message: 'Invalid student UUID.' }),
});

/**
 * Validates the request body for creating a new class schedule.
 */
export const CreateScheduleSchema = z.object({
  scheduledTime: z.coerce.date({
    errorMap: () => ({ message: 'Invalid scheduled time format.' }),
  }),
});

/**
 * Validates the request body for updating a class schedule.
 */
export const UpdateScheduleSchema = z.object({
  scheduledTime: z.coerce
    .date({
      errorMap: () => ({ message: 'Invalid scheduled time format.' }),
    })
    .optional(),
  status: z.nativeEnum(ClassStatus).optional(),
});

/**
 * Validates the request body for updating teacher settings.
 */
export const UpdateTeacherSettingsSchema = z.object({
  paymentAlertThreshold: z.number().int().min(0).optional(),
  preferredLessonDuration: z.number().int().positive().optional(),
});

export const BulkImportVocabularyPayloadSchema = z.object({
  deckId: z.string().uuid(),
  cards: z.array(
    z.object({
      englishWord: z.string(),
      chineseTranslation: z.string(),
      pinyin: z.string().optional(),
      ipaPronunciation: z.string().optional(),
      wordType: z.string().optional(),
      difficultyLevel: z.coerce.number().min(1).max(5).optional(),
      tags: z.string().optional(),
      audioUrl: z.string().optional(),
      imageUrl: z.string().optional(),
      exampleSentences: z.string().optional(),
    })
  ),
});

export const BulkImportStudentsPayloadSchema = z.object({
  students: z.array(
    z.object({
      name: z.string(),
      email: z.string().email(),
      phone: z.string().optional(),
      notes: z.string().optional(),
      initialDeckId: z.string().uuid().optional(),
    })
  ),
});

export const BulkImportSchedulesPayloadSchema = z.object({
  schedules: z.array(
    z.object({
      studentEmail: z.string().email(),
      scheduledTime: z.string(),
      duration: z.coerce.number().int().positive().optional(),
      notes: z.string().optional(),
      type: z.string().optional(),
    })
  ),
});
