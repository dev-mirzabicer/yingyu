// In /app/api/worker/run/route.ts
import { processPendingJobs } from '@/lib/worker';
import { apiResponse, handleApiError } from '@/lib/api-utils';

/**
 * A DEVELOPMENT-ONLY endpoint to manually trigger the background job worker.
 * This is essential for end-to-end testing scenarios to resolve race conditions
 * between job creation and job execution.
 * In a production environment, this endpoint should be disabled.
 */
export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return apiResponse(404, null, 'Not found.');
  }

  try {
    const result = await processPendingJobs();
    return apiResponse(200, result, null);
  } catch (error) {
    return handleApiError(error);
  }
}
