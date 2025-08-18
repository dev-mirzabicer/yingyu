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
  FillInBlankQuestion,
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

// ============================================================================
// FILL-IN-BLANK QUESTION HOOKS
// ============================================================================

export function useFillInBlankQuestions(exerciseId: string, options?: {
  page?: number;
  limit?: number;
  search?: string;
  activeOnly?: boolean;
}) {
  const params = new URLSearchParams();
  if (options?.page) params.set('page', options.page.toString());
  if (options?.limit) params.set('limit', options.limit.toString());
  if (options?.search) params.set('search', options.search);
  if (options?.activeOnly !== undefined) params.set('activeOnly', options.activeOnly.toString());

  const key = exerciseId ? `/api/fill-in-blank/${exerciseId}/questions?${params}` : null;

  const { data, error, isLoading, mutate } = useSWR<{
    questions: (FillInBlankQuestion & {
      vocabularyCard: VocabularyCard | null;
    })[];
    total: number;
    page: number;
    totalPages: number;
    exerciseInfo: {
      id: string;
      title: string;
      placeholderToken: string;
      vocabularyDeck: { name: string };
    };
  }>(key, fetcher);

  return {
    questions: data?.questions || [],
    total: data?.total || 0,
    page: data?.page || 1,
    totalPages: data?.totalPages || 1,
    exerciseInfo: data?.exerciseInfo,
    isLoading,
    isError: error,
    mutate,
    error: error as ApiError | undefined,
  };
}

export function useFillInBlankQuestion(exerciseId: string, questionId: string) {
  const key = exerciseId && questionId ? `/api/fill-in-blank/${exerciseId}/questions/${questionId}` : null;

  const { data, error, isLoading, mutate } = useSWR<FillInBlankQuestion & {
    vocabularyCard: VocabularyCard | null;
    exercise: {
      id: string;
      title: string;
      placeholderToken: string;
    };
  }>(key, fetcher);

  return {
    question: data,
    isLoading,
    isError: error,
    mutate,
    error: error as ApiError | undefined,
  };
}

export async function createFillInBlankQuestion(exerciseId: string, questionData: {
  sentence: string;
  correctAnswer: string;
  vocabularyCardId?: string;
  distractors?: string[];
  difficultyLevel?: number;
  order?: number;
}) {
  const cacheKey = `/api/fill-in-blank/${exerciseId}/questions`;
  
  return mutateWithOptimistic<FillInBlankQuestion & {
    vocabularyCard: VocabularyCard | null;
  }>(
    cacheKey,
    "POST", 
    questionData,
    (currentData) => {
      if (!currentData) return currentData;
      
      // Add the new question optimistically
      const newQuestion = {
        id: `temp-${Date.now()}`,
        exerciseId,
        sentence: questionData.sentence,
        correctAnswer: questionData.correctAnswer,
        vocabularyCardId: questionData.vocabularyCardId || null,
        distractors: questionData.distractors || [],
        difficultyLevel: questionData.difficultyLevel || 1,
        order: questionData.order ?? currentData.questions.length,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        vocabularyCard: null, // Will be populated by server response
      };

      return {
        ...currentData,
        questions: [...currentData.questions, newQuestion],
        total: currentData.total + 1,
      };
    }
  );
}

export async function updateFillInBlankQuestion(
  exerciseId: string,
  questionId: string,
  updates: {
    sentence?: string;
    correctAnswer?: string;
    vocabularyCardId?: string | null;
    distractors?: string[];
    difficultyLevel?: number;
    order?: number;
    isActive?: boolean;
  }
) {
  const cacheKey = `/api/fill-in-blank/${exerciseId}/questions`;
  
  return mutateWithOptimistic<FillInBlankQuestion & {
    vocabularyCard: VocabularyCard | null;
  }>(
    `/api/fill-in-blank/${exerciseId}/questions/${questionId}`,
    "PUT", 
    updates,
    (currentData) => {
      if (!currentData) return currentData;
      
      const questionIndex = currentData.questions.findIndex(q => q.id === questionId);
      if (questionIndex === -1) return currentData;

      const updatedQuestions = [...currentData.questions];
      updatedQuestions[questionIndex] = {
        ...updatedQuestions[questionIndex],
        ...updates,
        updatedAt: new Date(),
      };

      return {
        ...currentData,
        questions: updatedQuestions,
      };
    }
  );
}

export async function deleteFillInBlankQuestion(exerciseId: string, questionId: string) {
  const cacheKey = `/api/fill-in-blank/${exerciseId}/questions`;
  
  return mutateWithOptimistic<{ success: boolean }>(
    `/api/fill-in-blank/${exerciseId}/questions/${questionId}`,
    "DELETE",
    {},
    (currentData) => {
      if (!currentData) return currentData;
      
      return {
        ...currentData,
        questions: currentData.questions.filter(q => q.id !== questionId),
        total: currentData.total - 1,
      };
    }
  );
}

export async function bulkCreateFillInBlankQuestions(exerciseId: string, questions: Array<{
  sentence: string;
  correctAnswer: string;
  vocabularyCardId?: string;
  distractors?: string[];
  difficultyLevel?: number;
}>) {
  const cacheKey = `/api/fill-in-blank/${exerciseId}/questions`;
  
  return mutateWithOptimistic<{
    createdQuestions: (FillInBlankQuestion & {
      vocabularyCard: VocabularyCard | null;
    })[];
    count: number;
  }>(
    `/api/fill-in-blank/${exerciseId}/questions/bulk`,
    "POST",
    { questions },
    (currentData) => {
      if (!currentData) return currentData;
      
      // Add new questions optimistically
      const newQuestions = questions.map((q, index) => ({
        id: `temp-bulk-${Date.now()}-${index}`,
        exerciseId,
        sentence: q.sentence,
        correctAnswer: q.correctAnswer,
        vocabularyCardId: q.vocabularyCardId || null,
        distractors: q.distractors || [],
        difficultyLevel: q.difficultyLevel || 1,
        order: currentData.questions.length + index,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        vocabularyCard: null,
      }));

      return {
        ...currentData,
        questions: [...currentData.questions, ...newQuestions],
        total: currentData.total + questions.length,
      };
    }
  );
}

export async function bulkUpdateFillInBlankQuestions(exerciseId: string, updates: Array<{
  id: string;
  sentence?: string;
  correctAnswer?: string;
  vocabularyCardId?: string | null;
  distractors?: string[];
  difficultyLevel?: number;
  isActive?: boolean;
}>) {
  const cacheKey = `/api/fill-in-blank/${exerciseId}/questions`;
  
  return mutateWithOptimistic<{
    updatedQuestions: (FillInBlankQuestion & {
      vocabularyCard: VocabularyCard | null;
    })[];
    count: number;
  }>(
    `/api/fill-in-blank/${exerciseId}/questions/bulk`,
    "PUT",
    { updates },
    (currentData) => {
      if (!currentData) return currentData;
      
      const updatedQuestions = currentData.questions.map(question => {
        const update = updates.find(u => u.id === question.id);
        if (!update) return question;
        
        return {
          ...question,
          ...update,
          updatedAt: new Date(),
        };
      });

      return {
        ...currentData,
        questions: updatedQuestions,
      };
    }
  );
}

export async function bulkDeleteFillInBlankQuestions(exerciseId: string, questionIds: string[]) {
  const cacheKey = `/api/fill-in-blank/${exerciseId}/questions`;
  
  return mutateWithOptimistic<{ success: boolean; deletedCount: number }>(
    `/api/fill-in-blank/${exerciseId}/questions/bulk`,
    "DELETE",
    { questionIds },
    (currentData) => {
      if (!currentData) return currentData;
      
      const questionIdSet = new Set(questionIds);
      return {
        ...currentData,
        questions: currentData.questions.filter(q => !questionIdSet.has(q.id)),
        total: currentData.total - questionIds.length,
      };
    }
  );
}

export async function reorderFillInBlankQuestions(exerciseId: string, questionIds: string[]) {
  const cacheKey = `/api/fill-in-blank/${exerciseId}/questions`;
  
  return mutateWithOptimistic<{ success: boolean }>(
    `/api/fill-in-blank/${exerciseId}/questions/reorder`,
    "PUT",
    { questionIds },
    (currentData) => {
      if (!currentData) return currentData;
      
      // Reorder questions optimistically
      const questionMap = new Map(currentData.questions.map(q => [q.id, q]));
      const reorderedQuestions = questionIds
        .map(id => questionMap.get(id))
        .filter((q): q is NonNullable<typeof q> => !!q)
        .map((q, index) => ({ ...q, order: index }));

      return {
        ...currentData,
        questions: reorderedQuestions,
      };
    }
  );
}
