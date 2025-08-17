import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ContentService } from '@/lib/actions/content'
import { requireAuth } from '@/lib/auth'
import { apiResponse, handleApiError } from '@/lib/api-utils'

interface RouteParams {
  params: Promise<{ exerciseId: string }>
}

const UpdateFillInBlankSchema = z.object({
  title: z.string().min(1).optional(),
  vocabularyDeckId: z.string().uuid().optional(),
  difficultyLevel: z.number().int().min(1).max(10).optional(),
  explanation: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
})

// GET /api/fill-in-blank/[exerciseId] - Get specific exercise
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const teacherId = await requireAuth(request)
    const { exerciseId } = await params

    const exercise = await ContentService.getFillInBlankExercise(exerciseId, teacherId)
    
    return apiResponse(200, exercise, null)
  } catch (error) {
    console.error('Error fetching fill-in-blank exercise:', error)
    return handleApiError(error)
  }
}

// PUT /api/fill-in-blank/[exerciseId] - Update exercise
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const teacherId = await requireAuth(request)
    const { exerciseId } = await params
    
    const body = await request.json()
    const validatedData = UpdateFillInBlankSchema.parse(body)

    const exercise = await ContentService.updateFillInBlankExercise(
      exerciseId,
      teacherId,
      validatedData
    )

    return apiResponse(200, exercise, null)
  } catch (error) {
    console.error('Error updating fill-in-blank exercise:', error)
    return handleApiError(error)
  }
}

// DELETE /api/fill-in-blank/[exerciseId] - Delete exercise (soft delete)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const teacherId = await requireAuth(request)
    const { exerciseId } = await params

    await ContentService.deleteFillInBlankExercise(exerciseId, teacherId)

    return apiResponse(200, { success: true }, null)
  } catch (error) {
    console.error('Error deleting fill-in-blank exercise:', error)
    return handleApiError(error)
  }
}