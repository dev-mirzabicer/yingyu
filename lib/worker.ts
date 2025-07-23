import { prisma } from './db';
import { Job, JobStatus, JobType, StudentStatus } from '@prisma/client';
import { StudentService } from './actions/students';
import { FSRSService } from './actions/fsrs';

/**
 * Processes all currently pending jobs in the queue.
 * This function is  status-aware and will skip jobs for inactive students.
 * This function is designed to be called by the secure API route.
 * It uses a transactional, database-level lock to be completely race-condition-proof.
 */
export async function processPendingJobs() {
  // --- Transactional Job Locking ---
  const lockedJobs = await prisma.$transaction(async (tx) => {
    // Step 1: Find a batch of pending jobs using a raw SQL query.
    // "FOR UPDATE" locks the selected rows, preventing other transactions from touching them.
    // "SKIP LOCKED" is the key for a multi-worker environment. If another worker has
    // already locked some rows, this query will simply ignore them and move on,
    // preventing deadlocks and ensuring workers don't step on each other's toes.
    const jobsToProcess = await tx.$queryRaw<Job[]>`
      SELECT * FROM "Job"
      WHERE status = 'PENDING'
      ORDER BY "createdAt" ASC
      LIMIT 10
      FOR UPDATE SKIP LOCKED
    `;
    // If no jobs are found, we can exit the transaction early.
    if (jobsToProcess.length === 0) return [];
    // Step 2: Immediately update the status of these locked jobs to RUNNING.
    // Since this happens inside the same transaction, it's an atomic part of the lock.
    await tx.job.updateMany({
      where: { id: { in: jobsToProcess.map((job: Job) => job.id) } },
      data: { status: JobStatus.RUNNING },
    });
    // Step 3: Return the jobs that we have successfully locked.
    return jobsToProcess;
  });

  if (lockedJobs.length === 0) {
    return { processedJobs: 0, jobResults: [] };
  }

  const jobResults = [];

  // --- Job Execution ---
  for (const job of lockedJobs) {
    try {
      // --- Status-Aware Check ---
      // Before executing any job, we check the status of the associated student.
      const studentId = (job.payload as { studentId?: string })?.studentId;
      if (studentId) {
        const student = await prisma.student.findUnique({
          where: { id: studentId },
          select: { status: true, isArchived: true },
        });

        // If the student is archived or not active, we skip the job.
        if (
          !student ||
          student.isArchived ||
          student.status !== StudentStatus.ACTIVE
        ) {
          await prisma.job.update({
            where: { id: job.id },
            data: {
              status: JobStatus.SKIPPED,
              result: { message: `Student is not active or is archived.` },
            },
          });
          jobResults.push({ jobId: job.id, status: 'SKIPPED' });
          continue; // Move to the next job.
        }
      }
      // --- End Status-Aware Check ---

      let resultPayload;
      // Dispatch the job to the appropriate handler based on its type.
      switch (job.type) {
        case JobType.INITIALIZE_CARD_STATES:
          resultPayload = await StudentService._initializeCardStates(
            job.payload
          );
          break;
        // TODO: will add other job types here in the future.
        // case JobType.GENERATE_PRACTICE_PDF:
        //   resultPayload = await PDFService._generate(job.payload);
        //   break;
        case JobType.REBUILD_FSRS_CACHE:
          resultPayload = await FSRSService._rebuildCacheForStudent(
            job.payload
          );
          break;
        default:
          throw new Error(`Unknown or unimplemented job type: ${job.type}`);
      }

      // Mark the job as COMPLETED on success.
      await prisma.job.update({
        where: { id: job.id },
        data: { status: JobStatus.COMPLETED, result: resultPayload },
      });
      jobResults.push({ jobId: job.id, status: 'COMPLETED' });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred.';
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: JobStatus.FAILED,
          error: errorMessage,
        },
      });
      jobResults.push({
        jobId: job.id,
        status: 'FAILED',
        error: errorMessage,
      });
    }
  }

  return { processedJobs: lockedJobs.length, jobResults };
}
