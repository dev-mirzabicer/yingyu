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
export const RecordPaymentSchema = z.object({
  amount: z.number().positive({ message: 'Payment amount must be positive.' }),
  classesPurchased: z
    .number()
    .int()
    .positive({ message: 'Number of classes must be a positive integer.' }),
  paymentDate: z.date(),
});

// Schema for creating a new Unit (lesson plan).
export const CreateUnitSchema = z.object({
  name: z
    .string()
    .min(3, { message: 'Unit name must be at least 3 characters long.' }),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
});
