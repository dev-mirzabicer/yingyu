"use client"

import { Job, JobStatus } from "@prisma/client"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  CheckCircle,
  AlertTriangle,
  Loader2,
  Info,
  Brain,
  RefreshCw,
} from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { useJobStatus } from "@/hooks/api/jobs"

interface JobStatusIndicatorProps {
  jobId: string | null
  title: string
  description: string
  onComplete?: (job: Job) => void
}

const statusIcons = {
  [JobStatus.PENDING]: <Loader2 className="h-4 w-4 animate-spin" />,
  [JobStatus.RUNNING]: <Loader2 className="h-4 w-4 animate-spin" />,
  [JobStatus.COMPLETED]: <CheckCircle className="h-4 w-4 text-green-500" />,
  [JobStatus.FAILED]: <AlertTriangle className="h-4 w-4 text-red-500" />,
}

const statusTitles = {
  [JobStatus.PENDING]: "Job is Pending",
  [JobStatus.RUNNING]: "Job is Running",
  [JobStatus.COMPLETED]: "Job Completed",
  [JobStatus.FAILED]: "Job Failed",
}

export function JobStatusIndicator({
  jobId,
  title,
  description,
  onComplete,
}: JobStatusIndicatorProps) {
  const { job, isLoading, isError } = useJobStatus(jobId)

  if (!jobId || !job) return null

  if (isLoading) {
    return (
      <Alert>
        <Loader2 className="h-4 w-4 animate-spin" />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{description}</AlertDescription>
      </Alert>
    )
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Could not retrieve job status. Please refresh the page.
        </AlertDescription>
      </Alert>
    )
  }

  if (job.status === JobStatus.COMPLETED && onComplete) {
    onComplete(job)
  }

  return (
    <Alert
      className={
        job.status === JobStatus.COMPLETED
          ? "border-green-500/50"
          : job.status === JobStatus.FAILED
          ? "border-red-500/50"
          : ""
      }
    >
      {statusIcons[job.status]}
      <AlertTitle>{statusTitles[job.status]}</AlertTitle>
      <AlertDescription>
        {job.status === JobStatus.FAILED && job.error ? (
          <pre className="mt-2 whitespace-pre-wrap rounded-md bg-slate-950 p-4 text-xs text-white">
            {JSON.stringify(job.error, null, 2)}
          </pre>
        ) : job.status === JobStatus.COMPLETED && job.result ? (
          <pre className="mt-2 whitespace-pre-wrap rounded-md bg-slate-950 p-4 text-xs text-white">
            {JSON.stringify(job.result, null, 2)}
          </pre>
        ) : (
          description
        )}
      </AlertDescription>
    </Alert>
  )
}
