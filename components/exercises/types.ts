import { FullSessionState } from "@/lib/types"

export type Rating = 1 | 2 | 3 | 4 // Again, Hard, Good, Easy

/**
 * The standard interface that all exercise components must implement.
 * This provides both backwards compatibility with existing exercises
 * and extensibility for new exercise types with custom actions.
 */
export interface ExerciseProps {
  /** The current session state containing all exercise data */
  sessionState: FullSessionState
  
  /** Traditional handler for revealing answers - used by vocabulary/listening exercises */
  onRevealAnswer: () => void
  
  /** Traditional handler for submitting ratings (1-4) - used by vocabulary/listening exercises */
  onSubmitRating: (rating: Rating) => void
  
  /** 
   * Generic action handler for custom exercise actions.
   * This enables exercises to send any action type to the backend while maintaining type safety.
   * 
   * Examples:
   * - onSubmitAction('SUBMIT_STUDENT_ANSWER', { answer: 'hello' })
   * - onSubmitAction('MARK_CORRECT')
   * - onSubmitAction('MARK_INCORRECT')
   */
  onSubmitAction: (action: string, data?: any) => void
  
  /** Whether any action is currently being processed */
  isLoading: boolean
}