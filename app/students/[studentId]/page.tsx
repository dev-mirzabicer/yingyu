import { StudentProfile } from "@/components/student-profile"

interface PageProps {
  params: Promise<{
    studentId: string
  }>
}

export default async function StudentPage({ params }: PageProps) {
  const { studentId } = await params
  return <StudentProfile studentId={studentId} />
}