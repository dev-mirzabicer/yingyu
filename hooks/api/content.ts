"use client"

import useSWR from "swr"
import type {
  FullUnit,
  UnitWithCount,
  VocabularyDeckWithCount,
  FillInTheBlankDeckWithCount,
  GenericDeckWithCount,
  VocabularyExerciseConfig,
  ListeningExerciseConfig,
  FillInTheBlankExerciseConfig,
  NewUnitItemData,
} from "@/lib/types"
import type {
  Unit,
  VocabularyDeck,
  VocabularyCard,
  FillInTheBlankDeck,
  FillInTheBlankCard,
  GenericDeck,
  GenericCard,
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

export async function updateUnitItemConfig(
  unitItemId: string, 
  config: VocabularyExerciseConfig | ListeningExerciseConfig | FillInTheBlankExerciseConfig
) {
  return mutateWithOptimistic<any>(`/api/items/${unitItemId}/config`, "PUT", config)
}

export async function bulkImportVocabulary(deckId: string, cards: any[]) {
  return mutateWithOptimistic<Job>("/api/bulk-import/vocabulary", "POST", {
    deckId,
    cards,
  });
}

// ============================================================================
// FILL IN THE BLANK DECK MANAGEMENT HOOKS
// ============================================================================

export function useFillInTheBlankDecks() {
  const { data, error, isLoading, mutate } = useSWR<FillInTheBlankDeckWithCount[]>("/api/fill-in-the-blank-decks", fetcher)
  return { decks: data || [], isLoading, isError: error, mutate, error: error as ApiError | undefined }
}

export function usePublicFillInTheBlankDecks() {
  const { data, error, isLoading, mutate } = useSWR<FillInTheBlankDeckWithCount[]>("/api/public-fill-in-the-blank-decks", fetcher)
  return { publicDecks: data || [], isLoading, isError: error, mutate, error: error as ApiError | undefined }
}

export function useFillInTheBlankDeck(deckId: string) {
  const { data, error, isLoading, mutate } = useSWR<FillInTheBlankDeck & { 
    cards: FillInTheBlankCard[]; 
    boundVocabularyDeck: { id: string; name: string } | null;
    _count: { cards: number };
  }>(
    deckId ? `/api/fill-in-the-blank-decks/${deckId}` : null,
    fetcher
  )
  return { deck: data, isLoading, isError: error, mutate, error: error as ApiError | undefined }
}

export function useFillInTheBlankDeckCards(deckId: string) {
  const { data, error, isLoading, mutate } = useSWR<{ cards: (FillInTheBlankCard & {
    boundVocabularyCard: { id: string; englishWord: string } | null;
  })[] }>(
    deckId ? `/api/fill-in-the-blank-decks/${deckId}/cards` : null,
    fetcher
  )
  return { cards: data?.cards || [], isLoading, isError: error, mutate, error: error as ApiError | undefined }
}

// --- Action Functions ---

export async function createFillInTheBlankDeck(deckData: { 
  name: string; 
  description?: string; 
  isPublic?: boolean; 
  boundVocabularyDeckId?: string 
}) {
  return mutateWithOptimistic<FillInTheBlankDeckWithCount>("/api/fill-in-the-blank-decks", "POST", deckData)
}

export async function updateFillInTheBlankDeck(deckId: string, deckData: Partial<{ 
  name: string; 
  description?: string; 
  isPublic?: boolean; 
  boundVocabularyDeckId?: string 
}>) {
  return mutateWithOptimistic<FillInTheBlankDeck>(`/api/fill-in-the-blank-decks/${deckId}`, "PUT", deckData)
}

export async function addCardToFillInTheBlankDeck(deckId: string, cardData: {
  question: string;
  answer: string;
  options?: string[];
  explanation?: string;
}) {
  return mutateWithOptimistic<{ card: FillInTheBlankCard }>(`/api/fill-in-the-blank-decks/${deckId}/cards`, "POST", cardData)
}

export async function updateFillInTheBlankCard(deckId: string, cardId: string, cardData: Partial<{
  question: string;
  answer: string;
  options?: string[];
  explanation?: string;
}>) {
  return mutateWithOptimistic<{ card: FillInTheBlankCard }>(`/api/fill-in-the-blank-decks/${deckId}/cards/${cardId}`, "PUT", cardData)
}

export async function deleteFillInTheBlankCard(deckId: string, cardId: string) {
  return mutateWithOptimistic(`/api/fill-in-the-blank-decks/${deckId}/cards/${cardId}`, "DELETE")
}

export async function autoBindFillInTheBlankDeck(deckId: string) {
  // This is a one-off action, not a typical SWR mutation
  const response = await fetch(`/api/fill-in-the-blank-decks/${deckId}/bind`, { method: 'POST' });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result.data;
}

export async function resolveFillInTheBlankBinding(deckId: string, resolutions: { 
  fillInTheBlankCardId: string; 
  vocabularyCardId: string | null 
}[]) {
  return mutateWithOptimistic(`/api/fill-in-the-blank-decks/${deckId}/bind`, "PUT", { resolutions });
}

export async function bulkImportFillInTheBlankCards(deckId: string, cards: any[]) {
  return mutateWithOptimistic<Job>("/api/bulk-import/fill-in-the-blank", "POST", { deckId, cards });
}

// ============================================================================
// GENERIC DECK MANAGEMENT HOOKS
// ============================================================================

export function useGenericDecks() {
  const { data, error, isLoading, mutate } = useSWR<GenericDeckWithCount[]>("/api/generic-decks", fetcher);
  return { decks: data || [], isLoading, isError: error, mutate, error: error as ApiError | undefined };
}

export function usePublicGenericDecks() {
  const { data, error, isLoading, mutate } = useSWR<GenericDeckWithCount[]>("/api/public-generic-decks", fetcher);
  return { publicDecks: data || [], isLoading, isError: error, mutate, error: error as ApiError | undefined };
}

export function useGenericDeck(deckId: string) {
  const { data, error, isLoading, mutate } = useSWR<GenericDeck & { 
    cards: GenericCard[]; 
    boundVocabularyDeck: { id: string; name: string } | null;
    _count: { cards: number };
  }>(
    deckId ? `/api/generic-decks/${deckId}` : null,
    fetcher
  );
  return { deck: data, isLoading, isError: error, mutate, error: error as ApiError | undefined };
}

export function useGenericDeckCards(deckId: string) {
  const { data, error, isLoading, mutate } = useSWR<{ cards: (GenericCard & {
    boundVocabularyCard: { id: string; englishWord: string } | null;
  })[] }>(
    deckId ? `/api/generic-decks/${deckId}/cards` : null,
    fetcher
  );
  return { cards: data?.cards || [], isLoading, isError: error, mutate, error: error as ApiError | undefined };
}

// --- Action Functions ---

export async function createGenericDeck(deckData: { 
  name: string; 
  description?: string; 
  isPublic?: boolean; 
  boundVocabularyDeckId?: string 
}) {
  return mutateWithOptimistic<GenericDeckWithCount>("/api/generic-decks", "POST", deckData);
}

export async function updateGenericDeck(deckId: string, deckData: Partial<{ 
  name: string; 
  description?: string; 
  isPublic?: boolean; 
  boundVocabularyDeckId?: string 
}>) {
  return mutateWithOptimistic<GenericDeck>(`/api/generic-decks/${deckId}`, "PUT", deckData);
}

export async function addCardToGenericDeck(deckId: string, cardData: {
  front: string;
  back: string;
  exampleSentences?: any;
}) {
  return mutateWithOptimistic<{ card: GenericCard }>(`/api/generic-decks/${deckId}/cards`, "POST", cardData);
}

export async function updateGenericCard(deckId: string, cardId: string, cardData: Partial<{
  front: string;
  back: string;
  exampleSentences?: any;
}>) {
  return mutateWithOptimistic<{ card: GenericCard }>(`/api/generic-decks/${deckId}/cards/${cardId}`, "PUT", cardData);
}

export async function deleteGenericCard(deckId: string, cardId: string) {
  return mutateWithOptimistic(`/api/generic-decks/${deckId}/cards/${cardId}`, "DELETE");
}

export async function forkGenericDeck(deckId: string) {
  return mutateWithOptimistic<GenericDeck>("/api/generic-decks/fork", "POST", { deckId });
}

export async function autoBindGenericDeck(deckId: string) {
  // This is a one-off action, not a typical SWR mutation
  const response = await fetch(`/api/generic-decks/${deckId}/bind`, { method: 'POST' });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result.data;
}

export async function resolveGenericBinding(deckId: string, resolutions: { 
  genericCardId: string; 
  vocabularyCardId: string | null 
}[]) {
  return mutateWithOptimistic(`/api/generic-decks/${deckId}/bind`, "PUT", { resolutions });
}

export async function bulkImportGenericCards(deckId: string, cards: any[]) {
  return mutateWithOptimistic<Job>("/api/bulk-import/generic-deck", "POST", { deckId, cards });
}
