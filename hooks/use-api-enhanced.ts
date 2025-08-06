"use client"

import { useState } from "react"

// Re-export all hooks and functions from the new domain-specific modules
export * from "./api/students"
export * from "./api/content"
export * from "./api/sessions"
export * from "./api/teacher"

// Keep general-purpose utility types and hooks here
import type { ApiError } from "./api/utils"

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