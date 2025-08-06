"use client"

/**
 * Local storage utility for UI preferences that don't need backend persistence
 */

export interface UIPreferences {
  currency: string
  dateFormat: string
  timeFormat: string
  theme: string
  language: string
}

const DEFAULT_PREFERENCES: UIPreferences = {
  currency: "CNY", // Default to Chinese Yuan for English teaching in China
  dateFormat: "YYYY-MM-DD",
  timeFormat: "24h",
  theme: "light",
  language: "en",
}

const STORAGE_KEY = "teacher-ui-preferences"

/**
 * Load UI preferences from localStorage
 */
export function loadUIPreferences(): UIPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_PREFERENCES
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return DEFAULT_PREFERENCES
    }

    const parsed = JSON.parse(stored)
    
    // Validate the stored preferences and merge with defaults
    return {
      currency: parsed.currency || DEFAULT_PREFERENCES.currency,
      dateFormat: parsed.dateFormat || DEFAULT_PREFERENCES.dateFormat,
      timeFormat: parsed.timeFormat || DEFAULT_PREFERENCES.timeFormat,
      theme: parsed.theme || DEFAULT_PREFERENCES.theme,
      language: parsed.language || DEFAULT_PREFERENCES.language,
    }
  } catch (error) {
    console.warn("Failed to load UI preferences from localStorage:", error)
    return DEFAULT_PREFERENCES
  }
}

/**
 * Save UI preferences to localStorage
 */
export function saveUIPreferences(preferences: UIPreferences): void {
  if (typeof window === "undefined") {
    return
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
  } catch (error) {
    console.warn("Failed to save UI preferences to localStorage:", error)
  }
}

/**
 * Get currency symbol from currency code
 */
export function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: "$",
    CNY: "¥",
    JPY: "¥",
    KRW: "₩",
    EUR: "€",
    GBP: "£",
  }
  return symbols[currency] || currency
}

/**
 * Format amount with currency symbol
 */
export function formatCurrency(amount: number, currency: string): string {
  const symbol = getCurrencySymbol(currency)
  
  // Format based on currency
  switch (currency) {
    case "CNY":
    case "JPY":
      return `${symbol}${amount.toFixed(0)}`
    case "KRW":
      return `${symbol}${amount.toFixed(0)}`
    default:
      return `${symbol}${amount.toFixed(2)}`
  }
}

/**
 * Format date according to user preference
 */
export function formatDate(date: Date, format: string): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  switch (format) {
    case "MM/DD/YYYY":
      return `${month}/${day}/${year}`
    case "DD/MM/YYYY":
      return `${day}/${month}/${year}`
    case "YYYY-MM-DD":
      return `${year}-${month}-${day}`
    default:
      return `${year}-${month}-${day}`
  }
}

/**
 * Format time according to user preference
 */
export function formatTime(date: Date, format: string): string {
  if (format === "12h") {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  } else {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  }
}

/**
 * Available options for UI preferences
 */
export const UI_PREFERENCE_OPTIONS = {
  currencies: [
    { value: "CNY", label: "Chinese Yuan (¥)" },
    { value: "USD", label: "US Dollar ($)" },
    { value: "EUR", label: "Euro (€)" },
    { value: "GBP", label: "British Pound (£)" },
    { value: "JPY", label: "Japanese Yen (¥)" },
    { value: "KRW", label: "Korean Won (₩)" },
  ],
  dateFormats: [
    { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
    { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
    { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
  ],
  timeFormats: [
    { value: "24h", label: "24 Hour" },
    { value: "12h", label: "12 Hour (AM/PM)" },
  ],
  themes: [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "system", label: "System" },
  ],
  languages: [
    { value: "en", label: "English" },
    { value: "zh", label: "中文" },
    { value: "ja", label: "日本語" },
    { value: "ko", label: "한국어" },
  ],
}