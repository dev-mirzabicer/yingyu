"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Square,
  Volume2,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Target,
  BookOpen,
  Headphones,
  PenTool,
  Brain,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useSession, submitAnswer, endSession } from "@/hooks/use-api-enhanced"
import type { AnswerPayload, VocabularyDeckProgress } from "@/lib/types"

interface EnhancedSessionManagerProps {
  sessionId: string
  onSessionEnd: () => void
}

interface SessionStats {
  totalCards: number
  completedCards: number
  correctAnswers: number
  averageResponseTime: number
  sessionDuration: number
}

const ratingButtons = [
  { value: 1, label: "Again", color: "bg-red-500 hover:bg-red-600", description: "Complete blackout" },
  { value: 2, label: "Hard", color: "bg-orange-500 hover:bg-orange-600", description: "Incorrect, but remembered" },
  { value: 3, label: "Good", color: "bg-blue-500 hover:bg-blue-600", description: "Correct with effort" },
  { value: 4, label: "Easy", color: "bg-green-500 hover:bg-green-600", description: "Perfect recall" },
]

export function EnhancedSessionManager({ sessionId, onSessionEnd }: EnhancedSessionManagerProps) {
  const { session, isLoading, isError, mutate } = useSession(sessionId)
  const [isAnswerVisible, setIsAnswerVisible] = useState(false)
  const [userAnswer, setUserAnswer] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sessionStartTime] = useState(Date.now())
  const [currentCardStartTime, setCurrentCardStartTime] = useState(Date.now())
  const [isEndSessionDialogOpen, setIsEndSessionDialogOpen] = useState(false)
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    totalCards: 0,
    completedCards: 0,
    correctAnswers: 0,
    averageResponseTime: 0,
    sessionDuration: 0,
  })

  const { toast } = useToast()

  // Update session stats when session data changes
  useEffect(() => {
    if (session?.progress?.type === "VOCABULARY_DECK") {
      const progress = session.progress as VocabularyDeckProgress
      setSessionStats({
        totalCards: progress.payload.initialCardIds.length,
        completedCards: progress.payload.initialCardIds.length - progress.payload.queue.length,
        correctAnswers: 0, // This would come from session history
        averageResponseTime: 0, // This would be calculated from response times
        sessionDuration: Date.now() - sessionStartTime,
      })
    }
  }, [session, sessionStartTime])

  const handleRevealAnswer = async () => {
    if (!session) return

    setIsSubmitting(true)
    try {
      const payload: AnswerPayload = {
        action: "REVEAL_ANSWER",
        data: {},
      }

      await submitAnswer(sessionId, payload)
      setIsAnswerVisible(true)
      mutate()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reveal answer. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRatingSubmit = async (rating: number) => {
    if (!session) return

    const responseTime = Date.now() - currentCardStartTime
    setIsSubmitting(true)

    try {
      const payload: AnswerPayload = {
        action: "SUBMIT_RATING",
        data: { rating, responseTime },
      }

      await submitAnswer(sessionId, payload)

      // Reset for next card
      setIsAnswerVisible(false)
      setUserAnswer("")
      setCurrentCardStartTime(Date.now())

      toast({
        title: "Answer submitted",
        description: `Rating: ${rating}/4`,
      })

      mutate()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit rating. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTextAnswerSubmit = async () => {
    if (!session || !userAnswer.trim()) return

    const responseTime = Date.now() - currentCardStartTime
    setIsSubmitting(true)

    try {
      const payload: AnswerPayload = {
        action: "SUBMIT_TEXT_ANSWER",
        data: { answer: userAnswer.trim(), responseTime },
      }

      const result = await submitAnswer(sessionId, payload)

      if (result.data?.submissionResult) {
        const { isCorrect, feedback } = result.data.submissionResult
        toast({
          title: isCorrect ? "Correct!" : "Incorrect",
          description: feedback || (isCorrect ? "Well done!" : "Try again next time."),
          variant: isCorrect ? "default" : "destructive",
        })
      }

      setIsAnswerVisible(true)
      mutate()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit answer. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEndSession = async () => {
    try {
      await endSession(sessionId)
      toast({
        title: "Session ended",
        description: "Your progress has been saved.",
      })
      onSessionEnd()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to end session. Please try again.",
        variant: "destructive",
      })
    }
  }

  const playAudio = (audioUrl: string) => {
    const audio = new Audio(audioUrl)
    audio.play().catch(() => {
      toast({
        title: "Audio Error",
        description: "Failed to play audio file.",
        variant: "destructive",
      })
    })
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert>
            <XCircle className="h-4 w-4" />
            <AlertDescription>Failed to load session. Please try again.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  if (isLoading || !session) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-slate-600">Loading session...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Check if session is completed
  if (session.progress?.type === "VOCABULARY_DECK") {
    const progress = session.progress as VocabularyDeckProgress
    if (progress.payload.queue.length === 0) {
      return (
        <Card>
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
              <h3 className="text-2xl font-bold text-slate-900">Session Complete!</h3>
              <p className="text-slate-600">
                You've completed all cards in this session. Great work, {session.student.name}!
              </p>

              {/* Session Summary */}
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">Cards Reviewed:</span>
                  <span className="font-medium">{sessionStats.totalCards}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Session Duration:</span>
                  <span className="font-medium">{Math.round(sessionStats.sessionDuration / 60000)} minutes</span>
                </div>
              </div>

              <Button onClick={handleEndSession} className="bg-green-600 hover:bg-green-700">
                End Session
              </Button>
            </div>
          </CardContent>
        </Card>
      )
    }
  }

  // Render different exercise types
  const renderExerciseContent = () => {
    if (!session.currentUnitItem) {
      return (
        <div className="text-center py-8">
          <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No current exercise</p>
        </div>
      )
    }

    const { currentUnitItem } = session

    // Vocabulary Deck Exercise
    if (currentUnitItem.type === "VOCABULARY_DECK" && session.progress?.type === "VOCABULARY_DECK") {
      const progress = session.progress as VocabularyDeckProgress
      const currentCard = progress.payload.currentCardData

      if (!currentCard) {
        return (
          <div className="text-center py-8">
            <Target className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">Loading card...</p>
          </div>
        )
      }

      return (
        <div className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Progress</span>
              <span>
                {sessionStats.completedCards} / {sessionStats.totalCards}
              </span>
            </div>
            <Progress value={(sessionStats.completedCards / sessionStats.totalCards) * 100} className="h-2" />
          </div>

          {/* Card Content */}
          <Card className="border-2 border-blue-200">
            <CardContent className="p-8">
              <div className="text-center space-y-6">
                {/* English Word */}
                <div className="space-y-2">
                  <h3 className="text-4xl font-bold text-slate-900">{currentCard.englishWord}</h3>
                  {currentCard.ipaPronunciation && (
                    <p className="text-lg text-slate-500">/{currentCard.ipaPronunciation}/</p>
                  )}
                  {currentCard.wordType && (
                    <Badge variant="outline" className="text-sm">
                      {currentCard.wordType}
                    </Badge>
                  )}
                </div>

                {/* Audio Button */}
                {currentCard.audioUrl && (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => playAudio(currentCard.audioUrl!)}
                    className="mx-auto"
                  >
                    <Volume2 className="h-5 w-5 mr-2" />
                    Play Audio
                  </Button>
                )}

                {/* Image */}
                {currentCard.imageUrl && (
                  <div className="flex justify-center">
                    <img
                      src={currentCard.imageUrl || "/placeholder.svg"}
                      alt={currentCard.englishWord}
                      className="max-w-64 max-h-48 rounded-lg shadow-md"
                    />
                  </div>
                )}

                {/* Answer Section */}
                {progress.stage === "PRESENTING_CARD" ? (
                  <div className="space-y-4">
                    <Button
                      onClick={handleRevealAnswer}
                      disabled={isSubmitting}
                      size="lg"
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Eye className="h-5 w-5 mr-2" />
                      {isSubmitting ? "Loading..." : "Show Answer"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Chinese Translation */}
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <h4 className="text-2xl font-bold text-green-900">{currentCard.chineseTranslation}</h4>
                      {currentCard.pinyin && <p className="text-lg text-green-700 mt-1">{currentCard.pinyin}</p>}
                    </div>

                    {/* Example Sentences */}
                    {currentCard.exampleSentences && (
                      <div className="text-left space-y-2">
                        <h5 className="font-medium text-slate-700">Example:</h5>
                        <div className="bg-slate-50 p-3 rounded-lg">
                          <p className="text-slate-900">
                            {typeof currentCard.exampleSentences === "object" && currentCard.exampleSentences !== null
                              ? (currentCard.exampleSentences as any).english ||
                              JSON.stringify(currentCard.exampleSentences)
                              : String(currentCard.exampleSentences)}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Rating Buttons */}
                    <div className="space-y-4">
                      <p className="text-sm text-slate-600">How well did you know this word?</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {ratingButtons.map((button) => (
                          <Button
                            key={button.value}
                            onClick={() => handleRatingSubmit(button.value)}
                            disabled={isSubmitting}
                            className={`${button.color} text-white flex flex-col h-auto py-3`}
                            title={button.description}
                          >
                            <span className="font-bold">{button.label}</span>
                            <span className="text-xs opacity-90">{button.value}/4</span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    // Grammar Exercise
    if (currentUnitItem.type === "GRAMMAR_EXERCISE" && currentUnitItem.grammarExercise) {
      return (
        <Card className="border-2 border-purple-200">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <PenTool className="h-5 w-5 text-purple-600" />
              <span>Grammar Exercise</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-slate-900 mb-2">{currentUnitItem.grammarExercise.title}</h3>
              <Badge variant="outline" className="mb-4">
                {currentUnitItem.grammarExercise.grammarTopic}
              </Badge>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-slate-700">
                Grammar exercise content would be rendered here based on the exerciseData structure.
              </p>
            </div>

            <div className="space-y-4">
              <Label htmlFor="grammar-answer">Your Answer:</Label>
              <Textarea
                id="grammar-answer"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="Enter your answer..."
                rows={3}
              />
              <Button
                onClick={handleTextAnswerSubmit}
                disabled={isSubmitting || !userAnswer.trim()}
                className="bg-purple-600 hover:bg-purple-700"
              >
                Submit Answer
              </Button>
            </div>
          </CardContent>
        </Card>
      )
    }

    // Listening Exercise
    if (currentUnitItem.type === "LISTENING_EXERCISE" && currentUnitItem.listeningExercise) {
      return (
        <Card className="border-2 border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Headphones className="h-5 w-5 text-orange-600" />
              <span>Listening Exercise</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-slate-900 mb-4">{currentUnitItem.listeningExercise.title}</h3>

              <div className="bg-orange-50 p-6 rounded-lg">
                <Button
                  onClick={() => playAudio(currentUnitItem.listeningExercise!.audioUrl)}
                  size="lg"
                  className="bg-orange-600 hover:bg-orange-700 mb-4"
                >
                  <Volume2 className="h-6 w-6 mr-2" />
                  Play Audio
                </Button>
                <p className="text-sm text-orange-700">Listen carefully and type what you hear</p>
              </div>
            </div>

            <div className="space-y-4">
              <Label htmlFor="listening-answer">What did you hear?</Label>
              <Input
                id="listening-answer"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="Type what you heard..."
                className="text-lg"
              />
              <Button
                onClick={handleTextAnswerSubmit}
                disabled={isSubmitting || !userAnswer.trim()}
                className="bg-orange-600 hover:bg-orange-700"
              >
                Submit Answer
              </Button>
            </div>

            {isAnswerVisible && (
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h5 className="font-medium text-green-900 mb-2">Correct Answer:</h5>
                <p className="text-green-800 text-lg">{currentUnitItem.listeningExercise.correctSpelling}</p>
                {currentUnitItem.listeningExercise.explanation && (
                  <p className="text-green-700 text-sm mt-2">{currentUnitItem.listeningExercise.explanation}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )
    }

    // Fill in the Blank Exercise
    if (currentUnitItem.type === "VOCAB_FILL_IN_BLANK_EXERCISE" && currentUnitItem.vocabFillInBlankExercise) {
      return (
        <Card className="border-2 border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Brain className="h-5 w-5 text-green-600" />
              <span>Fill in the Blank</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-slate-900 mb-4">
                {currentUnitItem.vocabFillInBlankExercise.title}
              </h3>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-slate-700">
                Fill-in-the-blank exercise content would be rendered here based on the exerciseData structure.
              </p>
            </div>

            <div className="space-y-4">
              <Label htmlFor="blank-answer">Fill in the blank:</Label>
              <Input
                id="blank-answer"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="Enter the missing word..."
                className="text-lg"
              />
              <Button
                onClick={handleTextAnswerSubmit}
                disabled={isSubmitting || !userAnswer.trim()}
                className="bg-green-600 hover:bg-green-700"
              >
                Submit Answer
              </Button>
            </div>
          </CardContent>
        </Card>
      )
    }

    return (
      <div className="text-center py-8">
        <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500">Unknown exercise type</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Session Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Live Session</h2>
          <p className="text-slate-600">
            {session.student.name} • {session.unit.name}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2 text-sm text-slate-600">
            <Clock className="h-4 w-4" />
            <span>{Math.round((Date.now() - sessionStartTime) / 60000)} min</span>
          </div>
          <Button
            variant="outline"
            onClick={() => setIsEndSessionDialogOpen(true)}
            className="text-red-600 border-red-200 hover:bg-red-50"
          >
            <Square className="h-4 w-4 mr-2" />
            End Session
          </Button>
        </div>
      </div>

      {/* Session Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">Progress</p>
                <p className="text-lg font-bold text-slate-900">
                  {sessionStats.completedCards}/{sessionStats.totalCards}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">Correct</p>
                <p className="text-lg font-bold text-slate-900">{sessionStats.correctAnswers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">Avg Time</p>
                <p className="text-lg font-bold text-slate-900">
                  {sessionStats.averageResponseTime > 0
                    ? `${(sessionStats.averageResponseTime / 1000).toFixed(1)}s`
                    : "N/A"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Brain className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">Duration</p>
                <p className="text-lg font-bold text-slate-900">
                  {Math.round(sessionStats.sessionDuration / 60000)} min
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Exercise Content */}
      {renderExerciseContent()}

      {/* End Session Dialog */}
      <Dialog open={isEndSessionDialogOpen} onOpenChange={setIsEndSessionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-slate-600">Are you sure you want to end this session? Your progress will be saved.</p>

            <div className="bg-slate-50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-600">Cards Completed:</span>
                <span className="font-medium">
                  {sessionStats.completedCards} / {sessionStats.totalCards}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Session Duration:</span>
                <span className="font-medium">{Math.round(sessionStats.sessionDuration / 60000)} minutes</span>
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsEndSessionDialogOpen(false)}>
                Continue Session
              </Button>
              <Button onClick={handleEndSession} className="bg-red-600 hover:bg-red-700">
                End Session
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
