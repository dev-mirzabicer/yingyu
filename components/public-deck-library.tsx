"use client"

import { useState } from "react"
import { usePublicDecks, usePublicGenericDecks, forkDeck, forkGenericDeck } from "@/hooks/api/content"
import { useToast } from "@/hooks/use-toast"
import {
  Card,
  CardContent,
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Copy,
  Eye,
  BookOpen,
  Search,
  Globe,
  AlertTriangle,
  Layers,
} from "lucide-react"
import type { VocabularyDeck, GenericDeck } from "@prisma/client"

type VocabularyDeckWithCount = VocabularyDeck & {
  _count?: {
    cards: number
  }
}

type GenericDeckWithCount = GenericDeck & {
  _count?: {
    cards: number
  }
}

type DeckWithCount = VocabularyDeckWithCount | GenericDeckWithCount

interface PublicDeckLibraryProps {
  onDeckImported?: (deck: VocabularyDeck | GenericDeck) => void
}

export function PublicDeckLibrary({ onDeckImported }: PublicDeckLibraryProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedDeck, setSelectedDeck] = useState<DeckWithCount | null>(null)
  const [isDeckDetailOpen, setIsDeckDetailOpen] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [activeTab, setActiveTab] = useState<"vocabulary" | "generic">("vocabulary")

  const { toast } = useToast()
  const { publicDecks, isLoading: isLoadingVocab, isError: isErrorVocab } = usePublicDecks()
  const { publicDecks: publicGenericDecks, isLoading: isLoadingGeneric, isError: isErrorGeneric } = usePublicGenericDecks()

  const currentDecks = activeTab === "vocabulary" ? publicDecks : publicGenericDecks
  const filteredDecks = currentDecks.filter((deck: DeckWithCount) =>
    deck.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (deck.description?.toLowerCase() || "").includes(searchTerm.toLowerCase())
  )

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _isLoading = activeTab === "vocabulary" ? isLoadingVocab : isLoadingGeneric
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _isError = activeTab === "vocabulary" ? isErrorVocab : isErrorGeneric

  const handleViewDeck = (deck: DeckWithCount) => {
    setSelectedDeck(deck)
    setIsDeckDetailOpen(true)
  }

  const handleImportDeck = async (deck: DeckWithCount) => {
    setIsImporting(true)
    try {
      const isGenericDeck = 'front' in deck // Generic decks have 'front' field, vocabulary decks have 'english'
      const response = isGenericDeck 
        ? await forkGenericDeck(deck.id)
        : await forkDeck(deck.id)
      
      toast({
        title: "Deck imported successfully",
        description: `"${deck.name}" has been added to your collection.`,
      })
      if (response.data) {
        onDeckImported?.(response.data)
      }
      setIsDeckDetailOpen(false)
    } catch (error) {
      console.error("Failed to import deck:", error)
      toast({
        title: "Import failed",
        description: "Failed to import deck. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsImporting(false)
    }
  }

  const DeckCard = ({ deck }: { deck: DeckWithCount }) => {
    const isGenericDeck = 'front' in deck
    const IconComponent = isGenericDeck ? Layers : BookOpen
    const colorClass = isGenericDeck ? "group-hover:text-teal-600" : "group-hover:text-blue-600"
    
    return (
      <Card className="hover:shadow-lg transition-shadow group flex flex-col">
        <CardContent className="p-4 flex-grow">
          <h3 className={`font-semibold text-slate-900 ${colorClass} transition-colors mb-2`}>
            {deck.name}
          </h3>
          <p className="text-sm text-slate-600 line-clamp-3 mb-4 flex-grow">
            {deck.description || "No description available."}
          </p>
          <div className="flex items-center text-sm text-slate-500">
            <IconComponent className="h-4 w-4 mr-1" />
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
            className={isGenericDeck ? "bg-teal-600 hover:bg-teal-700" : "bg-blue-600 hover:bg-blue-700"}
          >
            <Copy className="h-4 w-4 mr-2" />
            Import
          </Button>
        </div>
      </Card>
    )
  }

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


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Public Deck Library</h2>
          <p className="text-slate-600">Discover and import decks from the community</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-sm">
            <Globe className="h-4 w-4 mr-1" />
            {activeTab === "vocabulary" ? publicDecks.length : publicGenericDecks.length} decks
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "vocabulary" | "generic")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="vocabulary" className="flex items-center space-x-2">
            <BookOpen className="h-4 w-4" />
            <span>Vocabulary Decks</span>
          </TabsTrigger>
          <TabsTrigger value="generic" className="flex items-center space-x-2">
            <Layers className="h-4 w-4" />
            <span>Generic Decks</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vocabulary" className="mt-6">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search vocabulary decks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Vocabulary Deck Grid */}
          {isLoadingVocab ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => <DeckCardSkeleton key={i} />)}
            </div>
          ) : isErrorVocab ? (
            <Card>
              <CardContent className="p-6 text-center">
                <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">Error Loading Vocabulary Decks</h3>
                <p className="text-slate-500">Could not fetch the vocabulary decks. Please try again later.</p>
              </CardContent>
            </Card>
          ) : filteredDecks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDecks.map((deck: DeckWithCount) => (
                <DeckCard key={deck.id} deck={deck} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Search className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No vocabulary decks found</h3>
                <p className="text-slate-500">Try adjusting your search term to find more decks.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="generic" className="mt-6">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search generic decks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Generic Deck Grid */}
          {isLoadingGeneric ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => <DeckCardSkeleton key={i} />)}
            </div>
          ) : isErrorGeneric ? (
            <Card>
              <CardContent className="p-6 text-center">
                <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">Error Loading Generic Decks</h3>
                <p className="text-slate-500">Could not fetch the generic decks. Please try again later.</p>
              </CardContent>
            </Card>
          ) : filteredDecks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDecks.map((deck: DeckWithCount) => (
                <DeckCard key={deck.id} deck={deck} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Search className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No generic decks found</h3>
                <p className="text-slate-500">Try adjusting your search term to find more decks.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Deck Detail Dialog */}
      <Dialog open={isDeckDetailOpen} onOpenChange={setIsDeckDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedDeck?.name}</DialogTitle>
          </DialogHeader>
          {selectedDeck && (() => {
            const isGenericDeck = 'front' in selectedDeck
            const IconComponent = isGenericDeck ? Layers : BookOpen
            const buttonClass = isGenericDeck ? "bg-teal-600 hover:bg-teal-700" : "bg-blue-600 hover:bg-blue-700"
            
            return (
              <div className="space-y-4 py-4">
                <p className="text-slate-600">{selectedDeck.description || "No description available."}</p>
                <div className="p-4 bg-slate-50 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-slate-600">
                      <IconComponent className="h-4 w-4" />
                      <span>Total Cards</span>
                    </div>
                    <span className="font-bold text-slate-900">{selectedDeck._count?.cards || 0}</span>
                  </div>
                </div>
                <div className="pt-4 flex justify-end">
                  <Button
                    onClick={() => handleImportDeck(selectedDeck)}
                    disabled={isImporting}
                    className={buttonClass}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    {isImporting ? "Importing..." : "Import Deck"}
                  </Button>
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}

