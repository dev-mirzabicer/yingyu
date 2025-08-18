import { NextRequest } from 'next/server'
import { z } from 'zod'
import { ContentService } from '@/lib/actions/content'
import { requireAuth } from '@/lib/auth'
import { apiResponse, handleApiError } from '@/lib/api-utils'

interface RouteParams {
  params: Promise<{ exerciseId: string }>
}

const CreateQuestionSchema = z.object({
  sentence: z.string().min(1, 'Sentence is required'),
  correctAnswer: z.string().min(1, 'Correct answer is required'),
  vocabularyCardId: z.string().uuid().optional(),
  distractors: z.array(z.string()).optional().default([]),
  difficultyLevel: z.number().int().min(1).max(10).optional().default(1),
  order: z.number().int().min(0).optional().default(0),
})

const ListQuestionsSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional().default(1),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default(20),
  search: z.string().optional(),
  activeOnly: z.string().transform(val => val === 'true').optional().default(true),
})

// GET /api/fill-in-blank/[exerciseId]/questions - List questions for exercise
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const teacherId = await requireAuth(request)
    const { exerciseId } = await params
    
    const url = new URL(request.url)
    const queryParams = Object.fromEntries(url.searchParams.entries())
    const { page, limit, search, activeOnly } = ListQuestionsSchema.parse(queryParams)

    const questions = await ContentService.getFillInBlankQuestions({
      exerciseId,
      teacherId,
      page,
      limit,
      search,
      activeOnly,
    })

    return apiResponse(200, questions, null)
  } catch (error) {
    console.error('Error fetching fill-in-blank questions:', error)
    return handleApiError(error)
  }
}

// POST /api/fill-in-blank/[exerciseId]/questions - Create new question
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const teacherId = await requireAuth(request)
    const { exerciseId } = await params
    
    const body = await request.json()
    const validatedData = CreateQuestionSchema.parse(body)

    const question = await ContentService.createFillInBlankQuestion({
      exerciseId,
      teacherId,
      ...validatedData,
    })

    return apiResponse(201, question, null)
  } catch (error) {
    console.error('Error creating fill-in-blank question:', error)
    return handleApiError(error)
  }
}