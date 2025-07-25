import { prisma } from './db';
import { Job, JobStatus, JobType, StudentStatus } from '@prisma/client';
import { StudentService } from './actions/students';
import { FSRSService } from './actions/fsrs';
import {
  InitializeCardStatesPayloadSchema,
  RebuildCachePayloadSchema,
} from './schemas';

/**
 * Processes all currently pending jobs in the queue.
 * This function is  status-aware and will skip jobs for inactive students.
 * This function is designed to be called by the secure API route.
 * It uses a transactional, database-level lock to be completely race-condition-proof.
 */
export async function processPendingJobs() {
  // --- Transactional Job Locking (remains the same) ---
  const lockedJobs = await prisma.$transaction(async (tx) => {
    const jobsToProcess = await tx.$queryRaw<Job[]>`
      SELECT * FROM "Job"
      WHERE status = 'PENDING'
      ORDER BY "createdAt" ASC
      LIMIT 10
      FOR UPDATE SKIP LOCKED
    `;
    if (jobsToProcess.length === 0) return [];
    await tx.job.updateMany({
      where: { id: { in: jobsToProcess.map((job) => job.id) } },
      data: { status: JobStatus.RUNNING },
    });
    return jobsToProcess;
  });

  if (lockedJobs.length === 0) {
    return { processedJobs: 0, jobResults: [] };
  }

  const jobResults = [];

  // --- Job Execution ---
  for (const job of lockedJobs) {
    try {
      // --- Status-Aware Check (remains the same) ---
      const studentId = (job.payload as { studentId?: string })?.studentId;
      if (studentId) {
        const student = await prisma.student.findUnique({
          where: { id: studentId },
          select: { status: true, isArchived: true },
        });
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
          continue;
        }
      }

      let resultPayload;
      // REFINEMENT: Dispatch logic now includes robust payload validation.
      switch (job.type) {
        case JobType.INITIALIZE_CARD_STATES: {
          const payload = InitializeCardStatesPayloadSchema.parse(job.payload);
          resultPayload = await StudentService._initializeCardStates(payload);
          break;
        }
        case JobType.REBUILD_FSRS_CACHE: {
          const payload = RebuildCachePayloadSchema.parse(job.payload);
          resultPayload = await FSRSService._rebuildCacheForStudent(payload);
          break;
        }
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
      // This block now catches ZodErrors as well, providing clear feedback on malformed payloads.
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
