"use client"

import { useRef, useCallback } from "react"

/**
 * Hook for managing focus in components with multiple stages or states
 */
export function useFocusManagement() {
  const focusTargetRef = useRef<HTMLElement | null>(null)

  const setFocusTarget = useCallback((element: HTMLElement | null) => {
    focusTargetRef.current = element
  }, [])

  const focusTarget = useCallback(() => {
    if (focusTargetRef.current) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        focusTargetRef.current?.focus()
      }, 100)
    }
  }, [])

  const focusElement = useCallback((selector: string) => {
    const element = document.querySelector(selector) as HTMLElement
    if (element) {
      setTimeout(() => {
        element.focus()
      }, 100)
    }
  }, [])

  return {
    setFocusTarget,
    focusTarget,
    focusElement,
  }
}