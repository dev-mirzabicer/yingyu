"use client"

import useSWR from "swr"
import type {
  FullUnit,
  UnitWithCount,
  VocabularyDeckWithCount,
  VocabularyExerciseConfig,
  NewUnitItemData,
} from "@/lib/types"
import type {
  Unit,
  VocabularyDeck,
  VocabularyCard,
  FillInBlankExercise,
  Job,
} from "@prisma/client"
import { fetcher, mutateWithOptimistic, ApiError } from "./utils"

// ============================================================================
// CONTENT MANAGEMENT HOOKS
// ============================================================================

export function useUnits() {
  const { data, error, isLoading, mutate } = useSWR<UnitWithCount[]>("/api/units", fetcher)

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
  const { data, error, isLoading, mutate } = useSWR<VocabularyDeckWithCount[]>("/api/decks", fetcher)

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

export async function updateCard(cardId: string, deckId: string, cardData: Partial<{
  englishWord: string
  chineseTranslation: string
  pinyin: string
  ipaPronunciation: string
  exampleSentences: any
  wordType: string
  difficultyLevel: number
  audioUrl: string
  imageUrl: string
  videoUrl: string
  tags: string[]
}>) {
  return mutateWithOptimistic<VocabularyCard>(`/api/decks/${deckId}/cards/${cardId}`, "PUT", cardData)
}

export async function deleteCard(cardId: string, deckId: string) {
  return mutateWithOptimistic<VocabularyCard>(`/api/decks/${deckId}/cards/${cardId}`, "DELETE")
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

export async function reorderUnitItems(unitId: string, itemIds: string[]) {
  return mutateWithOptimistic<any>(`/api/units/${unitId}/items/reorder`, "PUT", { itemIds });
}

export async function updateUnitItemConfig(unitItemId: string, config: VocabularyExerciseConfig) {
  return mutateWithOptimistic<any>(`/api/items/${unitItemId}/config`, "PUT", config)
}

export async function bulkImportVocabulary(deckId: string, cards: any[]) {
  return mutateWithOptimistic<Job>("/api/bulk-import/vocabulary", "POST", {
    deckId,
    cards,
  });
}

// ============================================================================
// FILL-IN-BLANK EXERCISE HOOKS
// ============================================================================

export function useFillInBlankExercises() {
  const { data, error, isLoading, mutate } = useSWR<{
    exercises: (FillInBlankExercise & {
      vocabularyDeck: { name: string; _count: { cards: number } };
      unitItem: { id: string } | null;
    })[];
    total: number;
    page: number;
    totalPages: number;
  }>("/api/fill-in-blank", fetcher)

  return {
    exercises: data?.exercises || [],
    total: data?.total || 0,
    page: data?.page || 1,
    totalPages: data?.totalPages || 1,
    isLoading,
    isError: error,
    mutate,
    error: error as ApiError | undefined,
  }
}

export function useFillInBlankExercise(exerciseId: string) {
  const { data, error, isLoading, mutate } = useSWR<FillInBlankExercise & {
    vocabularyDeck: VocabularyDeck & { _count: { cards: number } };
    unitItem: { id: string } | null;
  }>(exerciseId ? `/api/fill-in-blank/${exerciseId}` : null, fetcher)

  return {
    exercise: data,
    isLoading,
    isError: error,
    mutate,
    error: error as ApiError | undefined,
  }
}

export async function createFillInBlankExercise(exerciseData: {
  title: string;
  vocabularyDeckId: string;
  difficultyLevel?: number;
  explanation?: string;
  tags?: string[];
  isPublic?: boolean;
}) {
  return mutateWithOptimistic<FillInBlankExercise>("/api/fill-in-blank", "POST", exerciseData)
}

export async function updateFillInBlankExercise(
  exerciseId: string,
  updates: {
    title?: string;
    vocabularyDeckId?: string;
    difficultyLevel?: number;
    explanation?: string;
    tags?: string[];
    isPublic?: boolean;
  }
) {
  return mutateWithOptimistic<FillInBlankExercise>(`/api/fill-in-blank/${exerciseId}`, "PUT", updates)
}

export async function deleteFillInBlankExercise(exerciseId: string) {
  return mutateWithOptimistic<{ success: boolean }>(`/api/fill-in-blank/${exerciseId}`, "DELETE")
}

export async function searchVocabularyCardsForBinding(options: {
  deckId: string;
  query: string;
  limit?: number;
}) {
  const params = new URLSearchParams({
    deckId: options.deckId,
    query: options.query,
    ...(options.limit && { limit: options.limit.toString() }),
  });
  
  return fetcher(`/api/fill-in-blank/search-vocab?${params}`)
}
