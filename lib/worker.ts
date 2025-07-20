import { prisma } from './db';
import { JobStatus, JobType } from '@prisma/client';
import { StudentService } from './actions/students';

/**
 * Processes all currently pending jobs in the queue.
 * This function is designed to be called by the secure API route.
 * It fetches, locks, and executes jobs one by one.
 */
export async function processPendingJobs() {
  // 1. Fetch a batch of pending jobs.
  const pendingJobs = await prisma.job.findMany({
    where: { status: JobStatus.PENDING },
    take: 10, // Process up to 10 jobs per run to avoid long-running functions.
    orderBy: { createdAt: 'asc' },
  });

  if (pendingJobs.length === 0) {
    return { processedJobs: 0, jobResults: [] };
  }

  // 2. Lock the fetched jobs by updating their status to RUNNING.
  // This is a crucial step to prevent concurrent workers from processing the same job.
  await prisma.job.updateMany({
    where: { id: { in: pendingJobs.map((job) => job.id) } },
    data: { status: JobStatus.RUNNING },
  });

  const jobResults = [];

  // 3. Execute each job sequentially.
  for (const job of pendingJobs) {
    try {
      let resultPayload: any;

      // 4. Dispatch the job to the appropriate handler based on its type.
      switch (job.type) {
        case JobType.INITIALIZE_CARD_STATES:
          resultPayload = await StudentService._initializeCardStates(
            job.payload
          );
          break;
        // Add other job types here in the future.
        // case JobType.GENERATE_PRACTICE_PDF:
        //   resultPayload = await PDFService._generate(job.payload);
        //   break;
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }

      // 5. Mark the job as COMPLETED on success.
      await prisma.job.update({
        where: { id: job.id },
        data: { status: JobStatus.COMPLETED, result: resultPayload },
      });
      jobResults.push({ jobId: job.id, status: 'COMPLETED' });
    } catch (error: any) {
      // 6. Meticulous Error Handling: If a job fails, record the error and mark it as FAILED.
      // This ensures a single failed job does not halt the entire worker.
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: JobStatus.FAILED,
          error: error.message || 'An unknown error occurred.',
        },
      });
      jobResults.push({
        jobId: job.id,
        status: 'FAILED',
        error: error.message,
      });
    }
  }

  return { processedJobs: pendingJobs.length, jobResults };
}
