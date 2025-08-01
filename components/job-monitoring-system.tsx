"use client"

import { Label } from "@/components/ui/label"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Play,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Eye,
  Trash2,
  Settings,
  FileText,
  Brain,
  Database,
} from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import { useJobs } from "@/hooks/use-api-enhanced"
import type { Job, JobStatus } from "@prisma/client"

interface JobMonitoringSystemProps {
  teacherId: string
}


const jobTypeIcons = {
  INITIALIZE_CARD_STATES: Database,
  GENERATE_PRACTICE_PDF: FileText,
  OPTIMIZE_FSRS_PARAMS: Brain,
  REBUILD_FSRS_CACHE: RefreshCw,
}

const jobTypeLabels = {
  INITIALIZE_CARD_STATES: "Initialize Card States",
  GENERATE_PRACTICE_PDF: "Generate Practice PDF",
  OPTIMIZE_FSRS_PARAMS: "Optimize FSRS Parameters",
  REBUILD_FSRS_CACHE: "Rebuild FSRS Cache",
}

const statusColors = {
  PENDING: "bg-slate-100 text-slate-700 border-slate-200",
  RUNNING: "bg-blue-100 text-blue-700 border-blue-200",
  COMPLETED: "bg-green-100 text-green-700 border-green-200",
  FAILED: "bg-red-100 text-red-700 border-red-200",
  SKIPPED: "bg-yellow-100 text-yellow-700 border-yellow-200",
}

const statusIcons = {
  PENDING: Clock,
  RUNNING: Play,
  COMPLETED: CheckCircle,
  FAILED: XCircle,
  SKIPPED: AlertTriangle,
}

export function JobMonitoringSystem({ teacherId }: JobMonitoringSystemProps) {
  const { jobs, isLoading, isError, mutate } = useJobs()
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isJobDetailOpen, setIsJobDetailOpen] = useState(false)
  const [filter, setFilter] = useState<JobStatus | "ALL">("ALL")

  const { toast } = useToast()

  const filteredJobs = filter === "ALL" ? jobs : jobs.filter((job) => job.status === filter)
  const runningJobs = jobs.filter((job) => job.status === "RUNNING")
  const completedJobs = jobs.filter((job) => job.status === "COMPLETED")
  const failedJobs = jobs.filter((job) => job.status === "FAILED")

  const handleViewJobDetails = (job: JobWithDetails) => {
    setSelectedJob(job)
    setIsJobDetailOpen(true)
  }

  const handleRetryJob = (jobId: string) => {
    // In production, this would call the API to retry the job
    toast({
      title: "Feature not implemented",
      description: "Job retry functionality will be implemented in a future version.",
      variant: "default",
    })
  }

  const handleCancelJob = (jobId: string) => {
    // In production, this would call the API to cancel the job
    toast({
      title: "Feature not implemented", 
      description: "Job cancellation functionality will be implemented in a future version.",
      variant: "default",
    })
  }

  const handleDeleteJob = (jobId: string) => {
    // In production, this would call the API to delete the job
    toast({
      title: "Feature not implemented",
      description: "Job deletion functionality will be implemented in a future version.",
      variant: "default",
    })
  }

  const JobCard = ({ job }: { job: Job }) => {
    const Icon = jobTypeIcons[job.type]
    const StatusIcon = statusIcons[job.status]

    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-slate-100 rounded-lg">
                <Icon className="h-5 w-5 text-slate-600" />
              </div>
              <div className="space-y-1">
                <h4 className="font-medium text-slate-900">{jobTypeLabels[job.type]}</h4>
                <p className="text-sm text-slate-500">
                  Started {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Badge variant="outline" className={statusColors[job.status]}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {job.status.charAt(0) + job.status.slice(1).toLowerCase()}
              </Badge>
              <Button variant="ghost" size="sm" onClick={() => handleViewJobDetails(job)}>
                <Eye className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {job.status === "FAILED" && job.error && (
            <div className="mt-3">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">{job.error}</AlertDescription>
              </Alert>
            </div>
          )}

          {job.status === "COMPLETED" && job.result && (
            <div className="mt-3 p-2 bg-green-50 rounded-lg">
              <p className="text-sm text-green-800">✓ Completed successfully</p>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Job Monitor</h2>
            <p className="text-slate-600">Track background tasks and system operations</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-slate-600">Loading jobs...</span>
        </div>
      </div>
    )
  }

  // Error state
  if (isError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Job Monitor</h2>
            <p className="text-slate-600">Track background tasks and system operations</p>
          </div>
          <Button variant="outline" onClick={() => mutate()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-slate-600">Failed to load jobs. Please try again.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Job Monitor</h2>
          <p className="text-slate-600">Track background tasks and system operations</p>
        </div>
        <Button variant="outline" onClick={() => mutate()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Play className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">Running</p>
                <p className="text-2xl font-bold text-slate-900">{runningJobs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">Completed</p>
                <p className="text-2xl font-bold text-slate-900">{completedJobs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">Failed</p>
                <p className="text-2xl font-bold text-slate-900">{failedJobs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Settings className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">Total</p>
                <p className="text-2xl font-bold text-slate-900">{jobs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Job List */}
      <Tabs value={filter} onValueChange={(value) => setFilter(value as JobStatus | "ALL")}>
        <TabsList>
          <TabsTrigger value="ALL">All Jobs</TabsTrigger>
          <TabsTrigger value="RUNNING">Running</TabsTrigger>
          <TabsTrigger value="COMPLETED">Completed</TabsTrigger>
          <TabsTrigger value="FAILED">Failed</TabsTrigger>
          <TabsTrigger value="PENDING">Pending</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="space-y-4">
          {filteredJobs.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Settings className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">
                  {filter === "ALL" ? "No jobs found" : `No ${filter.toLowerCase()} jobs`}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredJobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Job Detail Dialog */}
      <Dialog open={isJobDetailOpen} onOpenChange={setIsJobDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{selectedJob && jobTypeLabels[selectedJob.type]} Details</DialogTitle>
          </DialogHeader>

          {selectedJob && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-6">
                {/* Job Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Status</Label>
                    <div className="mt-1">
                      <Badge variant="outline" className={statusColors[selectedJob.status]}>
                        {selectedJob.status}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Type</Label>
                    <p className="mt-1 text-sm text-slate-900">{jobTypeLabels[selectedJob.type]}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Created</Label>
                    <p className="mt-1 text-sm text-slate-900">{format(new Date(selectedJob.createdAt), "PPp")}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Updated</Label>
                    <p className="mt-1 text-sm text-slate-900">{format(new Date(selectedJob.updatedAt), "PPp")}</p>
                  </div>
                </div>


                {/* Payload */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-600">Payload</Label>
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <pre className="text-xs text-slate-700 whitespace-pre-wrap">
                      {JSON.stringify(selectedJob.payload, null, 2)}
                    </pre>
                  </div>
                </div>

                {/* Result */}
                {selectedJob.result && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-600">Result</Label>
                    <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                      <pre className="text-xs text-green-800 whitespace-pre-wrap">
                        {JSON.stringify(selectedJob.result, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Error */}
                {selectedJob.error && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-600">Error</Label>
                    <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                      <p className="text-sm text-red-800">{selectedJob.error}</p>
                    </div>
                  </div>
                )}


                {/* Actions */}
                <div className="flex justify-end space-x-2 pt-4 border-t">
                  {selectedJob.status === "RUNNING" && (
                    <Button
                      variant="outline"
                      onClick={() => handleCancelJob(selectedJob.id)}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      Cancel Job
                    </Button>
                  )}
                  {selectedJob.status === "FAILED" && (
                    <Button
                      variant="outline"
                      onClick={() => handleRetryJob(selectedJob.id)}
                      className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    >
                      Retry Job
                    </Button>
                  )}
                  {(selectedJob.status === "COMPLETED" || selectedJob.status === "FAILED") && (
                    <Button
                      variant="outline"
                      onClick={() => handleDeleteJob(selectedJob.id)}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
