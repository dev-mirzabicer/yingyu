"use client"

import useSWR from "swr"
import type {
  FullSessionState,
  AnswerPayload,
} from "@/lib/types"
import { fetcher, mutateWithOptimistic, ApiError } from "./utils"

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
