"use client"

import React from "react"
import { FillInBlankCardManager } from "@/components/fill-in-blank-card-manager"
import { useFillInBlankExercise } from "@/hooks/api"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Edit3, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

interface PageProps {
  params: Promise<{ exerciseId: string }>
}

export default function ManageFillInBlankExercisePage({ params }: PageProps) {
  const [exerciseId, setExerciseId] = React.useState<string>("")

  React.useEffect(() => {
    params.then(({ exerciseId }) => setExerciseId(exerciseId))
  }, [params])

  const { exercise, isLoading, isError, error } = useFillInBlankExercise(exerciseId)

  if (isError) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <Link href="/fill-in-blank">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Fill-in-Blank Exercises
            </Button>
          </Link>
        </div>
        <Card>
          <CardContent className="p-6">
            <Alert>
              <AlertDescription>
                Failed to load exercise. {error?.message || "Please try again."}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading || !exercise) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex space-x-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/fill-in-blank">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Exercises
            </Button>
          </Link>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Edit3 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{exercise.title}</h1>
              <div className="flex items-center space-x-4 mt-1">
                {exercise.explanation && (
                  <p className="text-slate-600">{exercise.explanation}</p>
                )}
                <div className="flex items-center space-x-2">
                  <BookOpen className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-slate-500">
                    Bound to: {exercise.vocabularyDeck?.name}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {exercise.vocabularyDeck?._count?.cards || 0} cards
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {exercise.isPublic ? (
            <Badge variant="default">Public</Badge>
          ) : (
            <Badge variant="secondary">Private</Badge>
          )}
          {exercise.unitItem && (
            <Badge variant="outline">Used in Unit</Badge>
          )}
        </div>
      </div>

      {/* Fill-in-Blank Card Manager Component */}
      <FillInBlankCardManager
        exerciseId={exerciseId}
        exerciseTitle={exercise.title}
        vocabularyDeck={exercise.vocabularyDeck}
        isReadOnly={false}
      />
    </div>
  )
}