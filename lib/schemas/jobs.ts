import { z } from "zod";

/**
 * Schema for the summary of a bulk import job.
 */
export const BulkImportSummarySchema = z.object({
  successfulImports: z.number().min(0),
  failedImports: z.number().min(0),
  totalRows: z.number().min(0),
});

/**
 * Schema for a single error in a bulk import job.
 */
export const BulkImportErrorSchema = z.object({
  rowNumber: z.number().min(1),
  fieldName: z.string(),
  errorMessage: z.string(),
});

/**
 * Schema for the complete result object of a bulk import job.
 * This is stored in the `result` field of the `Job` model.
 */
export const BulkImportResultSchema = z.object({
  summary: BulkImportSummarySchema,
  errors: z.array(BulkImportErrorSchema),
});


/**
 * Validates the payload for the job that adds multiple vocabulary cards to a deck.
 * This is used by the bulk import worker.
 */
export const BulkAddVocabularyCardsPayloadSchema = z.object({
  deckId: z.string().uuid({ message: "Invalid deck UUID." }),
  cards: z.array(
    z.object({
      englishWord: z.string(),
      chineseTranslation: z.string(),
      pinyin: z.string().optional(),
      ipaPronunciation: z.string().optional(),
      wordType: z.string().optional(),
      difficultyLevel: z.coerce.number().min(1).max(5).optional(),
      tags: z.string().optional(), // Assuming tags are a comma-separated string from CSV
      audioUrl: z.string().url().optional().or(z.literal("")),
      imageUrl: z.string().url().optional().or(z.literal("")),
      exampleSentences: z.string().optional(), // Assuming JSON string from CSV
    })
  ),
});

/**
 * Validates the payload for the job that adds multiple students for a teacher.
 */
export const BulkAddStudentsPayloadSchema = z.object({
  teacherId: z.string().uuid({ message: "Invalid teacher UUID." }),
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

/**
 * Validates the payload for the job that adds multiple class schedules.
 */
export const BulkAddSchedulesPayloadSchema = z.object({
  teacherId: z.string().uuid({ message: "Invalid teacher UUID." }),
  schedules: z.array(
    z.object({
      studentEmail: z.string().email(),
      scheduledTime: z.string(), // ISO 8601 string
      duration: z.coerce.number().int().positive().optional(),
      notes: z.string().optional(),
      type: z.string().optional(),
    })
  ),
});

