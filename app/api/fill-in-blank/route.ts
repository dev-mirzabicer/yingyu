import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ContentService } from '@/lib/actions/content'
import { requireAuth } from '@/lib/auth'
import { apiResponse, handleApiError } from '@/lib/api-utils'

// Schema for creating fill-in-blank exercises
const CreateFillInBlankSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  vocabularyDeckId: z.string().uuid('Invalid vocabulary deck ID'),
  difficultyLevel: z.number().int().min(1).max(10).optional().default(1),
  explanation: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
  isPublic: z.boolean().optional().default(false),
})

const ListFillInBlankSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional().default(1),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default(10),
  search: z.string().optional(),
  deckId: z.string().uuid().optional(),
  isPublic: z.string().transform(val => val === 'true').optional(),
})

// GET /api/fill-in-blank - List fill-in-blank exercises
export async function GET(request: NextRequest) {
  try {
    const teacherId = await requireAuth(request)
    
    const url = new URL(request.url)
    const queryParams = Object.fromEntries(url.searchParams.entries())
    const { page, limit, search, deckId, isPublic } = ListFillInBlankSchema.parse(queryParams)

    const exercises = await ContentService.getFillInBlankExercises({
      creatorId: teacherId,
      page,
      limit,
      search,
      deckId,
      isPublic,
    })

    return apiResponse(200, exercises, null)
  } catch (error) {
    console.error('Error fetching fill-in-blank exercises:', error)
    return handleApiError(error)
  }
}

// POST /api/fill-in-blank - Create new fill-in-blank exercise
export async function POST(request: NextRequest) {
  try {
    const teacherId = await requireAuth(request)
    
    const body = await request.json()
    const validatedData = CreateFillInBlankSchema.parse(body)

    const exercise = await ContentService.createFillInBlankExercise({
      ...validatedData,
      creatorId: teacherId,
    })

    return apiResponse(201, exercise, null)
  } catch (error) {
    console.error('Error creating fill-in-blank exercise:', error)
    return handleApiError(error)
  }
}