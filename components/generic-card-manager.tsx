"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Plus,
  Edit,
  Trash2,
  MoreHorizontal,
  Search,
  Upload,
  Download,
  Copy,
  Eye,
  EyeOff,
  Link as LinkIcon,
  Layers,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { 
  useGenericDeckCards, 
  addCardToGenericDeck, 
  updateGenericCard, 
  deleteGenericCard,
  autoBindGenericDeck,
  resolveGenericBinding,
  useGenericDeck,
} from "@/hooks/api/content"
import { useDecks } from "@/hooks/api/content"
import type { GenericCard } from "@prisma/client"
import { DataTable } from "@/components/data-table"
import { BulkImportTools } from "@/components/bulk-import-tools"
import { ExampleSentenceEditor, type ExampleSentence } from "@/components/example-sentence-editor"
import Papa from "papaparse"
import { saveAs } from "file-saver"

interface GenericCardManagerProps {
  deckId: string
  deckName: string
  isReadOnly?: boolean
}

interface CardFormData {
  front: string
  back: string
  exampleSentences: ExampleSentence[]
}

interface AutoBindResults {
  automaticMatches: Array<{
    genericCard: { id: string; front: string }
    vocabularyCard: { id: string; englishWord: string }
  }>
  ambiguities: Array<{
    genericCard: { id: string; front: string }
    possibleMatches: Array<{
      id: string
      englishWord: string
    }>
  }>
  noMatches: Array<{ id: string; front: string }>
}

const initialFormData: CardFormData = {
  front: "",
  back: "",
  exampleSentences: [],
}

export function GenericCardManager({ deckId, deckName, isReadOnly = false }: GenericCardManagerProps) {
  const { cards, isLoading, isError, mutate, error } = useGenericDeckCards(deckId)
  const { deck } = useGenericDeck(deckId)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { decks: _decks } = useDecks()
  const [isAddCardOpen, setIsAddCardOpen] = useState(false)
  const [isEditCardOpen, setIsEditCardOpen] = useState(false)
  const [editingCard, setEditingCard] = useState<GenericCard | null>(null)
  const [formData, setFormData] = useState<CardFormData>(initialFormData)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [showAdvancedFields, setShowAdvancedFields] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isBindingDialogOpen, setIsBindingDialogOpen] = useState(false)
  const [bindingResults, setBindingResults] = useState<AutoBindResults | null>(null)
  const [isBinding, setIsBinding] = useState(false)
  const [resolutions, setResolutions] = useState<{ [key: string]: string | null }>({})

  const { toast } = useToast()

  const handleExport = () => {
    if (!cards || cards.length === 0) {
      toast({
        title: "No cards to export",
        description: "Add some cards to the deck before exporting.",
        variant: "destructive",
      });
      return;
    }
    const csv = Papa.unparse(cards);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `${deckName}-cards.csv`);
  };

  // Filter cards based on search
  const filteredCards = cards.filter((card) => {
    const matchesSearch =
      card.front.toLowerCase().includes(searchTerm.toLowerCase()) ||
      card.back.toLowerCase().includes(searchTerm.toLowerCase())

    return matchesSearch
  })

  const handleAddCard = async () => {
    if (!formData.front || !formData.back) {
      toast({
        title: "Error",
        description: "Front and back are required.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const cardData = {
        ...formData,
        exampleSentences: formData.exampleSentences.filter(s => s.english && s.chinese),
      }

      await addCardToGenericDeck(deckId, cardData)

      toast({
        title: "Card added successfully",
        description: `"${formData.front}" has been added to the deck.`,
      })

      setFormData(initialFormData)
      setIsAddCardOpen(false)
      mutate()
    } catch (error) {
      console.error("Failed to add card:", error)
      toast({
        title: "Error",
        description: "Failed to add card. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditCard = async () => {
    if (!editingCard || !formData.front || !formData.back) {
      toast({
        title: "Error",
        description: "Front and back are required.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const cardData = {
        ...formData,
        exampleSentences: formData.exampleSentences.filter(s => s.english && s.chinese),
      }

      await updateGenericCard(deckId, editingCard.id, cardData)

      toast({
        title: "Card updated successfully",
        description: `"${formData.front}" has been updated.`,
      })

      setFormData(initialFormData)
      setIsEditCardOpen(false)
      setEditingCard(null)
      mutate()
    } catch (error) {
      console.error("Failed to update card:", error)
      toast({
        title: "Error",
        description: "Failed to update card. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteCard = async (card: GenericCard) => {
    if (!confirm(`Are you sure you want to delete "${card.front}"?`)) {
      return
    }

    try {
      await deleteGenericCard(deckId, card.id)
      toast({
        title: "Card deleted",
        description: `"${card.front}" has been removed from the deck.`,
      })
      mutate()
    } catch (error) {
      console.error("Failed to delete card:", error)
      toast({
        title: "Error",
        description: "Failed to delete card. Please try again.",
        variant: "destructive",
      })
    }
  }

  const openEditDialog = (card: GenericCard) => {
    setEditingCard(card)
    
    let sentences: ExampleSentence[] = [];
    if (card.exampleSentences) {
      try {
        // Handles both stringified JSON and actual JSON objects
        const parsed = typeof card.exampleSentences === 'string' 
          ? JSON.parse(card.exampleSentences) 
          : card.exampleSentences;
        if (Array.isArray(parsed)) {
          sentences = parsed;
        }
      } catch (e) {
        console.error("Failed to parse example sentences:", e);
        // Keep sentences as empty array if parsing fails
      }
    }

    setFormData({
      front: card.front,
      back: card.back,
      exampleSentences: sentences,
    })
    setIsEditCardOpen(true)
  }

  const handleAutoBinding = async () => {
    if (!deck?.boundVocabularyDeckId) {
      toast({
        title: "No vocabulary deck bound",
        description: "This deck is not bound to a vocabulary deck.",
        variant: "destructive",
      })
      return
    }

    setIsBinding(true)
    try {
      const results = await autoBindGenericDeck(deckId)
      setBindingResults(results)
      
      // Initialize resolutions for ambiguous cards
      const initialResolutions: { [key: string]: string | null } = {}
      results.ambiguities?.forEach((ambiguity: { genericCard: { id: string } }) => {
        initialResolutions[ambiguity.genericCard.id] = null
      })
      setResolutions(initialResolutions)
      
      setIsBindingDialogOpen(true)
      
      if (results.matchCount > 0) {
        toast({
          title: "Auto-binding completed",
          description: `${results.matchCount} cards were automatically bound.`,
        })
      }
    } catch (error) {
      console.error("Failed to auto-bind cards:", error)
      toast({
        title: "Error",
        description: "Failed to auto-bind cards. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsBinding(false)
    }
  }

  const handleResolveBindings = async () => {
    if (!bindingResults) return

    setIsSubmitting(true)
    try {
      const resolutionArray = Object.entries(resolutions).map(([cardId, vocabularyCardId]) => ({
        genericCardId: cardId,
        vocabularyCardId: vocabularyCardId === "none" ? null : vocabularyCardId,
      }))

      await resolveGenericBinding(deckId, resolutionArray)
      
      toast({
        title: "Bindings resolved",
        description: "Card bindings have been updated successfully.",
      })
      
      setIsBindingDialogOpen(false)
      setBindingResults(null)
      setResolutions({})
      mutate()
    } catch (error) {
      console.error("Failed to resolve bindings:", error)
      toast({
        title: "Error",
        description: "Failed to resolve bindings. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const cardColumns = [
    {
      key: "front",
      header: "Front",
      render: (value: unknown, row: GenericCard & { boundVocabularyCard?: { englishWord: string } | null }) => {
        const frontValue = String(value);
        return (
          <div className="space-y-1">
            <div className="font-medium text-slate-900">{frontValue}</div>
            {row.boundVocabularyCard && (
              <Badge variant="outline" className="text-xs">
                Bound to: {row.boundVocabularyCard.englishWord}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      key: "back",
      header: "Back",
      render: (value: unknown) => {
        const backValue = String(value);
        return (
          <div className="text-slate-900">{backValue}</div>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      render: (_: unknown, row: GenericCard) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEditDialog(row)} disabled={isReadOnly}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Card
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(JSON.stringify(row, null, 2))}>
              <Copy className="mr-2 h-4 w-4" />
              Copy Data
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDeleteCard(row)} className="text-red-600" disabled={isReadOnly}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Card
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  if (isError) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert>
            <AlertDescription>Failed to load generic cards. {error?.message}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h2 className="text-xl font-semibold text-slate-900">Cards</h2>
          <Badge variant="outline">{cards.length} total</Badge>
        </div>
        <div className="flex items-center space-x-2">
          {deck?.boundVocabularyDeckId && (
            <Button
              variant="outline"
              onClick={handleAutoBinding}
              disabled={isBinding}
            >
              <LinkIcon className="h-4 w-4 mr-2" />
              {isBinding ? "Auto-binding..." : "Auto-bind Vocabulary"}
            </Button>
          )}
          <Button variant="outline" onClick={handleExport} disabled={cards.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" onClick={() => setIsImporting(true)} disabled={isReadOnly}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button onClick={() => setIsAddCardOpen(true)} disabled={isReadOnly} className="bg-teal-600 hover:bg-teal-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Card
          </Button>
        </div>
      </div>

      {/* Search and filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search cards..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Badge variant="outline" className="text-sm">
              {filteredCards.length} of {cards.length} cards
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Cards table */}
      <Card>
        <CardContent className="p-6">
          {isLoading ? (
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
          ) : filteredCards.length === 0 ? (
            <div className="text-center py-12">
              <Layers className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-4">
                {searchTerm ? "No cards match your search" : "No cards in this deck yet"}
              </p>
              {!searchTerm && !isReadOnly && (
                <Button onClick={() => setIsAddCardOpen(true)} className="bg-teal-600 hover:bg-teal-700">
                  Add Your First Card
                </Button>
              )}
            </div>
          ) : (
            <DataTable data={filteredCards} columns={cardColumns} pageSize={20} />
          )}
        </CardContent>
      </Card>

      {/* Binding Results Dialog */}
      <Dialog open={isBindingDialogOpen} onOpenChange={setIsBindingDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Auto-binding Results</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            {bindingResults && (
              <div className="space-y-6">
                {/* Success summary */}
                <div className="p-4 bg-green-50 rounded-lg">
                  <h3 className="font-medium text-green-900 mb-2">Successfully Bound</h3>
                  <p className="text-green-700">{bindingResults.automaticMatches.length} cards were automatically bound to vocabulary cards.</p>
                </div>

                {/* Ambiguities to resolve */}
                {bindingResults.ambiguities && bindingResults.ambiguities.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="font-medium text-slate-900">Resolve Ambiguities</h3>
                    <p className="text-sm text-slate-600">These cards match multiple vocabulary words. Please select the correct binding:</p>
                    {bindingResults.ambiguities.map((ambiguity) => (
                      <div key={ambiguity.genericCard.id} className="p-4 border rounded-lg">
                        <div className="mb-3">
                          <span className="font-medium">Card: </span>
                          <span className="text-slate-700">{ambiguity.genericCard.front}</span>
                        </div>
                        <div className="space-y-2">
                          <Label>Choose vocabulary word to bind to:</Label>
                          <Select
                            value={resolutions[ambiguity.genericCard.id] || ""}
                            onValueChange={(value) => setResolutions(prev => ({ ...prev, [ambiguity.genericCard.id]: value || null }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select vocabulary word..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No binding</SelectItem>
                              {ambiguity.possibleMatches.map((match: { id: string; englishWord: string }) => (
                                <SelectItem key={match.id} value={match.id}>
                                  {match.englishWord}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* No matches */}
                {bindingResults.noMatches && bindingResults.noMatches.length > 0 && (
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <h3 className="font-medium text-yellow-900 mb-2">No Matches Found</h3>
                    <p className="text-yellow-700 mb-3">{bindingResults.noMatches.length} cards could not be automatically bound:</p>
                    <div className="space-y-1">
                      {bindingResults.noMatches.slice(0, 5).map((noMatch) => (
                        <div key={noMatch.id} className="text-sm text-yellow-700">
                          • {noMatch.front}
                        </div>
                      ))}
                      {bindingResults.noMatches.length > 5 && (
                        <div className="text-sm text-yellow-700">
                          • ... and {bindingResults.noMatches.length - 5} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setIsBindingDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleResolveBindings}
              disabled={isSubmitting}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {isSubmitting ? "Saving..." : "Save Bindings"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={isImporting} onOpenChange={setIsImporting}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Import Generic Cards to &quot;{deckName}&quot;</DialogTitle>
          </DialogHeader>
          <BulkImportTools
            deckId={deckId}
            type="generic-deck"
            onComplete={() => {
              mutate();
              setIsImporting(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Add Card Dialog */}
      <Dialog open={isAddCardOpen} onOpenChange={setIsAddCardOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Add New Generic Card</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-4">
              {/* Basic Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="front">Front *</Label>
                  <Input
                    id="front"
                    value={formData.front}
                    onChange={(e) => setFormData((prev) => ({ ...prev, front: e.target.value }))}
                    placeholder="Enter front text"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="back">Back *</Label>
                  <Input
                    id="back"
                    value={formData.back}
                    onChange={(e) => setFormData((prev) => ({ ...prev, back: e.target.value }))}
                    placeholder="Enter back text"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Advanced Fields Toggle */}
              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowAdvancedFields(!showAdvancedFields)}
                  className="p-0 h-auto"
                >
                  {showAdvancedFields ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                  {showAdvancedFields ? "Hide" : "Show"} Advanced Fields
                </Button>
              </div>

              {showAdvancedFields && (
                <>
                  <Separator />

                  <div className="space-y-2">
                    <ExampleSentenceEditor
                      value={formData.exampleSentences}
                      onChange={(sentences) => setFormData((prev) => ({ ...prev, exampleSentences: sentences }))}
                      disabled={isSubmitting}
                    />
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setIsAddCardOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleAddCard} disabled={isSubmitting} className="bg-teal-600 hover:bg-teal-700">
              {isSubmitting ? "Adding..." : "Add Card"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Card Dialog */}
      <Dialog open={isEditCardOpen} onOpenChange={setIsEditCardOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Edit Generic Card</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-4">
              {/* Basic Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-front">Front *</Label>
                  <Input
                    id="edit-front"
                    value={formData.front}
                    onChange={(e) => setFormData((prev) => ({ ...prev, front: e.target.value }))}
                    placeholder="Enter front text"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-back">Back *</Label>
                  <Input
                    id="edit-back"
                    value={formData.back}
                    onChange={(e) => setFormData((prev) => ({ ...prev, back: e.target.value }))}
                    placeholder="Enter back text"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Advanced Fields Toggle */}
              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowAdvancedFields(!showAdvancedFields)}
                  className="p-0 h-auto"
                >
                  {showAdvancedFields ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                  {showAdvancedFields ? "Hide" : "Show"} Advanced Fields
                </Button>
              </div>

              {showAdvancedFields && (
                <>
                  <Separator />

                  <div className="space-y-2">
                    <ExampleSentenceEditor
                      value={formData.exampleSentences}
                      onChange={(sentences) => setFormData((prev) => ({ ...prev, exampleSentences: sentences }))}
                      disabled={isSubmitting}
                    />
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setIsEditCardOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleEditCard} disabled={isSubmitting} className="bg-teal-600 hover:bg-teal-700">
              {isSubmitting ? "Updating..." : "Update Card"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}