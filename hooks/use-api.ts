import useSWR from 'swr'
import { FullStudentProfile, FullUnit, FullSessionState } from '@/lib/types'
import { Unit, VocabularyDeck } from '@prisma/client'

// Mock teacher ID for now - in production this would come from auth context
const MOCK_TEACHER_ID = 'ef430bd0-5278-4b0d-a0d3-aecf91ba5cd8';

// Base fetcher function with teacher auth header
const fetcher = async (url: string) => {
  const response = await fetch(url, {
    headers: {
      'X-Teacher-ID': MOCK_TEACHER_ID,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch data')
  }

  const data = await response.json()
  return data.data // API responses are wrapped in { data, error } format
}

// Hook to fetch all students for the current teacher
export function useStudents() {
  const { data, error, isLoading, mutate } = useSWR<FullStudentProfile[]>('/api/students', fetcher)

  return {
    students: data || [],
    isLoading,
    isError: error,
    mutate,
  }
}

// Hook to fetch a specific student profile
export function useStudent(studentId: string) {
  const { data, error, isLoading, mutate } = useSWR<FullStudentProfile>(
    studentId ? `/api/students/${studentId}` : null,
    fetcher
  )

  return {
    student: data,
    isLoading,
    isError: error,
    mutate,
  }
}

// Helper function to create a student
export async function createStudent(studentData: { name: string; email: string; notes?: string }, initialDeckId: string) {
  const response = await fetch('/api/workflows/onboard-student', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Teacher-ID': MOCK_TEACHER_ID,
    },
    body: JSON.stringify({ studentData, initialDeckId }),
  })

  if (!response.ok) {
    throw new Error('Failed to create student')
  }

  return response.json()
}

// Helper function to archive a student
export async function archiveStudent(studentId: string) {
  const response = await fetch(`/api/students/${studentId}`, {
    method: 'DELETE',
    headers: {
      'X-Teacher-ID': MOCK_TEACHER_ID,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to archive student')
  }

  return response.json()
}

// Hook to fetch all units for the current teacher
export function useUnits() {
  const { data, error, isLoading, mutate } = useSWR<Unit[]>('/api/units', fetcher)

  return {
    units: data || [],
    isLoading,
    isError: error,
    mutate,
  }
}

// Hook to fetch all vocabulary decks for the current teacher  
export function useDecks() {
  const { data, error, isLoading, mutate } = useSWR<VocabularyDeck[]>('/api/decks', fetcher)

  return {
    decks: data || [],
    isLoading,
    isError: error,
    mutate,
  }
}

// Hook to fetch a specific unit with details
export function useUnit(unitId: string) {
  const { data, error, isLoading, mutate } = useSWR<FullUnit>(
    unitId ? `/api/units/${unitId}` : null,
    fetcher
  )

  return {
    unit: data,
    isLoading,
    isError: error,
    mutate,
  }
}

// Helper function to create a unit
export async function createUnit(unitData: { name: string; description?: string; isPublic?: boolean }) {
  const response = await fetch('/api/units', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Teacher-ID': MOCK_TEACHER_ID,
    },
    body: JSON.stringify(unitData),
  })

  if (!response.ok) {
    throw new Error('Failed to create unit')
  }

  return response.json()
}

// Helper function to update a unit
export async function updateUnit(unitId: string, unitData: { name?: string; description?: string; isPublic?: boolean }) {
  const response = await fetch(`/api/units/${unitId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Teacher-ID': MOCK_TEACHER_ID,
    },
    body: JSON.stringify(unitData),
  })

  if (!response.ok) {
    throw new Error('Failed to update unit')
  }

  return response.json()
}

// Helper function to add an exercise to a unit
export async function addExerciseToUnit(unitId: string, exerciseData: { type: string; data: any }) {
  const response = await fetch(`/api/units/${unitId}/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Teacher-ID': MOCK_TEACHER_ID,
    },
    body: JSON.stringify(exerciseData),
  })

  if (!response.ok) {
    throw new Error('Failed to add exercise to unit')
  }

  return response.json()
}

// Hook to fetch a specific session state
export function useSession(sessionId: string) {
  const { data, error, isLoading, mutate } = useSWR<FullSessionState>(
    sessionId ? `/api/sessions/${sessionId}` : null,
    fetcher
  )

  return {
    session: data,
    isLoading,
    isError: error,
    mutate,
  }
}

// Helper function to start a new session
export async function startSession(studentId: string, unitId: string) {
  const response = await fetch('/api/sessions/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Teacher-ID': MOCK_TEACHER_ID,
    },
    body: JSON.stringify({ studentId, unitId }),
  })

  if (!response.ok) {
    throw new Error('Failed to start session')
  }

  return response.json()
}

// Helper function to submit an answer during a session
export async function submitAnswer(sessionId: string, payload: { action: string; data?: any }) {
  const response = await fetch(`/api/sessions/${sessionId}/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Teacher-ID': MOCK_TEACHER_ID,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error('Failed to submit answer')
  }

  return response.json()
}

// Helper function to end a session
export async function endSession(sessionId: string) {
  const response = await fetch(`/api/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: {
      'X-Teacher-ID': MOCK_TEACHER_ID,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to end session')
  }

  return response.json()
}

// Hook to fetch available units for a student session
export function useAvailableUnits(studentId: string) {
  const { data, error, isLoading, mutate } = useSWR(
    studentId ? `/api/students/${studentId}/available-units` : null,
    fetcher
  )

  return {
    units: data || [],
    isLoading,
    isError: error,
    mutate,
  }
}

export async function assignDeck(studentId: string, deckId: string) {
  const response = await fetch(`/api/students/${studentId}/decks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Teacher-ID': MOCK_TEACHER_ID,
    },
    body: JSON.stringify({ deckId }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to assign deck');
  }

  return response.json();
}

