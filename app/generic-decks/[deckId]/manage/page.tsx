"use client"

import React from "react"
import { GenericCardManager } from "@/components/generic-card-manager"
import { useGenericDeck } from "@/hooks/api"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface PageProps {
  params: Promise<{ deckId: string }>
}

export default function ManageGenericDeckPage({ params }: PageProps) {
  const [deckId, setDeckId] = React.useState<string>("")

  React.useEffect(() => {
    params.then(({ deckId }) => setDeckId(deckId))
  }, [params])

  const { deck, isLoading, isError, error } = useGenericDeck(deckId)

  if (isError) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <Link href="/generic-decks">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Generic Decks
            </Button>
          </Link>
        </div>
        <Card>
          <CardContent className="p-6">
            <Alert>
              <AlertDescription>
                Failed to load deck. {error?.message || "Please try again."}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading || !deck) {
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
          <Link href="/generic-decks">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Generic Decks
            </Button>
          </Link>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-teal-100 rounded-lg">
              <Layers className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{deck.name}</h1>
              {deck.description && (
                <p className="text-slate-600">{deck.description}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Card Manager Component */}
      <GenericCardManager
        deckId={deckId}
        deckName={deck.name}
        isReadOnly={false}
      />
    </div>
  )
}