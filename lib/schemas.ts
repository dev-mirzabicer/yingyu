import { z } from 'zod';

// Schema for creating a new student.
// Ensures that essential data is present and correctly formatted.
export const CreateStudentSchema = z.object({
  name: z.string().min(1, { message: 'Student name cannot be empty.' }),
  email: z.string().email({ message: 'Invalid email address.' }).optional(),
  phone: z.string().optional(),
  proficiencyLevel: z
    .enum(['BEGINNER', 'ELEMENTARY', 'INTERMEDIATE', 'ADVANCED'])
    .optional(),
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

// NEW: Schema for updating an existing Unit. All fields are optional.
export const UpdateUnitSchema = z.object({
  name: z
    .string()
    .min(3, { message: 'Unit name must be at least 3 characters long.' })
    .optional(),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
});

// NEW: Schema for updating a student's notes.
export const UpdateNotesSchema = z.object({
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
  })
  .optional();

