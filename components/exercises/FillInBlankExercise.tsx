"use client"

import React, { useState, useEffect, useCallback, useRef, memo } from "react"
import {
  FullSessionState,
  FillInBlankExerciseProgress,
} from "@/lib/types"
import {
  Edit3,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Input } from "../ui/input"
import { Alert, AlertDescription } from "../ui/alert"
import { ExerciseProps } from "./types"
import { useAnnouncement } from "@/hooks/use-announcement"
import { useFocusManagement } from "@/hooks/use-focus-management"
import { useResponsiveDesign } from "@/hooks/use-responsive-design"
import { ExerciseErrorBoundary } from "./ExerciseErrorBoundary"
import styles from "./FillInBlankExercise.module.css"

const FillInBlankExerciseComponent = function FillInBlankExercise({
  sessionState,
  onSubmitAction,
  isLoading,
}: ExerciseProps) {
  const [studentAnswer, setStudentAnswer] = useState("")
  const progress = sessionState.progress as FillInBlankExerciseProgress
  const currentCard = progress.payload.currentCardData
  
  // Accessibility and responsive hooks
  const { announce, LiveRegion } = useAnnouncement()
  const { setFocusTarget, focusTarget, focusElement } = useFocusManagement()
  const { isMobile, screenSize, preferesReducedMotion, getTouchTargetSize, getTextSize, getSpacing } = useResponsiveDesign()
  
  // Refs for focus management
  const inputRef = useRef<HTMLInputElement>(null)
  const revealButtonRef = useRef<HTMLButtonElement>(null)
  const correctButtonRef = useRef<HTMLButtonElement>(null)
  const incorrectButtonRef = useRef<HTMLButtonElement>(null)
  
  // Previous stage ref to track transitions
  const prevStageRef = useRef(progress.stage)
  
  // Animation and error state
  const [animationKey, setAnimationKey] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  // Stage transition effects and announcements
  useEffect(() => {
    if (prevStageRef.current !== progress.stage) {
      prevStageRef.current = progress.stage
      
      // Trigger animation if motion is not reduced
      if (!preferesReducedMotion) {
        setAnimationKey(prev => prev + 1)
      }
      
      // Announce stage changes to screen readers
      switch (progress.stage) {
        case 'SHOWING_QUESTION':
          announce('Question stage: Type the English word for the Chinese translation')
          // Focus the input field
          setTimeout(() => inputRef.current?.focus(), 100)
          break
        case 'SHOWING_ANSWER':
          announce('Answer submitted. Review the student\'s answer and click reveal to see the correct answer')
          setTimeout(() => revealButtonRef.current?.focus(), 100)
          break
        case 'AWAITING_TEACHER_JUDGMENT':
          announce('Answer revealed. Mark the answer as correct or incorrect')
          setTimeout(() => correctButtonRef.current?.focus(), 100)
          break
      }
    }
  }, [progress.stage, announce, preferesReducedMotion])
  
  // Handle empty card state
  if (!currentCard) {
    return (
      <section role="main" aria-label="Fill-in-blank exercise">
        <LiveRegion />
        <Card className="text-center">
          <CardContent className="p-8">
            <p className="text-slate-600" role="status">
              No more fill-in-blank exercises to review!
            </p>
          </CardContent>
        </Card>
      </section>
    )
  }

  // Action handlers with accessibility enhancements and error handling
  const handleSubmitAnswer = useCallback(() => {
    const trimmedAnswer = studentAnswer.trim()
    if (trimmedAnswer) {
      try {
        setIsSubmitting(true)
        setError(null)
        announce(`Answer submitted: ${trimmedAnswer}`, 'assertive')
        onSubmitAction('SUBMIT_STUDENT_ANSWER', { answer: trimmedAnswer })
        // Reset submitting state after a delay
        setTimeout(() => setIsSubmitting(false), 1000)
      } catch (err) {
        setError('Failed to submit answer. Please try again.')
        setIsSubmitting(false)
        announce('Error submitting answer. Please try again.', 'assertive')
      }
    } else {
      announce('Please enter an answer before submitting', 'assertive')
      inputRef.current?.focus()
    }
  }, [studentAnswer, onSubmitAction, announce])

  const handleRevealAnswer = useCallback(() => {
    try {
      setError(null)
      announce('Revealing correct answer', 'assertive')
      onSubmitAction('REVEAL_ANSWER')
    } catch (err) {
      setError('Failed to reveal answer. Please try again.')
      announce('Error revealing answer. Please try again.', 'assertive')
    }
  }, [onSubmitAction, announce])

  const handleMarkCorrect = useCallback(() => {
    try {
      setError(null)
      announce('Marked as correct. Moving to next card', 'assertive')
      onSubmitAction('MARK_CORRECT')
    } catch (err) {
      setError('Failed to mark as correct. Please try again.')
      announce('Error marking answer. Please try again.', 'assertive')
    }
  }, [onSubmitAction, announce])

  const handleMarkIncorrect = useCallback(() => {
    try {
      setError(null)
      announce('Marked as incorrect. Card added to end of queue', 'assertive')
      onSubmitAction('MARK_INCORRECT')
    } catch (err) {
      setError('Failed to mark as incorrect. Please try again.')
      announce('Error marking answer. Please try again.', 'assertive')
    }
  }, [onSubmitAction, announce])

  // Enhanced keyboard navigation
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading && progress.stage === 'SHOWING_QUESTION') {
      e.preventDefault()
      handleSubmitAnswer()
    }
  }, [handleSubmitAnswer, isLoading, progress.stage])
  
  // Global keyboard shortcuts for teacher actions
  useEffect(() => {
    const handleGlobalKeyPress = (e: KeyboardEvent) => {
      if (isLoading) return
      
      // Only handle shortcuts when not focused on input elements
      if (e.target instanceof HTMLInputElement) return
      
      switch (e.key.toLowerCase()) {
        case 'c':
          if (progress.stage === 'AWAITING_TEACHER_JUDGMENT' && e.ctrlKey) {
            e.preventDefault()
            handleMarkCorrect()
          }
          break
        case 'i':
          if (progress.stage === 'AWAITING_TEACHER_JUDGMENT' && e.ctrlKey) {
            e.preventDefault()
            handleMarkIncorrect()
          }
          break
        case 'r':
          if (progress.stage === 'SHOWING_ANSWER' && e.ctrlKey) {
            e.preventDefault()
            handleRevealAnswer()
          }
          break
        case 'escape':
          // Return focus to main input or button
          if (progress.stage === 'SHOWING_QUESTION') {
            inputRef.current?.focus()
          } else if (progress.stage === 'SHOWING_ANSWER') {
            revealButtonRef.current?.focus()
          } else if (progress.stage === 'AWAITING_TEACHER_JUDGMENT') {
            correctButtonRef.current?.focus()
          }
          break
      }
    }
    
    document.addEventListener('keydown', handleGlobalKeyPress)
    return () => document.removeEventListener('keydown', handleGlobalKeyPress)
  }, [progress.stage, isLoading, handleMarkCorrect, handleMarkIncorrect, handleRevealAnswer])

  // Render based on current stage with accessibility enhancements
  const renderQuestionStage = () => (
    <section 
      key={`question-${animationKey}`}
      role="main" 
      aria-label="Fill-in-blank exercise - Question stage"
      className={`${preferesReducedMotion ? '' : styles.stageTransition} transition-opacity duration-300 ease-in-out`}
    >
      <LiveRegion />
      {/* Current Card - Question Stage */}
      <Card className={`text-center focus-within:ring-2 focus-within:ring-orange-500 focus-within:ring-offset-2 ${styles.focusRing} ${getSpacing('p-4 md:p-6')}`}>
        <CardHeader>
          <div className="flex items-center justify-center space-x-2 mb-2">
            <Edit3 className="h-5 w-5 text-orange-600" aria-hidden="true" />
            <Badge 
              variant="outline" 
              className="border-orange-200 text-orange-700 bg-orange-50"
              role="status"
              aria-label="Exercise type: Fill-in-Blank"
            >
              Fill-in-Blank
            </Badge>
          </div>
          <CardTitle 
            className="text-2xl md:text-3xl font-medium text-slate-700 mb-4"
            id="question-heading"
          >
            Type the English word for:
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Error alert */}
          {error && (
            <Alert className="border-red-200 bg-red-50" role="alert">
              <AlertCircle className="h-4 w-4 text-red-600" aria-hidden="true" />
              <AlertDescription className="text-red-700">
                {error}
              </AlertDescription>
            </Alert>
          )}
          
          <div 
            className="p-4 md:p-6 bg-orange-50 rounded-lg border border-orange-200"
            role="region"
            aria-labelledby="chinese-translation"
          >
            <p 
              className={getTextSize("text-3xl md:text-4xl font-bold text-orange-900 mb-2")}
              id="chinese-translation"
              lang="zh-CN"
            >
              {currentCard.chineseTranslation}
            </p>
            {currentCard.pinyin && (
              <p 
                className="text-base md:text-lg text-orange-600 italic"
                lang="zh-Latn"
                aria-label={`Pinyin pronunciation: ${currentCard.pinyin}`}
              >
                {currentCard.pinyin}
              </p>
            )}
          </div>
          
          <form 
            onSubmit={(e) => {
              e.preventDefault()
              handleSubmitAnswer()
            }}
            className="space-y-4"
            role="form"
            aria-labelledby="question-heading"
          >
            <div className="max-w-md mx-auto">
              <label htmlFor="student-answer" className="sr-only">
                Your English answer for {currentCard.chineseTranslation}
              </label>
              <Input
                id="student-answer"
                ref={inputRef}
                value={studentAnswer}
                onChange={(e) => setStudentAnswer(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type the English word here..."
                className={`text-center ${getTextSize('text-lg')} ${getTouchTargetSize()} border-orange-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-500 ${styles.focusRing}`}
                disabled={isLoading}
                autoFocus
                autoComplete="off"
                spellCheck="false"
                aria-describedby="submit-help"
                aria-required="true"
              />
              <div id="submit-help" className="sr-only">
                Press Enter or click Submit to submit your answer
              </div>
            </div>
            
            <Button
              type="submit"
              onClick={handleSubmitAnswer}
              disabled={isLoading || !studentAnswer.trim()}
              className={`w-full max-w-md mx-auto ${getTouchTargetSize()} ${getTextSize('text-lg')} bg-orange-600 hover:bg-orange-700 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-all duration-200 ${styles.focusRing} ${isSubmitting ? styles.loadingPulse : ''} active:${styles.buttonPress}`}
              aria-describedby={!studentAnswer.trim() ? "submit-disabled-help" : undefined}
            >
              {isLoading ? (
                <>
                  <span className="mr-2">Submitting...</span>
                  <span className="sr-only">Please wait</span>
                </>
              ) : (
                "Submit Answer"
              )}
            </Button>
            {!studentAnswer.trim() && (
              <div id="submit-disabled-help" className="sr-only">
                Button is disabled because no answer has been entered
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </section>
  )

  const renderAnswerStage = () => (
    <section 
      key={`answer-${animationKey}`}
      role="main" 
      aria-label="Fill-in-blank exercise - Answer review stage"
      className={`${preferesReducedMotion ? '' : styles.stageTransition} transition-opacity duration-300 ease-in-out`}
    >
      <LiveRegion />
      {/* Current Card - Answer Stage */}
      <Card className={`text-center focus-within:ring-2 focus-within:ring-orange-500 focus-within:ring-offset-2 ${styles.focusRing} ${getSpacing('p-4 md:p-6')}`}>
        <CardHeader>
          <div className="flex items-center justify-center space-x-2 mb-2">
            <Edit3 className="h-5 w-5 text-orange-600" aria-hidden="true" />
            <Badge 
              variant="outline" 
              className="border-orange-200 text-orange-700 bg-orange-50"
              role="status"
              aria-label="Exercise type: Fill-in-Blank"
            >
              Fill-in-Blank
            </Badge>
          </div>
          <CardTitle 
            className="text-2xl md:text-3xl font-medium text-slate-700 mb-4"
            id="answer-heading"
          >
            Student's Answer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Chinese prompt */}
          <div 
            className="p-4 bg-slate-50 rounded-lg border"
            role="region"
            aria-labelledby="original-question"
          >
            <p 
              className="text-lg md:text-xl font-medium text-slate-900 mb-1"
              id="original-question"
              lang="zh-CN"
            >
              {currentCard.chineseTranslation}
            </p>
            {currentCard.pinyin && (
              <p 
                className="text-sm text-slate-600 italic"
                lang="zh-Latn"
                aria-label={`Pinyin: ${currentCard.pinyin}`}
              >
                {currentCard.pinyin}
              </p>
            )}
          </div>

          {/* Student's Answer */}
          <div 
            className="p-4 bg-blue-50 rounded-lg border border-blue-200"
            role="region"
            aria-labelledby="student-response"
          >
            <p 
              className="text-sm text-blue-600 font-medium mb-1"
              id="student-response"
            >
              Student typed:
            </p>
            <p 
              className="text-xl md:text-2xl font-bold text-blue-800"
              aria-label={`Student's answer: ${progress.payload.studentAnswer || "No answer provided"}`}
              lang="en"
            >
              {progress.payload.studentAnswer || "No answer"}
            </p>
          </div>

          <Button
            ref={revealButtonRef}
            onClick={handleRevealAnswer}
            disabled={isLoading}
            className={`w-full max-w-md mx-auto ${getTouchTargetSize()} ${getTextSize('text-lg')} bg-orange-600 hover:bg-orange-700 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-all duration-200 ${styles.focusRing} active:${styles.buttonPress}`}
            aria-describedby="reveal-help"
          >
            {isLoading ? (
              <>
                <span className="mr-2">Loading...</span>
                <span className="sr-only">Please wait</span>
              </>
            ) : (
              "Reveal Correct Answer"
            )}
          </Button>
          <div id="reveal-help" className="sr-only">
            Click to reveal the correct answer and compare with student's response. Keyboard shortcut: Ctrl+R
          </div>
        </CardContent>
      </Card>
    </section>
  )

  const renderJudgmentStage = () => {
    const studentAnswer = progress.payload.studentAnswer || ""
    const correctAnswer = currentCard.englishWord
    const isExactMatch = studentAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim()

    return (
      <section 
        key={`judgment-${animationKey}`}
        role="main" 
        aria-label="Fill-in-blank exercise - Teacher judgment stage"
        className={`${preferesReducedMotion ? '' : styles.stageTransition} transition-opacity duration-300 ease-in-out`}
      >
        <LiveRegion />
        {/* Current Card - Judgment Stage */}
        <Card className={`text-center focus-within:ring-2 focus-within:ring-orange-500 focus-within:ring-offset-2 ${styles.focusRing} ${getSpacing('p-4 md:p-6')}`}>
          <CardHeader>
            <div className="flex items-center justify-center space-x-2 mb-2">
              <Edit3 className="h-5 w-5 text-orange-600" aria-hidden="true" />
              <Badge 
                variant="outline" 
                className="border-orange-200 text-orange-700 bg-orange-50"
                role="status"
                aria-label="Exercise type: Fill-in-Blank"
              >
                Fill-in-Blank
              </Badge>
            </div>
            <CardTitle 
                className="text-2xl md:text-3xl font-medium text-slate-700 mb-4"
              id="judgment-heading"
            >
              Mark as Correct or Incorrect
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Chinese prompt */}
            <div 
              className="p-4 bg-slate-50 rounded-lg border"
              role="region"
              aria-labelledby="original-question-judgment"
            >
              <p 
                className="text-lg md:text-xl font-medium text-slate-900 mb-1"
                id="original-question-judgment"
                lang="zh-CN"
              >
                {currentCard.chineseTranslation}
              </p>
              {currentCard.pinyin && (
                <p 
                  className="text-sm text-slate-600 italic"
                  lang="zh-Latn"
                  aria-label={`Pinyin: ${currentCard.pinyin}`}
                >
                  {currentCard.pinyin}
                </p>
              )}
            </div>

            {/* Answer comparison */}
            <div 
              className={`${isMobile ? styles.mobileStack : 'grid gap-4 sm:grid-cols-1 md:grid-cols-2'}`}
              role="region"
              aria-labelledby="answer-comparison"
            >
              <h2 id="answer-comparison" className="sr-only">Answer comparison</h2>
              
              {/* Student's Answer */}
              <div 
                className={`p-4 rounded-lg border-2 transition-colors duration-200 ${
                  isExactMatch 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}
                role="region"
                aria-labelledby="student-answer-comparison"
              >
                <p 
                  className={`text-sm font-medium mb-1 ${
                    isExactMatch ? 'text-green-600' : 'text-red-600'
                  }`}
                  id="student-answer-comparison"
                >
                  Student's Answer:
                </p>
                <p 
                  className={`text-lg md:text-xl font-bold ${
                    isExactMatch ? 'text-green-800' : 'text-red-800'
                  }`}
                  lang="en"
                  aria-label={`Student answered: ${studentAnswer || "No answer provided"}`}
                >
                  {studentAnswer || "No answer"}
                </p>
              </div>

              {/* Correct Answer */}
              <div 
                className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200"
                role="region"
                aria-labelledby="correct-answer-comparison"
              >
                <p 
                  className="text-sm text-blue-600 font-medium mb-1"
                  id="correct-answer-comparison"
                >
                  Correct Answer:
                </p>
                <p 
                  className="text-lg md:text-xl font-bold text-blue-800"
                  lang="en"
                  aria-label={`Correct answer is: ${correctAnswer}`}
                >
                  {correctAnswer}
                </p>
              </div>
            </div>

            {/* Auto-suggestion based on exact match */}
            {isExactMatch && (
              <Alert 
                className="border-green-200 bg-green-50"
                role="status"
                aria-live="polite"
              >
                <CheckCircle className="h-4 w-4 text-green-600" aria-hidden="true" />
                <AlertDescription className="text-green-700">
                  Exact match detected! Consider marking as correct.
                </AlertDescription>
              </Alert>
            )}

            {!isExactMatch && studentAnswer && (
              <Alert 
                className="border-amber-200 bg-amber-50"
                role="status"
                aria-live="polite"
              >
                <AlertCircle className="h-4 w-4 text-amber-600" aria-hidden="true" />
                <AlertDescription className="text-amber-700">
                  Answers don't match exactly. Please review for possible variations or typos.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Teacher Judgment Buttons */}
        <div 
          className={`${isMobile ? styles.mobileStack : 'grid grid-cols-1 sm:grid-cols-2 gap-4'}`}
          role="group"
          aria-labelledby="judgment-actions"
        >
          <h2 id="judgment-actions" className="sr-only">Teacher judgment actions</h2>
          
          <Button
            ref={incorrectButtonRef}
            onClick={handleMarkIncorrect}
            disabled={isLoading}
            variant="outline"
            className={`${getTouchTargetSize()} ${isMobile ? 'h-16' : 'h-20'} flex-col space-y-2 border-red-200 hover:bg-red-50 text-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-200 ${styles.focusRing} ${styles.mobileTouchTarget} active:${styles.buttonPress}`}
            aria-describedby="incorrect-help"
          >
            <XCircle className="h-6 w-6 text-red-600" aria-hidden="true" />
            <span className="text-lg font-medium">Incorrect</span>
            <span className="text-xs text-red-500">Add to end of queue</span>
          </Button>
          <div id="incorrect-help" className="sr-only">
            Mark this answer as incorrect. The card will be added to the end of the queue for review later. Keyboard shortcut: Ctrl+I
          </div>
          
          <Button
            ref={correctButtonRef}
            onClick={handleMarkCorrect}
            disabled={isLoading}
            variant="outline"
            className={`${getTouchTargetSize()} ${isMobile ? 'h-16' : 'h-20'} flex-col space-y-2 border-green-200 hover:bg-green-50 text-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-200 ${styles.focusRing} ${styles.mobileTouchTarget} active:${styles.buttonPress}`}
            aria-describedby="correct-help"
          >
            <CheckCircle className="h-6 w-6 text-green-600" aria-hidden="true" />
            <span className="text-lg font-medium">Correct</span>
            <span className="text-xs text-green-500">Mark as seen</span>
          </Button>
          <div id="correct-help" className="sr-only">
            Mark this answer as correct. The card will be marked as seen and won't appear again for this student. Keyboard shortcut: Ctrl+C
          </div>
        </div>
      </section>
    )
  }

  // Main render logic based on stage
  switch (progress.stage) {
    case 'SHOWING_QUESTION':
      return renderQuestionStage()
    case 'SHOWING_ANSWER':
      return renderAnswerStage()
    case 'AWAITING_TEACHER_JUDGMENT':
      return renderJudgmentStage()
    default:
      return (
        <section role="main" aria-label="Fill-in-blank exercise">
          <LiveRegion />
          <Card className="text-center">
            <CardContent className="p-8">
              <p className="text-slate-600" role="alert">
                Unknown exercise stage: {progress.stage}
              </p>
              <p className="text-sm text-slate-500 mt-2">
                Please refresh the page or contact support if this error persists.
              </p>
            </CardContent>
          </Card>
        </section>
      )
  }
}

// Memoize the component for performance
const MemoizedFillInBlankExercise = memo(FillInBlankExerciseComponent, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  if (
    prevProps.isLoading !== nextProps.isLoading ||
    prevProps.sessionState.id !== nextProps.sessionState.id ||
    !prevProps.sessionState.progress ||
    !nextProps.sessionState.progress
  ) {
    return false
  }
  
  return (
    prevProps.sessionState.progress.stage === nextProps.sessionState.progress.stage &&
    JSON.stringify(prevProps.sessionState.progress.payload) === JSON.stringify(nextProps.sessionState.progress.payload)
  )
})

// Wrap with error boundary for production robustness
export const FillInBlankExercise = (props: ExerciseProps) => (
  <ExerciseErrorBoundary>
    <MemoizedFillInBlankExercise {...props} />
  </ExerciseErrorBoundary>
)