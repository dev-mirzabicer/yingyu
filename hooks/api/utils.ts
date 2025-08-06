"use client"

import { mutate } from "swr"

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
const MOCK_TEACHER_ID = "e1a85c07-b49e-48d9-a6a8-fec88c1d2003";

// Enhanced fetcher with better error handling
export const fetcher = async (url: string): Promise<any> => {
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
export const mutateWithOptimistic = async <T>(
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
