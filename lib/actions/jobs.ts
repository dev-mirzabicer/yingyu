import { prisma } from '@/lib/db';
import { Job, JobType, Prisma } from '@prisma/client';

/**
 * Service responsible for managing asynchronous jobs.
 * This service acts as a secure gateway for creating and monitoring background tasks.
 * It does not execute the jobs themselves; that is the responsibility of a separate
 * background worker process.
 */
export const JobService = {
  /**
   * Creates a new job record in the database, placing it in the queue for the worker.
   * This is the primary method for initiating any long-running, asynchronous task.
   *
   * @param ownerId The UUID of the Teacher who is initiating the job. This is crucial for authorization.
   * @param type The type of job to be executed, defined by the JobType enum.
   * @param payload The JSON data required by the worker to execute the job.
   * @returns A promise that resolves to the newly created Job object.
   * @throws {Error} if the ownerId is not provided.
   */
  async createJob(
    ownerId: string,
    type: JobType,
    payload: Prisma.InputJsonValue
  ): Promise<Job> {
    // check: A job must always have an owner.
    if (!ownerId) {
      // We throw a standard error here as this is a fundamental logic violation,
      // indicating a programming error in the calling service.
      throw new Error('Job creation requires a valid ownerId.');
    }

    const job = await prisma.job.create({
      data: {
        ownerId,
        type,
        payload,
        // The status defaults to PENDING as per the schema, so it's not explicitly set here.
      },
    });

    return job;
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
    // Meticulous check: Ensure valid identifiers are provided before querying.
    if (!jobId || !ownerId) {
      return null;
    }
    // The job must belong to the owner.
    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        ownerId: ownerId,
      },
    });

    return job;
  },
};
