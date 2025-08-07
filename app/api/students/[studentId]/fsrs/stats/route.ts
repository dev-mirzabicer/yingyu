import { NextResponse } from "next/server"
import { getAuth } from "@/lib/auth"
import { getFsrsStats } from "@/lib/actions/fsrs"
import { handleApiError } from "@/lib/api-utils"

export async function GET(
  req: Request,
  { params }: { params: { studentId: string } }
) {
  try {
    const { teacher } = await getAuth()
    const stats = await getFsrsStats(params.studentId, teacher.id)
    return NextResponse.json(stats)
  } catch (error) {
    return handleApiError(error)
  }
}
