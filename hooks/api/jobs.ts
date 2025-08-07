import useSWR from 'swr';
import { Job, JobStatus } from '@prisma/client';
import { fetcher } from './utils';

/**
 * A hook to poll for the status of a specific job.
 *
 * @param jobId The ID of the job to poll. If null, the hook will not fetch.
 * @returns An object containing the job data, loading state, and any errors.
 */
export function useJobStatus(jobId: string | null) {
  const { data: job, error } = useSWR<Job>(
    jobId ? `/api/jobs/${jobId}` : null,
    fetcher,
    {
      refreshInterval: (latestData) => {
        // Stop polling if the job is completed or failed
        if (
          latestData?.status === JobStatus.COMPLETED ||
          latestData?.status === JobStatus.FAILED
        ) {
          return 0;
        }
        // Poll every 2 seconds
        return 2000;
      },
      dedupingInterval: 2000, // Avoid multiple requests in a short time
    }
  );

  return {
    job,
    isLoading: !job && !error,
    isError: !!error,
    error,
  };
}
