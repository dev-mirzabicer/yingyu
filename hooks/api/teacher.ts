"use client"

import useSWR from "swr"
import type { TeacherSettings } from "@prisma/client"
import { fetcher, mutateWithOptimistic, ApiError } from "./utils"

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
