import { NextResponse } from 'next/server';
import { JobService } from '@/lib/actions/jobs';
import { getAuth } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: { jobId: string } }
) {
  const { jobId } = params;
  const { teacherId } = getAuth(request);

  if (!teacherId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!jobId) {
    return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
  }

  try {
    const job = await JobService.getJobStatus(jobId, teacherId);

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (error) {
    console.error(`[JOB_STATUS_API] Error fetching job ${jobId}:`, error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
