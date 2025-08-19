"use client"

import { use } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useFillInTheBlankDeck } from "@/hooks/api/content"
import { PencilLine, BookOpen, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { FillInTheBlankCardManager } from "@/components/FillInTheBlankCardManager"

interface PageProps {
  params: Promise<{ deckId: string }>
}

export default function FillInTheBlankDeckManagePage({ params }: PageProps) {
  const { deckId } = use(params)
  const { deck, isLoading, isError } = useFillInTheBlankDeck(deckId)

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-64 bg-slate-200 rounded animate-pulse" />
            <div className="h-5 w-96 bg-slate-200 rounded animate-pulse" />
          </div>
        </div>

        {/* Stats skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-200 rounded-lg animate-pulse" />
          ))}
        </div>

        {/* Content skeleton */}
        <div className="h-96 bg-slate-200 rounded-lg animate-pulse" />
      </div>
    )
  }

  if (isError || !deck) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <PencilLine className="h-12 w-12 text-slate-300 mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Deck Not Found</h2>
        <p className="text-slate-600 mb-6">The fill-in-the-blank deck you're looking for doesn't exist or has been deleted.</p>
        <Link href="/fill-in-the-blanks">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Decks
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center space-x-3">
            <Link href="/fill-in-the-blanks">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Decks
              </Button>
            </Link>
            <div className="h-6 w-px bg-slate-300" />
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-orange-100 rounded-lg">
                <PencilLine className="h-5 w-5 text-orange-600" />
              </div>
              <h1 className="text-3xl font-bold text-slate-900">{deck.name}</h1>
            </div>
          </div>
          {deck.description && (
            <p className="text-slate-600 ml-20">{deck.description}</p>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <PencilLine className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">Total Cards</p>
                <p className="text-2xl font-bold text-slate-900">{deck._count?.cards || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">Vocabulary Binding</p>
                <p className="text-xl font-bold text-slate-900">
                  {deck.boundVocabularyDeck ? deck.boundVocabularyDeck.name : "Not bound"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              {deck.isPublic ? (
                <>
                  <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-600">Visibility</p>
                    <Badge variant="default">Public</Badge>
                  </div>
                </>
              ) : (
                <>
                  <div className="h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-600">Visibility</p>
                    <Badge variant="secondary">Private</Badge>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Card Manager */}
      <FillInTheBlankCardManager deckId={deckId} deck={deck} />
    </div>
  )
}