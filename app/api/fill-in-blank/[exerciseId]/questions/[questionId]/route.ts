import { NextRequest } from 'next/server'
import { z } from 'zod'
import { ContentService } from '@/lib/actions/content'
import { requireAuth } from '@/lib/auth'
import { apiResponse, handleApiError } from '@/lib/api-utils'

interface RouteParams {
  params: Promise<{ exerciseId: string; questionId: string }>
}

const UpdateQuestionSchema = z.object({
  sentence: z.string().min(1).optional(),
  correctAnswer: z.string().min(1).optional(),
  vocabularyCardId: z.string().uuid().nullable().optional(),
  distractors: z.array(z.string()).optional(),
  difficultyLevel: z.number().int().min(1).max(10).optional(),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

// GET /api/fill-in-blank/[exerciseId]/questions/[questionId] - Get specific question
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const teacherId = await requireAuth(request)
    const { exerciseId, questionId } = await params

    const question = await ContentService.getFillInBlankQuestion(questionId, exerciseId, teacherId)
    
    return apiResponse(200, question, null)
  } catch (error) {
    console.error('Error fetching fill-in-blank question:', error)
    return handleApiError(error)
  }
}

// PUT /api/fill-in-blank/[exerciseId]/questions/[questionId] - Update question
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const teacherId = await requireAuth(request)
    const { exerciseId, questionId } = await params
    
    const body = await request.json()
    const validatedData = UpdateQuestionSchema.parse(body)

    const question = await ContentService.updateFillInBlankQuestion(
      questionId,
      exerciseId,
      teacherId,
      validatedData
    )

    return apiResponse(200, question, null)
  } catch (error) {
    console.error('Error updating fill-in-blank question:', error)
    return handleApiError(error)
  }
}

// DELETE /api/fill-in-blank/[exerciseId]/questions/[questionId] - Delete question
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const teacherId = await requireAuth(request)
    const { exerciseId, questionId } = await params

    await ContentService.deleteFillInBlankQuestion(questionId, exerciseId, teacherId)

    return apiResponse(200, { success: true }, null)
  } catch (error) {
    console.error('Error deleting fill-in-blank question:', error)
    return handleApiError(error)
  }
}