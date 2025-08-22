import { prisma } from '@/lib/db';
import { Job, JobType, Prisma } from '@prisma/client';
import {
  BulkImportSchedulesPayloadSchema,
  BulkImportStudentsPayloadSchema,
  BulkImportVocabularyPayloadSchema,
  BulkImportGenericDeckPayloadSchema,
} from '../schemas';

/**
 * Service responsible for managing asynchronous jobs.
 * This service now has a single responsibility: creating and retrieving jobs using
 * the global prisma client. It is no longer aware of external transactions.
 */
export const JobService = {
  /**
   * Creates a new job record in the database.
   * This operation is self-contained and not part of other transactions.
   *
   * @param ownerId The UUID of the Teacher who is initiating the job.
   * @param type The type of job to be executed.
   * @param payload The JSON data required by the worker to execute the job.
   * @returns A promise that resolves to the newly created Job object.
   */
  async createJob(
    ownerId: string,
    type: JobType,
    payload: Prisma.InputJsonValue
  ): Promise<Job> {
    if (!ownerId) {
      throw new Error('Job creation requires a valid ownerId.');
    }

    return prisma.job.create({
      data: {
        ownerId,
        type,
        payload,
      },
    });
  },

  async createBulkImportVocabularyJob(
    ownerId: string,
    payload: Prisma.InputJsonValue
  ) {
    const validatedPayload = BulkImportVocabularyPayloadSchema.parse(payload);
    return this.createJob(
      ownerId,
      JobType.BULK_IMPORT_VOCABULARY,
      validatedPayload as any
    );
  },

  async createBulkImportStudentsJob(
    ownerId: string,
    payload: Prisma.InputJsonValue
  ) {
    const validatedPayload = BulkImportStudentsPayloadSchema.parse(payload);
    return this.createJob(
      ownerId,
      JobType.BULK_IMPORT_STUDENTS,
      validatedPayload as any
    );
  },

  async createBulkImportSchedulesJob(
    ownerId: string,
    payload: Prisma.InputJsonValue
  ) {
    const validatedPayload = BulkImportSchedulesPayloadSchema.parse(payload);
    return this.createJob(
      ownerId,
      JobType.BULK_IMPORT_SCHEDULES,
      validatedPayload as any
    );
  },

  async createBulkImportGenericDeckJob(
    ownerId: string,
    payload: Prisma.InputJsonValue
  ) {
    const validatedPayload = BulkImportGenericDeckPayloadSchema.parse(payload);
    return this.createJob(
      ownerId,
      JobType.BULK_IMPORT_GENERIC_DECK,
      validatedPayload as any
    );
  },

  /**
   * Retrieves the status and details of a specific job.
   * This operation is strictly authorized; it will only return a job if the
   * requesting user is the one who created it.
   *
   * @param jobId The UUID of the job to retrieve.
   * @param ownerId The UUID of the Teacher requesting the job status.
   * @returns A promise that resolves to the Job object if found and authorized, otherwise null.
   */
  async getJobStatus(jobId: string, ownerId: string): Promise<Job | null> {
    if (!jobId || !ownerId) {
      return null;
    }
    return prisma.job.findFirst({
      where: {
        id: jobId,
        ownerId: ownerId,
      },
    });
  },

  /**
   * Retrieves all jobs for a specific teacher, ordered by creation date (newest first).
   * This provides the data needed for the job monitoring page.
   *
   * @param ownerId The UUID of the Teacher whose jobs to retrieve.
   * @returns A promise that resolves to an array of Job objects.
   */
  async getAllJobsForTeacher(ownerId: string): Promise<Job[]> {
    if (!ownerId) {
      return [];
    }

    return prisma.job.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
  },
};
