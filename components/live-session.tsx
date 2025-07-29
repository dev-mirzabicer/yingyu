"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Volume2, RotateCcw, CheckCircle, XCircle, Clock, BookOpen, ArrowLeft, Pause, Play, FileText, Mic } from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { useSession, submitAnswer, endSession } from "@/hooks/use-api"
import { FullSessionState, VocabularyDeckProgress, AnswerPayload } from "@/lib/types"
import { UnitItemType } from "@prisma/client"

interface LiveSessionProps {
  sessionId: string
}

type Rating = 1 | 2 | 3 | 4 // Again, Hard, Good, Easy

// Exercise type information mapping - modular and extensible
const exerciseTypeInfo = {
  [UnitItemType.VOCABULARY_DECK]: {
    label: "Vocabulary",
    icon: BookOpen,
    color: "bg-blue-100 text-blue-700",
  },
  [UnitItemType.GRAMMAR_EXERCISE]: {
    label: "Grammar",
    icon: FileText,
    color: "bg-green-100 text-green-700",
  },
  [UnitItemType.LISTENING_EXERCISE]: {
    label: "Listening",
    icon: Mic,
    color: "bg-purple-100 text-purple-700",
  },
  [UnitItemType.VOCAB_FILL_IN_BLANK_EXERCISE]: {
    label: "Fill in Blank",
    icon: FileText,
    color: "bg-orange-100 text-orange-700",
  },
}

// Component for handling vocabulary deck exercises - modular and focused
function VocabularyExercise({
  sessionState,
  onRevealAnswer,
  onSubmitRating,
  isLoading
}: {
  sessionState: FullSessionState
  onRevealAnswer: () => void
  onSubmitRating: (rating: Rating) => void
  isLoading: boolean
}) {
  const progress = sessionState.progress as VocabularyDeckProgress
  const currentCard = progress.payload.currentCardData

  if (!currentCard) {
    return (
      <Card className="text-center">
        <CardContent className="p-8">
          <p className="text-slate-600">No more cards to review!</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {/* Current Card */}
      <Card className="text-center">
        <CardHeader>
          <div className="flex items-center justify-center space-x-2 mb-2">
            <BookOpen className="h-5 w-5 text-blue-600" />
            <Badge variant="outline">Vocabulary</Badge>
          </div>
          <CardTitle className="text-4xl font-bold text-slate-900">
            {currentCard.englishWord}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {progress.stage === "AWAITING_RATING" && (
            <>
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-2xl font-medium text-slate-900 mb-2">
                  {currentCard.chineseTranslation}
                </p>
                {currentCard.exampleSentences && (
                  <p className="text-slate-600">
                    {typeof currentCard.exampleSentences === 'string' 
                      ? currentCard.exampleSentences 
                      : JSON.stringify(currentCard.exampleSentences)}
                  </p>
                )}
              </div>
              <Button variant="outline" size="sm">
                <Volume2 className="h-4 w-4 mr-2" />
                Play Audio
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="space-y-4">
        {progress.stage === "PRESENTING_CARD" && (
          <Button
            onClick={onRevealAnswer}
            disabled={isLoading}
            className="w-full h-12 text-lg bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? "Loading..." : "Reveal Answer"}
          </Button>
        )}

        {progress.stage === "AWAITING_RATING" && (
          <div className="grid grid-cols-4 gap-3">
            <Button
              onClick={() => onSubmitRating(1)}
              disabled={isLoading}
              variant="outline"
              className="h-16 flex-col space-y-1 border-red-200 hover:bg-red-50"
            >
              <XCircle className="h-5 w-5 text-red-600" />
              <span className="text-sm">Again</span>
            </Button>
            <Button
              onClick={() => onSubmitRating(2)}
              disabled={isLoading}
              variant="outline"
              className="h-16 flex-col space-y-1 border-orange-200 hover:bg-orange-50"
            >
              <RotateCcw className="h-5 w-5 text-orange-600" />
              <span className="text-sm">Hard</span>
            </Button>
            <Button
              onClick={() => onSubmitRating(3)}
              disabled={isLoading}
              variant="outline"
              className="h-16 flex-col space-y-1 border-blue-200 hover:bg-blue-50"
            >
              <CheckCircle className="h-5 w-5 text-blue-600" />
              <span className="text-sm">Good</span>
            </Button>
            <Button
              onClick={() => onSubmitRating(4)}
              disabled={isLoading}
              variant="outline"
              className="h-16 flex-col space-y-1 border-green-200 hover:bg-green-50"
            >
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-sm">Easy</span>
            </Button>
          </div>
        )}
      </div>
    </>
  )
}

// Placeholder component for future exercise types - extensible architecture
function UnsupportedExercise({ type }: { type: UnitItemType }) {
  const typeInfo = exerciseTypeInfo[type] || { label: "Unknown", icon: FileText, color: "bg-gray-100 text-gray-700" }
  const Icon = typeInfo.icon

  return (
    <Card className="text-center">
      <CardContent className="p-8">
        <div className={`inline-flex p-4 rounded-lg ${typeInfo.color} mb-4`}>
          <Icon className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-semibold text-slate-900 mb-2">{typeInfo.label} Exercise</h3>
        <p className="text-slate-600">This exercise type is coming soon!</p>
      </CardContent>
    </Card>
  )
}

export function LiveSession({ sessionId }: LiveSessionProps) {
  const { session, isLoading: sessionLoading, isError, mutate } = useSession(sessionId)
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)
  const router = useRouter()
  const { toast } = useToast()

  // Timer effect - tracks real session time
  useEffect(() => {
    if (!isPaused && session?.status === "IN_PROGRESS") {
      const interval = setInterval(() => {
        setElapsedTime((prev) => prev + 1)
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [isPaused, session?.status])

  // Initialize elapsed time based on session start time
  useEffect(() => {
    if (session?.startTime) {
      const startTime = new Date(session.startTime).getTime()
      const now = new Date().getTime()
      setElapsedTime(Math.floor((now - startTime) / 1000))
    }
  }, [session?.startTime])

  const handleRevealAnswer = async () => {
    if (!session) return

    setIsActionLoading(true)
    try {
      const payload: AnswerPayload = {
        action: 'REVEAL_ANSWER',
        data: {}
      }

      await submitAnswer(sessionId, payload)
      await mutate() // Refresh session state

      toast({
        title: "Answer revealed",
        description: "Rate how well you knew this card.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reveal answer. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleRating = async (rating: Rating) => {
    if (!session) return

    setIsActionLoading(true)
    try {
      const payload: AnswerPayload = {
        action: 'SUBMIT_RATING',
        data: { rating }
      }

      const result = await submitAnswer(sessionId, payload)
      await mutate() // Refresh session state

      toast({
        title: "Rating submitted",
        description: `Card rated as ${['', 'Again', 'Hard', 'Good', 'Easy'][rating]}.`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit rating. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleEndSession = async () => {
    if (!session) return

    try {
      await endSession(sessionId)
      toast({
        title: "Session ended",
        description: "Returning to student profile...",
      })
      router.push(`/students/${session.studentId}`)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to end session. Please try again.",
        variant: "destructive",
      })
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  // Calculate progress based on session data - dynamic progress tracking
  const getProgressData = () => {
    if (!session?.progress || !session.currentUnitItem) {
      return { current: 0, total: 1, percentage: 0 }
    }

    const currentItemIndex = session.unit.items.findIndex(
      item => item.id === session.currentUnitItemId
    )
    const current = currentItemIndex + 1
    const total = session.unit.items.length
    const percentage = (current / total) * 100

    return { current, total, percentage }
  }

  const progressData = getProgressData()

  // Error state
  if (isError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-slate-600">Failed to load session. Please try again.</p>
            <Button onClick={() => router.back()} className="mt-4">
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Loading state with comprehensive skeletons
  if (sessionLoading || !session) {
    return (
      <div className="min-h-screen bg-slate-50">
        {/* Header Skeleton */}
        <div className="bg-white border-b border-slate-200 px-4 py-3">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <div className="flex items-center space-x-4">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-4 w-48" />
            </div>
            <div className="flex items-center space-x-4">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="flex h-[calc(100vh-73px)]">
          <div className="w-64 bg-white border-r border-slate-200 p-4 space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-2 w-full" />
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-8" />
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="w-full max-w-2xl space-y-6">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Completed state
  if (session.status === "COMPLETED") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-green-100 rounded-full w-fit">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Session Complete!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center space-y-2">
              <p className="text-slate-600">Great work with {session.student.name}!</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="space-y-1">
                <p className="text-2xl font-bold text-slate-900">{session.unit.items.length}</p>
                <p className="text-sm text-slate-600">Exercises Completed</p>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold text-slate-900">{formatTime(elapsedTime)}</p>
                <p className="text-sm text-slate-600">Total Time</p>
              </div>
            </div>

            <Button onClick={() => router.push(`/students/${session.studentId}`)} className="w-full bg-blue-600 hover:bg-blue-700">
              Return to Student Profile
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const currentExerciseType = session.currentUnitItem?.type
  const currentExerciseTypeInfo = currentExerciseType ? exerciseTypeInfo[currentExerciseType] : null

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Session Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={handleEndSession}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              End Session
            </Button>
            <div className="text-sm text-slate-600">
              <span className="font-medium">{session.student.name}</span> • {session.unit.name}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-slate-600">
              <Clock className="h-4 w-4" />
              <span>{formatTime(elapsedTime)}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => setIsPaused(!isPaused)}>
              {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Session Content */}
      <div className="flex h-[calc(100vh-73px)]">
        {/* Session Sidebar */}
        <div className="w-64 bg-white border-r border-slate-200 p-4 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Progress</span>
              <span className="font-medium">
                {progressData.current} / {progressData.total}
              </span>
            </div>
            <Progress value={progressData.percentage} className="h-2" />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Current Exercise</span>
              {currentExerciseTypeInfo && (
                <Badge variant="outline" className="text-xs">
                  {currentExerciseTypeInfo.label}
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Unit</span>
              <span className="font-medium text-xs">{session.unit.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Student</span>
              <span className="font-medium text-xs">{session.student.name}</span>
            </div>
          </div>
        </div>

        {/* Main Exercise Area */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-2xl space-y-6">
            {/* Modular Exercise Rendering - Extensible Architecture */}
            {currentExerciseType === UnitItemType.VOCABULARY_DECK ? (
              <VocabularyExercise
                sessionState={session}
                onRevealAnswer={handleRevealAnswer}
                onSubmitRating={handleRating}
                isLoading={isActionLoading}
              />
            ) : currentExerciseType ? (
              <UnsupportedExercise type={currentExerciseType} />
            ) : (
              <Card className="text-center">
                <CardContent className="p-8">
                  <p className="text-slate-600">No exercise loaded.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
