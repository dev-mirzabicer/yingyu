"use client"

import useSWR from "swr"
import type {
  FullStudentProfile,
  AvailableUnit,
  FsrsStats,
} from "@/lib/types"
import type {
  Payment,
  ClassSchedule,
  Job,
  StudentCardState,
  VocabularyCard,
} from "@prisma/client"
import { fetcher, mutateWithOptimistic, ApiError } from "./utils"

// ============================================================================
// STUDENT MANAGEMENT HOOKS
// ============================================================================

export const useStudents = () => {
  const { data, error, isLoading, mutate } = useSWR<FullStudentProfile[]>(
    "/api/students",
    fetcher
  );

  // Add a 'upcomingClasses' field to each student for easier consumption.
  const studentsWithUpcoming = data?.map(student => ({
    ...student,
    upcomingClasses: student.classSchedules
      .filter(cs => new Date(cs.scheduledTime) > new Date())
      .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime()),
  }));

  return {
    students: studentsWithUpcoming || [],
    isLoading,
    isError: error,
    mutate,
  };
};

export const useStudent = (studentId: string) => {
  const { data, error, isLoading, mutate } = useSWR<FullStudentProfile>(
    `/api/students/${studentId}`,
    fetcher
  );

  return {
    student: data,
    isLoading,
    isError: error,
    mutate,
  };
};

export async function createStudent(
  studentData: {
    name: string
    email: string
    notes?: string
    proficiencyLevel?: string
  },
  initialDeckId: string
) {
  return mutateWithOptimistic<{
    student: FullStudentProfile
    initializationJob: Job
  }>("/api/workflows/onboard-student", "POST", {
    studentData,
    initialDeckId,
  })
}

export async function updateStudentNotes(studentId: string, notes: string) {
  return mutateWithOptimistic<FullStudentProfile>(`/api/students/${studentId}/notes`, "PUT", { notes })
}

export async function updateStudent(studentId: string, updateData: { name?: string; email?: string; phone?: string; proficiencyLevel?: string; notes?: string }) {
  return mutateWithOptimistic<FullStudentProfile>(`/api/students/${studentId}`, "PUT", updateData)
}

export async function archiveStudent(studentId: string) {
  return mutateWithOptimistic<{ message: string; student: FullStudentProfile }>(`/api/students/${studentId}`, "DELETE")
}

// ============================================================================
// PAYMENT MANAGEMENT HOOKS
// ============================================================================

export async function recordPayment(
  studentId: string,
  paymentData: { amount: number; classesPurchased: number; paymentDate: string },
) {
  return mutateWithOptimistic<Payment>(`/api/students/${studentId}/payments`, "POST", paymentData)
}

export function useStudentPayments(studentId: string) {
    const { data, error, isLoading, mutate } = useSWR<Payment[]>(
        studentId ? `/api/students/${studentId}/payments` : null,
        fetcher,
    )

    return {
        payments: data || [],
        isLoading,
        isError: error,
        mutate,
        error: error as ApiError | undefined,
    }
}

// ============================================================================
// SCHEDULING HOOKS
// ============================================================================

export function useStudentSchedules(studentId: string) {
  const { data, error, isLoading, mutate } = useSWR<ClassSchedule[]>(
    studentId ? `/api/students/${studentId}/schedules` : null,
    fetcher,
  )

  return {
    schedules: data || [],
    isLoading,
    isError: error,
    mutate,
    error: error as ApiError | undefined,
  }
}

export async function createSchedule(studentId: string, scheduleData: { scheduledTime: string; duration?: number; notes?: string }) {
  return mutateWithOptimistic<ClassSchedule>(`/api/students/${studentId}/schedules`, "POST", scheduleData)
}

export async function updateSchedule(scheduleId: string, scheduleData: { scheduledTime?: string; status?: string; duration?: number; notes?: string }) {
  return mutateWithOptimistic<ClassSchedule>(`/api/schedules/${scheduleId}`, "PUT", scheduleData)
}

export async function deleteSchedule(scheduleId: string) {
  return mutateWithOptimistic<ClassSchedule>(`/api/schedules/${scheduleId}`, "DELETE")
}

// ============================================================================
// FSRS & ANALYTICS HOOKS
// ============================================================================

export function useDueCards(studentId: string) {
  const { data, error, isLoading, mutate } = useSWR<(StudentCardState & { card: VocabularyCard })[]>(
    studentId ? `/api/students/${studentId}/fsrs/due-cards` : null,
    fetcher,
  )

  return {
    dueCards: data || [],
    isLoading,
    isError: error,
    mutate,
    error: error as ApiError | undefined,
  }
}

export function useListeningCandidates(studentId: string) {
  const { data, error, isLoading, mutate } = useSWR<VocabularyCard[]>(
    studentId ? `/api/students/${studentId}/fsrs/listening-candidates` : null,
    fetcher,
  )

  return {
    candidates: data || [],
    isLoading,
    isError: error,
    mutate,
    error: error as ApiError | undefined,
  }
}

export function useFsrsStats(studentId: string) {
  const { data, error, isLoading, mutate } = useSWR<FsrsStats>(
    studentId ? `/api/students/${studentId}/fsrs/stats` : null,
    fetcher
  );

  return {
    stats: data,
    isLoading,
    isError: error,
    mutate,
    error: error as ApiError | undefined,
  };
}

export function useGenericFsrsStats(studentId: string) {
  const { data, error, isLoading, mutate } = useSWR<FsrsStats>(
    studentId ? `/api/students/${studentId}/fsrs/generic-stats` : null,
    fetcher
  );

  return {
    stats: data,
    isLoading,
    isError: error,
    mutate,
    error: error as ApiError | undefined,
  };
}

export function useAvailableUnits(studentId: string, options?: { skip?: boolean }) {
  const { data, error, isLoading, mutate } = useSWR<AvailableUnit[]>(
    studentId && !options?.skip ? `/api/students/${studentId}/available-units` : null,
    fetcher,
  )

  return {
    units: data || [],
    isLoading,
    isError: error,
    mutate,
    error: error as ApiError | undefined,
  }
}

export async function optimizeFsrsParameters(studentId: string) {
  return mutateWithOptimistic<Job>(`/api/students/${studentId}/fsrs/optimize-parameters`, "POST")
}

export async function optimizeGenericFsrsParameters(studentId: string) {
  return mutateWithOptimistic<Job>(`/api/students/${studentId}/fsrs/optimize-generic-parameters`, "POST")
}

export async function rebuildFsrsCache(studentId: string) {
  return mutateWithOptimistic<Job>(`/api/students/${studentId}/fsrs/rebuild-cache`, "POST")
}

// ============================================================================
// DECK ASSIGNMENT HOOKS
// ============================================================================

export async function assignDeck(studentId: string, deckId: string) {
  return mutateWithOptimistic<{ studentDeck: any; job: Job }>(`/api/students/${studentId}/decks`, "POST", { deckId })
}

export async function assignGenericDeck(studentId: string, deckId: string) {
  return mutateWithOptimistic<{ studentGenericDeck: any; job: Job }>(`/api/students/${studentId}/generic-decks`, "POST", { deckId })
}

export async function bulkImportStudents(students: any[]) {
  return mutateWithOptimistic<Job>("/api/bulk-import/students", "POST", {
    students,
  });
}

export async function bulkImportSchedules(schedules: any[]) {
  return mutateWithOptimistic<Job>("/api/bulk-import/schedules", "POST", {
    schedules,
  });
}
