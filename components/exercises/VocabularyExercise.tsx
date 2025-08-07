"use client"

import {
  FullSessionState,
  VocabularyDeckProgress,
} from "@/lib/types"
import { UnitItemType } from "@prisma/client"
import {
  BookOpen,
  CheckCircle,
  FileText,
  Mic,
  RotateCcw,
  Volume2,
  XCircle,
} from "lucide-react"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"

type Rating = 1 | 2 | 3 | 4 // Again, Hard, Good, Easy

export interface ExerciseProps {
  sessionState: FullSessionState
  onRevealAnswer: () => void
  onSubmitRating: (rating: Rating) => void
  isLoading: boolean
}

export function VocabularyExercise({
  sessionState,
  onRevealAnswer,
  onSubmitRating,
  isLoading,
}: ExerciseProps) {
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
                    {typeof currentCard.exampleSentences === "string"
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
