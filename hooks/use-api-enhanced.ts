"use client"

import useSWR, { mutate } from "swr"
import { useState } from "react"
import type {
  FullStudentProfile,
  FullUnit,
  FullSessionState,
  AvailableUnit,
  VocabularyExerciseConfig,
  AnswerPayload,
  NewUnitItemData,
} from "@/lib/types"
import type {
  Unit,
  VocabularyDeck,
  VocabularyCard,
  Payment,
  ClassSchedule,
  Job,
  TeacherSettings,
  StudentCardState,
} from "@prisma/client"

// Enhanced error types for better error handling
export type ApiError = {
  message: string
  status: number
  code?: string
}

export type ApiResponse<T> = {
  ok: boolean
  data: T
  error: string | null
}

// Mock teacher ID - in production this would come from auth context
const MOCK_TEACHER_ID = "ce1b6050-4e08-4b4a-a104-4b5550b37f71";

// Enhanced fetcher with better error handling
const fetcher = async (url: string): Promise<any> => {
  const response = await fetch(url, {
    headers: {
      "X-Teacher-ID": MOCK_TEACHER_ID,
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const error: ApiError = {
      message: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      status: response.status,
      code: errorData.code,
    }
    throw error
  }

  const data = await response.json()
  return data.data
}

// Enhanced mutation helper with optimistic updates
const mutateWithOptimistic = async <T>(
  url: string,
  method: string,
  body?: any,
  optimisticData?: T
): Promise<ApiResponse<T>> => {
  // Optimistic update if provided
  if (optimisticData) {
    mutate(url, optimisticData, false)
  }

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Teacher-ID": MOCK_TEACHER_ID,
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    const data = await response.json()

    if (!response.ok) {
      // Revert optimistic update on error
      if (optimisticData) {
        mutate(url)
      }
      throw new Error(data.error || `HTTP ${response.status}`)
    }

    // Update cache with real data
    mutate(url)
    return data
  } catch (error) {
    // Revert optimistic update on error
    if (optimisticData) {
      mutate(url)
    }
    throw error
  }
}

// ============================================================================
// STUDENT MANAGEMENT HOOKS
// ============================================================================

export function useStudents() {
  const { data, error, isLoading, mutate } = useSWR<FullStudentProfile[]>("/api/students", fetcher)

  return {
    students: data || [],
    isLoading,
    isError: error,
    mutate,
    error: error as ApiError | undefined,
  }
}

export function useStudent(studentId: string) {
  const { data, error, isLoading, mutate } = useSWR<FullStudentProfile>(
    studentId ? `/api/students/${studentId}` : null,
    fetcher,
  )

  return {
    student: data,
    isLoading,
    isError: error,
    mutate,
    error: error as ApiError | undefined,
  }
}

// Enhanced student creation with better error handling
export async function createStudent(
  studentData: { name: string; email: string; notes?: string },
  initialDeckId: string,
) {
  return mutateWithOptimistic<{ student: FullStudentProfile; initializationJob: Job }>(
    "/api/workflows/onboard-student",
    "POST",
    { studentData, initialDeckId },
  )
}

export async function updateStudentNotes(studentId: string, notes: string) {
  return mutateWithOptimistic<FullStudentProfile>(`/api/students/${studentId}/notes`, "PUT", { notes })
}

export async function updateStudent(studentId: string, updateData: { name?: string; email?: string; phone?: string; proficiencyLevel?: string; notes?: string }) {
  return mutateWithOptimistic<FullStudentProfile>(`/api/students/${studentId}`, "PUT", updateData)
}

export async function archiveStudent(studentId: string) {
  return mutateWithOptimistic<{ message: string; student: FullStudentProfile }>(`/api/students/${studentId}`, "DELETE")
}

// ============================================================================
// PAYMENT MANAGEMENT HOOKS
// ============================================================================

export async function recordPayment(
  studentId: string,
  paymentData: { amount: number; classesPurchased: number; paymentDate: string },
) {
  return mutateWithOptimistic<Payment>(`/api/students/${studentId}/payments`, "POST", paymentData)
}

// ============================================================================
// SCHEDULING HOOKS
// ============================================================================

export function useStudentSchedules(studentId: string) {
  const { data, error, isLoading, mutate } = useSWR<ClassSchedule[]>(
    studentId ? `/api/students/${studentId}/schedules` : null,
    fetcher,
  )

  return {
    schedules: data || [],
    isLoading,
    isError: error,
    mutate,
    error: error as ApiError | undefined,
  }
}

export async function createSchedule(studentId: string, scheduleData: { scheduledTime: string }) {
  return mutateWithOptimistic<ClassSchedule>(`/api/students/${studentId}/schedules`, "POST", scheduleData)
}

export async function updateSchedule(scheduleId: string, scheduleData: { scheduledTime?: string; status?: string }) {
  return mutateWithOptimistic<ClassSchedule>(`/api/schedules/${scheduleId}`, "PUT", scheduleData)
}

export async function deleteSchedule(scheduleId: string) {
  return mutateWithOptimistic<ClassSchedule>(`/api/schedules/${scheduleId}`, "DELETE")
}

// ============================================================================
// CONTENT MANAGEMENT HOOKS
// ============================================================================

export function useUnits() {
  const { data, error, isLoading, mutate } = useSWR<Unit[]>("/api/units", fetcher)

  return {
    units: data || [],
    isLoading,
    isError: error,
    mutate,
    error: error as ApiError | undefined,
  }
}

export function useUnit(unitId: string) {
  const { data, error, isLoading, mutate } = useSWR<FullUnit>(unitId ? `/api/units/${unitId}` : null, fetcher)

  return {
    unit: data,
    isLoading,
    isError: error,
    mutate,
    error: error as ApiError | undefined,
  }
}

export function useDecks() {
  const { data, error, isLoading, mutate } = useSWR<VocabularyDeck[]>("/api/decks", fetcher)

  return {
    decks: data || [],
    isLoading,
    isError: error,
    mutate,
    error: error as ApiError | undefined,
  }
}

export function useDeck(deckId: string) {
  const { data, error, isLoading, mutate } = useSWR<VocabularyDeck>(
    deckId ? `/api/decks/${deckId}` : null,
    fetcher
  )

  return {
    deck: data,
    isLoading,
    isError: error,
    mutate,
    error: error as ApiError | undefined,
  }
}

// ============================================================================
// VOCABULARY CARD MANAGEMENT HOOKS
// ============================================================================

export function useDeckCards(deckId: string) {
  const { data, error, isLoading, mutate } = useSWR<VocabularyCard[]>(
    deckId ? `/api/decks/${deckId}/cards` : null,
    fetcher,
  )

  return {
    cards: data || [],
    isLoading,
    isError: error,
    mutate,
    error: error as ApiError | undefined,
  }
}

export async function addCardToDeck(
  deckId: string,
  cardData: {
    englishWord: string
    chineseTranslation: string
    pinyin?: string
    ipaPronunciation?: string
    exampleSentences?: any
    wordType?: string
    difficultyLevel?: number
    audioUrl?: string
    imageUrl?: string
    videoUrl?: string
    frequencyRank?: number
    tags?: string[]
  },
) {
  return mutateWithOptimistic<VocabularyCard>(`/api/decks/${deckId}/cards`, "POST", cardData)
}

export async function updateCard(cardId: string, cardData: Partial<VocabularyCard>) {
  return mutateWithOptimistic<VocabularyCard>(`/api/cards/${cardId}`, "PUT", cardData)
}

export async function deleteCard(cardId: string) {
  return mutateWithOptimistic<VocabularyCard>(`/api/cards/${cardId}`, "DELETE")
}

export async function forkDeck(deckId: string) {
  return mutateWithOptimistic<VocabularyDeck>("/api/decks/fork", "POST", { deckId })
}

// ============================================================================
// UNIT MANAGEMENT HOOKS
// ============================================================================

export async function createUnit(unitData: { name: string; description?: string; isPublic?: boolean }) {
  return mutateWithOptimistic<Unit>("/api/units", "POST", unitData)
}

export async function createDeck(deckData: { name: string; description?: string; isPublic?: boolean }) {
  return mutateWithOptimistic<VocabularyDeck>("/api/decks", "POST", deckData)
}

export async function updateUnit(
  unitId: string,
  unitData: { name?: string; description?: string; isPublic?: boolean },
) {
  return mutateWithOptimistic<Unit>(`/api/units/${unitId}`, "PUT", unitData)
}

export async function addExerciseToUnit(unitId: string, exerciseData: NewUnitItemData) {
  return mutateWithOptimistic<any>(`/api/units/${unitId}/items`, "POST", exerciseData)
}

export async function removeUnitItem(unitId: string, itemId: string) {
  return mutateWithOptimistic<any>(`/api/units/${unitId}/items/${itemId}`, "DELETE")
}

export async function updateUnitItemConfig(unitItemId: string, config: VocabularyExerciseConfig) {
  return mutateWithOptimistic<any>(`/api/items/${unitItemId}/config`, "PUT", config)
}

// ============================================================================
// SESSION MANAGEMENT HOOKS
// ============================================================================

export function useSessions() {
  const { data, error, isLoading, mutate } = useSWR<any[]>("/api/sessions", fetcher)

  return {
    sessions: data || [],
    isLoading,
    isError: error,
    mutate,
    error: error as ApiError | undefined,
  }
}

export function useSession(sessionId: string) {
  const { data, error, isLoading, mutate } = useSWR<FullSessionState>(
    sessionId ? `/api/sessions/${sessionId}` : null,
    fetcher,
    { refreshInterval: 1000 }, // Refresh every second for live sessions
  )

  return {
    session: data,
    isLoading,
    isError: error,
    mutate,
    error: error as ApiError | undefined,
  }
}

export function useAvailableUnits(studentId: string) {
  const { data, error, isLoading, mutate } = useSWR<AvailableUnit[]>(
    studentId ? `/api/students/${studentId}/available-units` : null,
    fetcher,
  )

  return {
    units: data || [],
    isLoading,
    isError: error,
    mutate,
    error: error as ApiError | undefined,
  }
}

export async function startSession(studentId: string, unitId: string) {
  return mutateWithOptimistic<FullSessionState>("/api/sessions/start", "POST", { studentId, unitId })
}

export async function submitAnswer(sessionId: string, payload: AnswerPayload) {
  return mutateWithOptimistic<{ newState: FullSessionState; submissionResult: any }>(
    `/api/sessions/${sessionId}/submit`,
    "POST",
    payload,
  )
}

export async function endSession(sessionId: string) {
  return mutateWithOptimistic<FullSessionState>(`/api/sessions/${sessionId}`, "DELETE")
}

// ============================================================================
// FSRS & ANALYTICS HOOKS
// ============================================================================

export function useDueCards(studentId: string) {
  const { data, error, isLoading, mutate } = useSWR<(StudentCardState & { card: VocabularyCard })[]>(
    studentId ? `/api/students/${studentId}/fsrs/due-cards` : null,
    fetcher,
  )

  return {
    dueCards: data || [],
    isLoading,
    isError: error,
    mutate,
    error: error as ApiError | undefined,
  }
}

export function useListeningCandidates(studentId: string) {
  const { data, error, isLoading, mutate } = useSWR<VocabularyCard[]>(
    studentId ? `/api/students/${studentId}/fsrs/listening-candidates` : null,
    fetcher,
  )

  return {
    candidates: data || [],
    isLoading,
    isError: error,
    mutate,
    error: error as ApiError | undefined,
  }
}

export async function optimizeFsrsParameters(studentId: string) {
  return mutateWithOptimistic<Job>(`/api/students/${studentId}/fsrs/optimize-parameters`, "POST")
}

export async function rebuildFsrsCache(studentId: string) {
  return mutateWithOptimistic<Job>(`/api/students/${studentId}/fsrs/rebuild-cache`, "POST")
}

// ============================================================================
// DECK ASSIGNMENT HOOKS
// ============================================================================

export async function assignDeck(studentId: string, deckId: string) {
  return mutateWithOptimistic<{ studentDeck: any; job: Job }>(`/api/students/${studentId}/decks`, "POST", { deckId })
}


// ============================================================================
// TEACHER SETTINGS HOOKS
// ============================================================================

export function useTeacherSettings() {
  const { data, error, isLoading, mutate } = useSWR<TeacherSettings>("/api/teacher/settings", fetcher)

  return {
    settings: data,
    isLoading,
    isError: error,
    mutate,
    error: error as ApiError | undefined,
  }
}

export async function updateTeacherSettings(settingsData: {
  paymentAlertThreshold?: number
  preferredLessonDuration?: number
}) {
  return mutateWithOptimistic<TeacherSettings>("/api/teacher/settings", "PUT", settingsData)
}

// ============================================================================
// CUSTOM HOOKS FOR COMPLEX OPERATIONS
// ============================================================================

// Hook for managing loading states across multiple operations
export function useAsyncOperation() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const execute = async <T>(operation: () => Promise<T>): Promise<T | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await operation()
      return result
    } catch (err) {
      const apiError = err as ApiError
      setError(apiError)
      return null
    } finally {
      setIsLoading(false)
    }
  }

  const reset = () => {
    setError(null)
    setIsLoading(false)
  }

  return { execute, isLoading, error, reset }
}

// Hook for optimistic UI updates
export function useOptimisticUpdate<T>(key: string, initialData: T) {
  const [optimisticData, setOptimisticData] = useState<T>(initialData)
  const [isOptimistic, setIsOptimistic] = useState(false)

  const updateOptimistically = (newData: T) => {
    setOptimisticData(newData)
    setIsOptimistic(true)
  }

  const confirmUpdate = (confirmedData: T) => {
    setOptimisticData(confirmedData)
    setIsOptimistic(false)
  }

  const revertUpdate = () => {
    setOptimisticData(initialData)
    setIsOptimistic(false)
  }

  return {
    data: optimisticData,
    isOptimistic,
    updateOptimistically,
    confirmUpdate,
    revertUpdate,
  }
}
