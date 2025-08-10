"use client"

import { useState } from "react"
import { usePublicDecks, forkDeck } from "@/hooks/api/content"
import { useToast } from "@/hooks/use-toast"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Copy,
  Eye,
  BookOpen,
  Search,
  Globe,
  AlertTriangle,
} from "lucide-react"
import type { VocabularyDeck } from "@prisma/client"

type DeckWithCount = VocabularyDeck & {
  _count?: {
    cards: number
  }
}

interface PublicDeckLibraryProps {
  onDeckImported?: (deck: VocabularyDeck) => void
}

export function PublicDeckLibrary({ onDeckImported }: PublicDeckLibraryProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedDeck, setSelectedDeck] = useState<DeckWithCount | null>(null)
  const [isDeckDetailOpen, setIsDeckDetailOpen] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  const { toast } = useToast()
  const { publicDecks, isLoading, isError } = usePublicDecks()

  const filteredDecks = publicDecks.filter((deck) =>
    deck.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (deck.description?.toLowerCase() || "").includes(searchTerm.toLowerCase())
  )

  const handleViewDeck = (deck: DeckWithCount) => {
    setSelectedDeck(deck)
    setIsDeckDetailOpen(true)
  }

  const handleImportDeck = async (deck: DeckWithCount) => {
    setIsImporting(true)
    try {
      const response = await forkDeck(deck.id)
      toast({
        title: "Deck imported successfully",
        description: `"${deck.name}" has been added to your collection.`,
      })
      if (response.data) {
        onDeckImported?.(response.data)
      }
      setIsDeckDetailOpen(false)
    } catch (error) {
      toast({
        title: "Import failed",
        description: "Failed to import deck. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsImporting(false)
    }
  }

  const DeckCard = ({ deck }: { deck: DeckWithCount }) => (
    <Card className="hover:shadow-lg transition-shadow group flex flex-col">
      <CardContent className="p-4 flex-grow">
        <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors mb-2">
          {deck.name}
        </h3>
        <p className="text-sm text-slate-600 line-clamp-3 mb-4 flex-grow">
          {deck.description || "No description available."}
        </p>
        <div className="flex items-center text-sm text-slate-500">
          <BookOpen className="h-4 w-4 mr-1" />
          <span>{deck._count?.cards || 0} cards</span>
        </div>
      </CardContent>
      <div className="px-4 py-3 bg-slate-50 border-t flex items-center justify-end space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleViewDeck(deck)}
        >
          <Eye className="h-4 w-4 mr-2" />
          Preview
        </Button>
        <Button
          size="sm"
          onClick={() => handleImportDeck(deck)}
          disabled={isImporting}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Copy className="h-4 w-4 mr-2" />
          Import
        </Button>
      </div>
    </Card>
  )

  const DeckCardSkeleton = () => (
    <Card className="flex flex-col">
      <CardContent className="p-4 flex-grow">
        <Skeleton className="h-5 w-3/4 mb-2" />
        <Skeleton className="h-4 w-full mb-1" />
        <Skeleton className="h-4 w-full mb-1" />
        <Skeleton className="h-4 w-1/2 mb-4" />
        <Skeleton className="h-5 w-1/4" />
      </CardContent>
      <div className="px-4 py-3 bg-slate-50 border-t flex items-center justify-end space-x-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
      </div>
    </Card>
  )

  if (isError) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">Error Loading Decks</h3>
          <p className="text-slate-500">Could not fetch the public deck library. Please try again later.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Public Deck Library</h2>
          <p className="text-slate-600">Discover and import vocabulary decks</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-sm">
            <Globe className="h-4 w-4 mr-1" />
            {publicDecks.length} decks
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search decks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Deck Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => <DeckCardSkeleton key={i} />)}
        </div>
      ) : filteredDecks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDecks.map((deck) => (
            <DeckCard key={deck.id} deck={deck} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <Search className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No decks found</h3>
            <p className="text-slate-500">Try adjusting your search term to find more decks.</p>
          </CardContent>
        </Card>
      )}

      {/* Deck Detail Dialog */}
      <Dialog open={isDeckDetailOpen} onOpenChange={setIsDeckDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedDeck?.name}</DialogTitle>
          </DialogHeader>
          {selectedDeck && (
            <div className="space-y-4 py-4">
              <p className="text-slate-600">{selectedDeck.description || "No description available."}</p>
              <div className="p-4 bg-slate-50 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-slate-600">
                    <BookOpen className="h-4 w-4" />
                    <span>Total Cards</span>
                  </div>
                  <span className="font-bold text-slate-900">{selectedDeck._count?.cards || 0}</span>
                </div>
              </div>
              <div className="pt-4 flex justify-end">
                <Button
                  onClick={() => handleImportDeck(selectedDeck)}
                  disabled={isImporting}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {isImporting ? "Importing..." : "Import Deck"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

