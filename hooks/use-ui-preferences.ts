"use client"

import { useState, useEffect, useCallback } from "react"
import {
  loadUIPreferences,
  saveUIPreferences,
  formatCurrency,
  formatDate,
  formatTime,
  getCurrencySymbol,
  type UIPreferences,
} from "@/lib/ui-preferences"

/**
 * Custom hook for managing UI preferences throughout the application
 */
export function useUIPreferences() {
  const [preferences, setPreferences] = useState<UIPreferences>(loadUIPreferences())

  // Reload preferences from localStorage
  const reloadPreferences = useCallback(() => {
    const newPreferences = loadUIPreferences()
    setPreferences(newPreferences)
  }, [])

  // Update a specific preference
  const updatePreference = useCallback((key: keyof UIPreferences, value: string) => {
    const newPreferences = { ...preferences, [key]: value }
    setPreferences(newPreferences)
    saveUIPreferences(newPreferences)
  }, [preferences])

  // Update multiple preferences at once
  const updatePreferences = useCallback((updates: Partial<UIPreferences>) => {
    const newPreferences = { ...preferences, ...updates }
    setPreferences(newPreferences)
    saveUIPreferences(newPreferences)
  }, [preferences])

  // Formatted utility functions using current preferences
  const formatCurrencyWithPreference = useCallback((amount: number) => {
    return formatCurrency(amount, preferences.currency)
  }, [preferences.currency])

  const formatDateWithPreference = useCallback((date: Date) => {
    return formatDate(date, preferences.dateFormat)
  }, [preferences.dateFormat])

  const formatTimeWithPreference = useCallback((date: Date) => {
    return formatTime(date, preferences.timeFormat)
  }, [preferences.timeFormat])

  const getCurrencySymbolWithPreference = useCallback(() => {
    return getCurrencySymbol(preferences.currency)
  }, [preferences.currency])

  // Listen for storage changes from other tabs/windows
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "teacher-ui-preferences") {
        reloadPreferences()
      }
    }

    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
  }, [reloadPreferences])

  return {
    preferences,
    updatePreference,
    updatePreferences,
    reloadPreferences,
    // Convenience formatters
    formatCurrency: formatCurrencyWithPreference,
    formatDate: formatDateWithPreference,
    formatTime: formatTimeWithPreference,
    getCurrencySymbol: getCurrencySymbolWithPreference,
  }
}

/**
 * Hook specifically for currency formatting - lightweight for components that only need currency
 */
export function useCurrencyFormatter() {
  const [currency, setCurrency] = useState(loadUIPreferences().currency)

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "teacher-ui-preferences") {
        const newPreferences = loadUIPreferences()
        setCurrency(newPreferences.currency)
      }
    }

    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
  }, [])

  const formatCurrencyValue = useCallback((amount: number) => {
    return formatCurrency(amount, currency)
  }, [currency])

  const getCurrencySymbolValue = useCallback(() => {
    return getCurrencySymbol(currency)
  }, [currency])

  return {
    currency,
    formatCurrency: formatCurrencyValue,
    getCurrencySymbol: getCurrencySymbolValue,
  }
}

/**
 * Hook specifically for date/time formatting
 */
export function useDateTimeFormatter() {
  const [preferences, setPreferences] = useState(() => {
    const prefs = loadUIPreferences()
    return {
      dateFormat: prefs.dateFormat,
      timeFormat: prefs.timeFormat,
    }
  })

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "teacher-ui-preferences") {
        const newPreferences = loadUIPreferences()
        setPreferences({
          dateFormat: newPreferences.dateFormat,
          timeFormat: newPreferences.timeFormat,
        })
      }
    }

    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
  }, [])

  const formatDateValue = useCallback((date: Date) => {
    return formatDate(date, preferences.dateFormat)
  }, [preferences.dateFormat])

  const formatTimeValue = useCallback((date: Date) => {
    return formatTime(date, preferences.timeFormat)
  }, [preferences.timeFormat])

  const formatDateTimeValue = useCallback((date: Date) => {
    return `${formatDate(date, preferences.dateFormat)} ${formatTime(date, preferences.timeFormat)}`
  }, [preferences.dateFormat, preferences.timeFormat])

  return {
    dateFormat: preferences.dateFormat,
    timeFormat: preferences.timeFormat,
    formatDate: formatDateValue,
    formatTime: formatTimeValue,
    formatDateTime: formatDateTimeValue,
  }
}