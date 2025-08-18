import { NextRequest } from 'next/server'
import { z } from 'zod'
import { ContentService } from '@/lib/actions/content'
import { requireAuth } from '@/lib/auth'
import { apiResponse, handleApiError } from '@/lib/api-utils'

interface RouteParams {
  params: Promise<{ exerciseId: string }>
}

const BulkCreateQuestionsSchema = z.object({
  questions: z.array(z.object({
    sentence: z.string().min(1),
    correctAnswer: z.string().min(1),
    vocabularyCardId: z.string().uuid().optional(),
    distractors: z.array(z.string()).optional().default([]),
    difficultyLevel: z.number().int().min(1).max(10).optional().default(1),
  })).min(1, 'At least one question required'),
})

const BulkUpdateQuestionsSchema = z.object({
  updates: z.array(z.object({
    id: z.string().uuid(),
    sentence: z.string().min(1).optional(),
    correctAnswer: z.string().min(1).optional(),
    vocabularyCardId: z.string().uuid().nullable().optional(),
    distractors: z.array(z.string()).optional(),
    difficultyLevel: z.number().int().min(1).max(10).optional(),
    isActive: z.boolean().optional(),
  })).min(1, 'At least one update required'),
})

const BulkDeleteQuestionsSchema = z.object({
  questionIds: z.array(z.string().uuid()).min(1, 'At least one question ID required'),
})

// POST /api/fill-in-blank/[exerciseId]/questions/bulk - Bulk create questions
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const teacherId = await requireAuth(request)
    const { exerciseId } = await params
    
    const body = await request.json()
    const { questions } = BulkCreateQuestionsSchema.parse(body)

    const createdQuestions = await ContentService.bulkCreateFillInBlankQuestions({
      exerciseId,
      teacherId,
      questions,
    })

    return apiResponse(201, { createdQuestions, count: createdQuestions.length }, null)
  } catch (error) {
    console.error('Error bulk creating fill-in-blank questions:', error)
    return handleApiError(error)
  }
}

// PUT /api/fill-in-blank/[exerciseId]/questions/bulk - Bulk update questions
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const teacherId = await requireAuth(request)
    const { exerciseId } = await params
    
    const body = await request.json()
    const { updates } = BulkUpdateQuestionsSchema.parse(body)

    const updatedQuestions = await ContentService.bulkUpdateFillInBlankQuestions({
      exerciseId,
      teacherId,
      updates,
    })

    return apiResponse(200, { updatedQuestions, count: updatedQuestions.length }, null)
  } catch (error) {
    console.error('Error bulk updating fill-in-blank questions:', error)
    return handleApiError(error)
  }
}

// DELETE /api/fill-in-blank/[exerciseId]/questions/bulk - Bulk delete questions
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const teacherId = await requireAuth(request)
    const { exerciseId } = await params
    
    const body = await request.json()
    const { questionIds } = BulkDeleteQuestionsSchema.parse(body)

    const deletedCount = await ContentService.bulkDeleteFillInBlankQuestions({
      exerciseId,
      teacherId,
      questionIds,
    })

    return apiResponse(200, { success: true, deletedCount }, null)
  } catch (error) {
    console.error('Error bulk deleting fill-in-blank questions:', error)
    return handleApiError(error)
  }
}