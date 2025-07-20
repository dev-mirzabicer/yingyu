import { NextResponse } from 'next/server';
import { processPendingJobs } from '@/lib/worker';

/**
 * This is the secure API endpoint that will be called by a scheduler (e.g., Vercel Cron).
 * It is responsible for authenticating the request and triggering the job processing logic.
 *
 * @param request The incoming Next.js request object.
 * @returns A NextResponse object indicating the result of the operation.
 */
export async function POST(request: Request) {
  // 1. Meticulous Security Check:
  // The scheduler MUST provide a secret key in the Authorization header.
  // This prevents unauthorized users from triggering our worker.
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Return a 401 Unauthorized response if the secret is missing or incorrect.
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // 2. Delegate to the Core Worker Logic:
  // The route's only responsibility after authentication is to call the core processor.
  try {
    const result = await processPendingJobs();
    // 3. Return a successful response with details of the run.
    return NextResponse.json({
      ok: true,
      message: `Worker run completed. Processed ${result.processedJobs} jobs.`,
      results: result.jobResults,
    });
  } catch (error) {
    // 4. Robust Error Handling:
    // If any unexpected error occurs during the processing, log it and return a 500 error.
    console.error('[Worker Route Error]', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
