import { NextRequest } from 'next/server'
import { z } from 'zod'
import { ContentService } from '@/lib/actions/content'
import { requireAuth } from '@/lib/auth'
import { apiResponse, handleApiError } from '@/lib/api-utils'

interface RouteParams {
  params: Promise<{ exerciseId: string }>
}

const ReorderQuestionsSchema = z.object({
  questionIds: z.array(z.string().uuid()).min(1, 'At least one question ID required'),
})

// PUT /api/fill-in-blank/[exerciseId]/questions/reorder - Reorder questions
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const teacherId = await requireAuth(request)
    const { exerciseId } = await params
    
    const body = await request.json()
    const { questionIds } = ReorderQuestionsSchema.parse(body)

    await ContentService.reorderFillInBlankQuestions(exerciseId, teacherId, questionIds)

    return apiResponse(200, { success: true }, null)
  } catch (error) {
    console.error('Error reordering fill-in-blank questions:', error)
    return handleApiError(error)
  }
}