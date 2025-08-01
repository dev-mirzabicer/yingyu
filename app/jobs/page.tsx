import { JobMonitoringSystem } from "@/components/job-monitoring-system"

// Mock teacher ID - in production this would come from auth context
const MOCK_TEACHER_ID = "8326a8fc-91c3-475a-8fc2-68b4896449cd"

export default function JobsPage() {
  return <JobMonitoringSystem teacherId={MOCK_TEACHER_ID} />
}