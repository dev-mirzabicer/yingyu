"use client"

import { useRef, useState, useEffect } from "react"
import {
  FullSessionState,
  ListeningDeckProgress,
} from "@/lib/types"
import { VocabularyCard } from "@prisma/client"
import {
  Mic,
  Play,
  Pause,
  Volume2,
  RotateCcw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
} from "lucide-react"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Alert, AlertDescription } from "../ui/alert"


export interface ExerciseProps {
  sessionState: FullSessionState
  onRevealAnswer: () => void
  onSubmitRating: (rating: number) => void
  isLoading: boolean
}

interface ListeningCardData {
  cardId: string
  card: VocabularyCard
}

export function ListeningExercise({
  sessionState,
  onRevealAnswer,
  onSubmitRating,
  isLoading,
}: ExerciseProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isAudioLoading, setIsAudioLoading] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioLoaded, setAudioLoaded] = useState(false)

  const progress = sessionState.progress as ListeningDeckProgress
  const currentCard = progress.payload.currentCardData as ListeningCardData

  // Reset audio state when card changes
  useEffect(() => {
    setIsPlaying(false)
    setAudioLoaded(false)
    setAudioError(null)
    setIsAudioLoading(false)
  }, [currentCard?.cardId])

  const handleAudioLoadStart = () => {
    setIsAudioLoading(true)
    setAudioError(null)
  }

  const handleAudioLoaded = () => {
    setIsAudioLoading(false)
    setAudioLoaded(true)
  }

  const handleAudioError = () => {
    setIsAudioLoading(false)
    setAudioError("Failed to load audio. Please check the audio URL.")
  }

  const handleAudioEnded = () => {
    setIsPlaying(false)
  }

  const toggleAudioPlayback = async () => {
    if (!audioRef.current || audioError) return

    try {
      if (isPlaying) {
        audioRef.current.pause()
        setIsPlaying(false)
      } else {
        await audioRef.current.play()
        setIsPlaying(true)
      }
    } catch (error) {
      console.error('Failed to play audio:', error)
      setAudioError("Failed to play audio. Please try again.")
      setIsPlaying(false)
    }
  }

  const handlePlayAudio = () => {
    if (!audioError && audioLoaded) {
      onRevealAnswer() // This will send PLAY_AUDIO action to transition to rating stage
    }
  }

  if (!currentCard) {
    return (
      <Card className="text-center">
        <CardContent className="p-8">
          <p className="text-slate-600">No more listening exercises to review!</p>
        </CardContent>
      </Card>
    )
  }

  const audioUrl = currentCard?.card.audioUrl

  return (
    <>
      {/* Hidden audio element for programmatic control */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onLoadStart={handleAudioLoadStart}
          onCanPlayThrough={handleAudioLoaded}
          onError={handleAudioError}
          onEnded={handleAudioEnded}
          preload="metadata"
        />
      )}

      {/* Current Card */}
      <Card className="text-center">
        <CardHeader>
          <div className="flex items-center justify-center space-x-2 mb-2">
            <Mic className="h-5 w-5 text-purple-600" />
            <Badge variant="outline" className="border-purple-200 text-purple-700">
              Listening
            </Badge>
          </div>
          <CardTitle className="text-4xl font-bold text-slate-900">
            {progress.stage === "AWAITING_RATING" ? currentCard.card.englishWord : "?"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Audio Error Alert */}
          {audioError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{audioError}</AlertDescription>
            </Alert>
          )}

          {/* Audio Controls - Show during PLAYING_AUDIO stage */}
          {progress.stage === "PLAYING_AUDIO" && (
            <div className="space-y-4">
              <div className="p-6 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center justify-center space-x-4">
                  <Button
                    onClick={toggleAudioPlayback}
                    disabled={!audioUrl || isAudioLoading || audioError !== null}
                    variant="outline"
                    size="lg"
                    className="border-purple-300 hover:bg-purple-100"
                  >
                    {isAudioLoading ? (
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    ) : isPlaying ? (
                      <Pause className="h-5 w-5 mr-2" />
                    ) : (
                      <Play className="h-5 w-5 mr-2" />
                    )}
                    {isAudioLoading 
                      ? "Loading..." 
                      : isPlaying 
                      ? "Pause Audio" 
                      : "Play Audio"
                    }
                  </Button>
                </div>
                <p className="text-sm text-purple-600 mt-2">
                  Listen carefully and identify the English word you hear
                </p>
              </div>
            </div>
          )}

          {/* Answer Details - Show during AWAITING_RATING stage */}
          {progress.stage === "AWAITING_RATING" && (
            <>
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-600 font-medium mb-1">
                  You heard:
                </p>
                <p className="text-3xl font-bold text-green-800">
                  {currentCard.card.englishWord}
                </p>
                {currentCard.card.ipaPronunciation && (
                  <p className="text-sm text-slate-600 mt-2">
                    /{currentCard.card.ipaPronunciation}/
                  </p>
                )}
              </div>
              
              {/* Replay Audio Button */}
              <Button
                onClick={toggleAudioPlayback}
                disabled={!audioUrl || isAudioLoading || audioError !== null}
                variant="outline"
                size="sm"
                className="border-purple-300 hover:bg-purple-100"
              >
                {isAudioLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="h-4 w-4 mr-2" />
                ) : (
                  <Volume2 className="h-4 w-4 mr-2" />
                )}
                {isAudioLoading 
                  ? "Loading..." 
                  : isPlaying 
                  ? "Pause" 
                  : "Replay Audio"
                }
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="space-y-4">
        {progress.stage === "PLAYING_AUDIO" && (
          <Button
            onClick={handlePlayAudio}
            disabled={isLoading || !audioLoaded || audioError !== null}
            className="w-full h-12 text-lg bg-purple-600 hover:bg-purple-700"
          >
            {isLoading ? "Loading..." : "Continue to Rate"}
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
