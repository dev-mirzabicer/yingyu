import { prisma } from '@/lib/db';
import { Job, JobType, Prisma } from '@prisma/client';

// Define a type for Prisma's transaction client to improve readability.
type PrismaTransactionClient = Omit<
  Prisma.TransactionClient,
  '$use' | '$on' | '$connect' | '$disconnect' | '$executeRaw' | '$queryRaw'
>;

/**
 * Service responsible for managing asynchronous jobs.
 * This service acts as a secure gateway for creating and monitoring background tasks.
 * It does not execute the jobs themselves; that is the responsibility of a separate
 * background worker process.
 */
export const JobService = {
  /**
   * Creates a new job record in the database.
   * This method is now transaction-aware. If a Prisma transaction client (`tx`)
   * is provided, the job creation will become part of that transaction,
   * ensuring atomicity with other database operations.
   *
   * @param ownerId The UUID of the Teacher who is initiating the job.
   * @param type The type of job to be executed.
   * @param payload The JSON data required by the worker to execute the job.
   * @param tx An optional Prisma transaction client.
   * @returns A promise that resolves to the newly created Job object.
   * @throws {Error} if the ownerId is not provided.
   */
  async createJob(
    ownerId: string,
    type: JobType,
    payload: Prisma.InputJsonValue,
    tx?: PrismaTransactionClient
  ): Promise<Job> {
    if (!ownerId) {
      throw new Error('Job creation requires a valid ownerId.');
    }

    // Use the provided transaction client, or fall back to the global prisma instance.
    const db = tx || prisma;

    const job = await db.job.create({
      data: {
        ownerId,
        type,
        payload,
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
};
