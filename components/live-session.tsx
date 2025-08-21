"use client"

import { useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Clock, ArrowLeft, Pause, Play, CheckCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { useSession, submitAnswer, endSession } from "@/hooks/api/sessions"
import { AnswerPayload, VocabularyDeckProgress, ListeningDeckProgress, FillInTheBlankProgress, SessionProgress } from "@/lib/types"
import { formatTime } from "@/lib/utils"
import { useLiveSessionStore } from "@/hooks/stores/use-live-session-store"
import { getExerciseComponent, exerciseTypeInfo } from "@/components/exercises/dispatcher"
import { format } from "date-fns"
import { StudentCardState, VocabularyCard } from '@prisma/client'

interface LiveSessionProps {
  sessionId: string
}

type Rating = 1 | 2 | 3 | 4
type CorrectnessRating = { isCorrect: boolean }
type AnyRating = Rating | CorrectnessRating
type EnrichedStudentCardState = StudentCardState & { card: VocabularyCard };

export function LiveSession({ sessionId }: LiveSessionProps) {
  const { session, isLoading: sessionLoading, isError } = useSession(sessionId)
  const router = useRouter()
  const { toast } = useToast()

  const {
    isActionLoading,
    isPaused,
    elapsedTime,
    setActionLoading,
    pauseSession,
    resumeSession,
    incrementReviewCount,
    setElapsedTime,
    initializeSession,
    setProgress,
    reset,
    progress,
    reviewCount,
    encounteredCards,
    sessionId: storeSessionId,
  } = useLiveSessionStore()

  const progressData = useMemo(() => {
    if (!progress) {
      return {
        totalCards: 0,
        completedCards: 0,
        remainingCards: 0,
        percentage: 0,
        currentCard: null,
        queueAnalysis: { totalInQueue: 0, newCards: 0, learningCards: 0, reviewCards: 0 },
        reviewsCompleted: 0,
        uniqueCardsEncountered: 0,
      };
    }

    const { queue, currentCardData } = progress.payload;
    const queueCardIds = new Set(queue.map(c => c.cardId));
    const totalUniqueCardsInSession = new Set([...encounteredCards, ...queueCardIds]).size;
    const completedCards = encounteredCards.size;
    const percentage = totalUniqueCardsInSession > 0 ? (completedCards / totalUniqueCardsInSession) * 100 : 0;

    // Handle queue analysis differently for vocabulary vs listening
    let queueAnalysis;
    if (progress.type === 'VOCABULARY_DECK') {
      queueAnalysis = {
        totalInQueue: queue.length,
        newCards: queue.filter(c => c.state === 'NEW').length,
        learningCards: queue.filter(c => c.state === 'LEARNING' || c.state === 'RELEARNING').length,
        reviewCards: queue.filter(c => c.state === 'REVIEW').length,
      };
    } else if (progress.type === 'LISTENING_EXERCISE') {
      // Listening exercises may have different state structure
      queueAnalysis = {
        totalInQueue: queue.length,
        newCards: queue.filter(c => c.state === 'NEW').length,
        learningCards: queue.filter(c => c.state === 'LEARNING' || c.state === 'RELEARNING').length,
        reviewCards: queue.filter(c => c.state === 'REVIEW').length,
      };
    } else if (progress.type === 'FILL_IN_THE_BLANK_EXERCISE') {
      // Fill in the blank exercises have a simple queue structure
      queueAnalysis = {
        totalInQueue: queue.length,
        newCards: 0, // Fill in the blank cards don't have FSRS states
        learningCards: 0,
        reviewCards: queue.length, // All cards are considered review
      };
    } else {
      queueAnalysis = { totalInQueue: queue.length, newCards: 0, learningCards: 0, reviewCards: 0 };
    }

    return {
      totalCards: totalUniqueCardsInSession,
      completedCards,
      remainingCards: queue.length,
      percentage,
      currentCard: currentCardData as EnrichedStudentCardState | undefined,
      queueAnalysis,
      reviewsCompleted: reviewCount,
      uniqueCardsEncountered: encounteredCards.size,
    };
  }, [progress, reviewCount, encounteredCards]);

  useEffect(() => {
    if (session) {
      if (storeSessionId !== session.id) {
        initializeSession(session)
      } else if (session.progress) {
        setProgress(session.progress as SessionProgress)
      }
    }
  }, [session, storeSessionId, initializeSession, setProgress])

  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    if (!isPaused && session?.status === "IN_PROGRESS") {
      timer = setInterval(() => {
        setElapsedTime(elapsedTime + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isPaused, session?.status, elapsedTime, setElapsedTime]);

  useEffect(() => {
    return () => {
      reset()
    }
  }, [reset])

  const handleRevealAnswer = async () => {
    if (!session) return

    setActionLoading(true)
    try {
      // Determine the correct action based on exercise type
      const action = progress?.type === 'LISTENING_EXERCISE' ? 'PLAY_AUDIO' : 'REVEAL_ANSWER'
      const payload: AnswerPayload = { action, data: {} }
      const result = await submitAnswer(sessionId, payload)
      if (result.data.newState.progress) {
        setProgress(result.data.newState.progress as SessionProgress)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: progress?.type === 'LISTENING_EXERCISE' 
          ? "Failed to play audio. Please try again."
          : "Failed to reveal answer. Please try again.",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleRating = async (rating: AnyRating) => {
    if (!session) return

    setActionLoading(true)
    try {
      incrementReviewCount() // Optimistic update
      const payload: AnswerPayload = { action: 'SUBMIT_RATING', data: rating }
      const result = await submitAnswer(sessionId, payload)
      if (result.data.newState.progress) {
        setProgress(result.data.newState.progress as SessionProgress)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit rating. Please try again.",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
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

  const togglePause = () => {
    if (isPaused) {
      resumeSession()
    } else {
      pauseSession()
    }
  }

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

  if (sessionLoading || !session || !progress) {
    return (
      <div className="min-h-screen bg-slate-50">
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
                <p className="text-2xl font-bold text-slate-900">{progressData.reviewsCompleted}</p>
                <p className="text-sm text-slate-600">Total Reviews</p>
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

  const ExerciseComponent = getExerciseComponent(session.currentUnitItem?.type)

  return (
    <div className="min-h-screen bg-slate-50">
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
            <Button variant="outline" size="sm" onClick={togglePause}>
              {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-73px)]">
        <div className="w-64 bg-white border-r border-slate-200 p-4 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Progress</span>
              <span className="font-medium">
                {progressData.completedCards} / {progressData.totalCards}
              </span>
            </div>
            <Progress value={progressData.percentage} className="h-2" />
            <div className="text-xs text-slate-500">
              Unique cards seen from initial queue
            </div>
          </div>

          {session?.progress?.type === 'VOCABULARY_DECK' && (
            <div className="space-y-3 border-t pt-4">
              <h4 className="text-sm font-medium text-slate-700">Live Queue Status</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Cards in Queue</span>
                  <span className="font-medium">{progressData.queueAnalysis.totalInQueue}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-blue-50 rounded p-2 text-center">
                    <div className="font-medium text-blue-700">{progressData.queueAnalysis.newCards}</div>
                    <div className="text-blue-600">New</div>
                  </div>
                  <div className="bg-yellow-50 rounded p-2 text-center">
                    <div className="font-medium text-yellow-700">{progressData.queueAnalysis.learningCards}</div>
                    <div className="text-yellow-600">Learning</div>
                  </div>
                  <div className="bg-orange-50 rounded p-2 text-center">
                    <div className="font-medium text-orange-700">{progressData.queueAnalysis.reviewCards}</div>
                    <div className="text-orange-600">Review</div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Total Reviews</span>
                  <span className="font-medium">{progressData.reviewsCompleted}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Unique Cards Seen</span>
                  <span className="font-medium">{progressData.uniqueCardsEncountered}</span>
                </div>
                {progressData.reviewsCompleted > progressData.uniqueCardsEncountered && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
                    <div className="text-xs text-yellow-700 font-medium">
                       Cards Cycling
                    </div>
                    <div className="text-xs text-yellow-600">
                      {progressData.reviewsCompleted - progressData.uniqueCardsEncountered} repeat reviews
                    </div>
                  </div>
                )}
                {progressData.currentCard && (
                  <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <h4 className="font-semibold text-sm text-slate-600 mb-2">FSRS Details</h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Stability:</span>
                        <span className="font-medium text-slate-700">{progressData.currentCard.stability.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Difficulty:</span>
                        <span className="font-medium text-slate-700">{progressData.currentCard.difficulty.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Reps:</span>
                        <span className="font-medium text-slate-700">{progressData.currentCard.reps}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Lapses:</span>
                        <span className="font-medium text-slate-700">{progressData.currentCard.lapses}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">State:</span>
                        <Badge variant="outline" className="text-xs">{progressData.currentCard.state}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Due:</span>
                        <span className="font-medium text-slate-700">{format(new Date(progressData.currentCard.due), "MMM dd, yyyy")}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Current Exercise</span>
              {session.currentUnitItem?.type && (
                <Badge variant="outline" className="text-xs">
                  {exerciseTypeInfo[session.currentUnitItem?.type]?.label}
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

        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-2xl space-y-6">
            <ExerciseComponent
              sessionState={session}
              onRevealAnswer={handleRevealAnswer}
              onSubmitRating={handleRating}
              isLoading={isActionLoading}
            />
          </div>
        </div>
      </div>
    </div>
  )
}