import { TeacherSettingsPanel } from "@/components/teacher-settings-panel"

// Mock teacher ID - in production this would come from auth context
const MOCK_TEACHER_ID = "8326a8fc-91c3-475a-8fc2-68b4896449cd"

export default function SettingsPage() {
  return <TeacherSettingsPanel teacherId={MOCK_TEACHER_ID} />
}