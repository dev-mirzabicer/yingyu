"use client"

import useSWR from "swr"
import type {
  FullSessionState,
  AnswerPayload,
} from "@/lib/types"
import { fetcher, mutateWithOptimistic, ApiError } from "./utils"

// TypeScript interface for session list data
interface SessionListItem {
  id: string
  studentId: string
  studentName: string
  unitId: string
  unitName: string
  status: 'COMPLETED' | 'IN_PROGRESS' | 'CANCELLED'
  startedAt: string
  duration: number
  cardsReviewed: number
}

// ============================================================================
// SESSION MANAGEMENT HOOKS
// ============================================================================

export function useSessions() {
  const { data, error, isLoading, mutate } = useSWR<SessionListItem[]>("/api/sessions", fetcher)

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

export async function startSession(
  studentId: string,
  unitId: string,
  configOverrides?: Record<string, unknown>
) {
  return mutateWithOptimistic<FullSessionState>("/api/sessions/start", "POST", {
    studentId,
    unitId,
    configOverrides,
  });
}

export async function submitAnswer(sessionId: string, payload: AnswerPayload) {
  return mutateWithOptimistic<{ newState: FullSessionState; submissionResult: unknown }>(
    `/api/sessions/${sessionId}/submit`,
    "POST",
    payload,
  )
}

export async function endSession(sessionId: string) {
  return mutateWithOptimistic<FullSessionState>(`/api/sessions/${sessionId}`, "DELETE")
}
