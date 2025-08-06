"use client"

import useSWR from "swr"
import type {
  FullUnit,
  VocabularyExerciseConfig,
  NewUnitItemData,
} from "@/lib/types"
import type {
  Unit,
  VocabularyDeck,
  VocabularyCard,
  Job,
} from "@prisma/client"
import { fetcher, mutateWithOptimistic, ApiError } from "./utils"

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

export function usePublicDecks() {
  const { data, error, isLoading, mutate } = useSWR<VocabularyDeck[]>("/api/public-decks", fetcher)

  return {
    publicDecks: data || [],
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
// BULK IMPORT HOOKS
// ============================================================================

export async function bulkImportVocabulary(deckId: string, csvData: any[]) {
  return mutateWithOptimistic<Job>("/api/bulk-import/vocabulary", "POST", {
    deckId,
    csvData,
  });
}
