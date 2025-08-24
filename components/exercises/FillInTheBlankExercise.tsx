"use client"

import {
  FillInTheBlankProgress,
} from "@/lib/types"
import {
  PencilLine,
  CheckCircle,
  XCircle,
  BookOpen,
} from "lucide-react"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"


import { ExerciseProps } from "./VocabularyExercise"

export function FillInTheBlankExercise({
  sessionState,
  onRevealAnswer,
  onSubmitRating,
  isLoading,
}: ExerciseProps) {
  const progress = sessionState.progress as FillInTheBlankProgress
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

  // Function to highlight the blank in the question
  const renderQuestionWithBlank = (question: string, answer?: string) => {
    // Replace common blank patterns with highlighted spans
    const blankPatterns = [/___+/g, /____/g, /\bBLANK\b/gi, /\b_+\b/g]
    
    let highlightedQuestion = question
    
    for (const pattern of blankPatterns) {
      if (pattern.test(highlightedQuestion)) {
        if (answer) {
          // Show the answer in the blank
          highlightedQuestion = highlightedQuestion.replace(pattern, 
            `<span class="bg-orange-100 text-orange-800 px-2 py-1 rounded font-semibold">${answer}</span>`
          )
        } else {
          // Show the blank
          highlightedQuestion = highlightedQuestion.replace(pattern, 
            '<span class="bg-slate-200 text-slate-600 px-3 py-1 rounded">____</span>'
          )
        }
        break // Only replace the first pattern found
      }
    }
    
    return { __html: highlightedQuestion }
  }

  return (
    <>
      {/* Current Card */}
      <Card className="text-center">
        <CardHeader>
          <div className="flex items-center justify-center space-x-2 mb-2">
            <PencilLine className="h-5 w-5 text-orange-600" />
            <Badge variant="outline" className="border-orange-200 text-orange-700">
              Fill in the Blank
            </Badge>
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900 leading-relaxed">
            <div 
              dangerouslySetInnerHTML={renderQuestionWithBlank(
                currentCard.question, 
                progress.stage === "AWAITING_CORRECTNESS" ? currentCard.answer : undefined
              )} 
            />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Show options if they exist and we're presenting the card */}
          {progress.stage === "PRESENTING_CARD" && currentCard.options && Array.isArray(currentCard.options) && currentCard.options.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-slate-600 mb-3">Choose from the options below:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {(currentCard.options as string[]).map((option: string, index: number) => (
                  <Badge 
                    key={index} 
                    variant="outline" 
                    className="text-sm py-1 px-3 cursor-default border-slate-300"
                  >
                    {option}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {/* Show explanation when answer is revealed */}
          {progress.stage === "AWAITING_CORRECTNESS" && (
            <>
              <div className="p-4 bg-orange-50 rounded-lg">
                <p className="text-lg font-medium text-orange-900 mb-2">
                  Answer: <span className="font-bold">{currentCard.answer}</span>
                </p>
                {currentCard.explanation && (
                  <p className="text-slate-700 text-sm">
                    {currentCard.explanation}
                  </p>
                )}
              </div>
              
              {/* Show bound vocabulary word if available */}
              {(currentCard as { boundVocabularyCard?: { englishWord: string } }).boundVocabularyCard && (
                <div className="flex items-center justify-center space-x-2 text-sm text-slate-600">
                  <BookOpen className="h-4 w-4 text-blue-600" />
                  <span>Related vocabulary: </span>
                  <span className="font-medium text-blue-700">
                    {(currentCard as { boundVocabularyCard: { englishWord: string } }).boundVocabularyCard.englishWord}
                  </span>
                </div>
              )}
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
            className="w-full h-12 text-lg bg-orange-600 hover:bg-orange-700"
          >
            {isLoading ? "Loading..." : "Reveal Answer"}
          </Button>
        )}

        {progress.stage === "AWAITING_CORRECTNESS" && (
          <div className="grid grid-cols-2 gap-4">
            <Button
              onClick={() => onSubmitRating({ isCorrect: false })}
              disabled={isLoading}
              variant="outline"
              className="h-16 flex flex-col items-center justify-center gap-1 border-red-200 hover:bg-red-50"
            >
              <XCircle className="h-5 w-5 text-red-600" />
              <span className="font-medium text-sm">Incorrect</span>
              <span className="text-xs text-slate-500">I got it wrong</span>
            </Button>
            <Button
              onClick={() => onSubmitRating({ isCorrect: true })}
              disabled={isLoading}
              variant="outline"
              className="h-16 flex flex-col items-center justify-center gap-1 border-green-200 hover:bg-green-50"
            >
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="font-medium text-sm">Correct</span>
              <span className="text-xs text-slate-500">I got it right</span>
            </Button>
          </div>
        )}
      </div>

      {/* Progress indicator */}
      <div className="text-center text-sm text-slate-500">
        Card {progress.payload.initialCardIds.length - progress.payload.queue.length + 1} of{" "}
        {progress.payload.initialCardIds.length}
      </div>
    </>
  )
}