import { z } from "zod";

export const BulkImportSummarySchema = z.object({
  successfulImports: z.number().min(0),
  failedImports: z.number().min(0),
  totalRows: z.number().min(0),
});

export const BulkImportErrorSchema = z.object({
  rowNumber: z.number().min(1),
  fieldName: z.string(),
  errorMessage: z.string(),
});

export const BulkImportResultSchema = z.object({
  summary: BulkImportSummarySchema,
  errors: z.array(BulkImportErrorSchema),
});
