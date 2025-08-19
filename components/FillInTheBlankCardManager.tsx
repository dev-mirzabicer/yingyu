"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
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
  BookOpen,
  Shuffle,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { 
  useFillInTheBlankDeckCards, 
  addCardToFillInTheBlankDeck, 
  updateFillInTheBlankCard, 
  deleteFillInTheBlankCard,
  autoBindFillInTheBlankDeck,
  resolveFillInTheBlankBinding,
  useDecks
} from "@/hooks/api/content"
import type { FillInTheBlankCard, FillInTheBlankDeck } from "@prisma/client"
import { DataTable } from "@/components/data-table"
import { BulkImportTools } from "@/components/bulk-import-tools"
import Papa from "papaparse"
import { saveAs } from "file-saver"

interface FillInTheBlankCardManagerProps {
  deckId: string
  deck: FillInTheBlankDeck & { 
    cards: FillInTheBlankCard[]
    boundVocabularyDeck: { id: string; name: string } | null
    _count: { cards: number }
  }
  isReadOnly?: boolean
}

interface CardFormData {
  question: string
  answer: string
  options: string[]
  explanation: string
}

interface AutoBindResults {
  automaticMatches: Array<{
    fillInTheBlankCard: FillInTheBlankCard
    vocabularyCard: { id: string; englishWord: string }
  }>
  ambiguities: Array<{
    fillInTheBlankCard: FillInTheBlankCard
    possibleMatches: Array<{ id: string; englishWord: string }>
  }>
  noMatches: FillInTheBlankCard[]
}

const initialFormData: CardFormData = {
  question: "",
  answer: "",
  options: [],
  explanation: "",
}

export function FillInTheBlankCardManager({ deckId, deck, isReadOnly = false }: FillInTheBlankCardManagerProps) {
  const { cards, isLoading, isError, mutate, error } = useFillInTheBlankDeckCards(deckId)
  const [isAddCardOpen, setIsAddCardOpen] = useState(false)
  const [isEditCardOpen, setIsEditCardOpen] = useState(false)
  const [editingCard, setEditingCard] = useState<FillInTheBlankCard | null>(null)
  const [formData, setFormData] = useState<CardFormData>(initialFormData)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [isImporting, setIsImporting] = useState(false)
  const [optionsInput, setOptionsInput] = useState("") // For comma-separated options input
  
  // Vocabulary binding state
  const [isBindingOpen, setIsBindingOpen] = useState(false)
  const [isBinding, setIsBinding] = useState(false)
  const [bindingResults, setBindingResults] = useState<AutoBindResults | null>(null)
  const [ambiguityResolutions, setAmbiguityResolutions] = useState<Record<string, string>>({})

  const { toast } = useToast()

  const handleExport = () => {
    if (!cards || cards.length === 0) {
      toast({
        title: "No cards to export",
        description: "Add some cards to the deck before exporting.",
        variant: "destructive",
      })
      return
    }
    
    const exportData = cards.map(card => ({
      question: card.question,
      answer: card.answer,
      options: card.options && Array.isArray(card.options) ? (card.options as string[]).join(",") : "",
      explanation: card.explanation || "",
    }))
    
    const csv = Papa.unparse(exportData)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    saveAs(blob, `${deck.name}-fill-in-blank-cards.csv`)
  }

  // Filter cards based on search
  const filteredCards = cards.filter((card) => {
    const matchesSearch =
      card.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      card.answer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (card.explanation && card.explanation.toLowerCase().includes(searchTerm.toLowerCase()))
    return matchesSearch
  })

  const handleAddCard = async () => {
    if (!formData.question || !formData.answer) {
      toast({
        title: "Error",
        description: "Question and answer are required.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const cardData = {
        question: formData.question,
        answer: formData.answer,
        options: formData.options.length > 0 ? formData.options : undefined,
        explanation: formData.explanation || undefined,
      }

      await addCardToFillInTheBlankDeck(deckId, cardData)

      toast({
        title: "Card added successfully",
        description: `Fill-in-the-blank card has been added to the deck.`,
      })

      setFormData(initialFormData)
      setOptionsInput("")
      setIsAddCardOpen(false)
      mutate()
    } catch (error) {
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
    if (!editingCard || !formData.question || !formData.answer) {
      toast({
        title: "Error",
        description: "Question and answer are required.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const cardData = {
        question: formData.question,
        answer: formData.answer,
        options: formData.options.length > 0 ? formData.options : undefined,
        explanation: formData.explanation || undefined,
      }

      await updateFillInTheBlankCard(deckId, editingCard.id, cardData)

      toast({
        title: "Card updated successfully",
        description: `Fill-in-the-blank card has been updated.`,
      })

      setFormData(initialFormData)
      setOptionsInput("")
      setIsEditCardOpen(false)
      setEditingCard(null)
      mutate()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update card. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteCard = async (card: FillInTheBlankCard) => {
    if (!confirm(`Are you sure you want to delete this fill-in-the-blank card?`)) {
      return
    }

    try {
      await deleteFillInTheBlankCard(deckId, card.id)
      toast({
        title: "Card deleted",
        description: `Fill-in-the-blank card has been removed from the deck.`,
      })
      mutate()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete card. Please try again.",
        variant: "destructive",
      })
    }
  }

  const openEditDialog = (card: FillInTheBlankCard) => {
    setEditingCard(card)
    setFormData({
      question: card.question,
      answer: card.answer,
      options: card.options && Array.isArray(card.options) ? (card.options as string[]) : [],
      explanation: card.explanation || "",
    })
    setOptionsInput(card.options && Array.isArray(card.options) ? (card.options as string[]).join(", ") : "")
    setIsEditCardOpen(true)
  }

  const handleOptionsInputChange = (value: string) => {
    setOptionsInput(value)
    const optionsArray = value
      .split(",")
      .map(option => option.trim())
      .filter(option => option.length > 0)
    setFormData(prev => ({ ...prev, options: optionsArray }))
  }

  const handleAutoBinding = async () => {
    if (!deck.boundVocabularyDeckId) {
      toast({
        title: "No vocabulary deck bound",
        description: "This deck must be bound to a vocabulary deck to use auto-binding.",
        variant: "destructive",
      })
      return
    }

    setIsBinding(true)
    try {
      const results = await autoBindFillInTheBlankDeck(deckId)
      setBindingResults(results)
      setAmbiguityResolutions({}) // Reset resolutions
      setIsBindingOpen(true)
    } catch (error) {
      toast({
        title: "Auto-binding failed",
        description: "Failed to perform automatic vocabulary binding. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsBinding(false)
    }
  }

  const handleSaveResolutions = async () => {
    if (!bindingResults) return

    setIsSubmitting(true)
    try {
      const resolutions = bindingResults.ambiguities.map(ambiguity => ({
        fillInTheBlankCardId: ambiguity.fillInTheBlankCard.id,
        vocabularyCardId: ambiguityResolutions[ambiguity.fillInTheBlankCard.id] || null,
      }))

      await resolveFillInTheBlankBinding(deckId, resolutions)
      
      toast({
        title: "Binding resolutions saved",
        description: "Vocabulary bindings have been updated successfully.",
      })

      setIsBindingOpen(false)
      setBindingResults(null)
      mutate() // Refresh cards to show updated bindings
    } catch (error) {
      toast({
        title: "Failed to save resolutions",
        description: "Could not save binding resolutions. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const cardColumns = [
    {
      key: "question",
      header: "Question",
      render: (value: string) => (
        <div className="max-w-md">
          <p className="font-medium text-slate-900 line-clamp-2">{value}</p>
        </div>
      ),
    },
    {
      key: "answer",
      header: "Answer",
      render: (value: string) => (
        <div className="font-mono bg-orange-50 px-2 py-1 rounded text-orange-700 font-medium">
          {value}
        </div>
      ),
    },
    {
      key: "options",
      header: "Options",
      render: (value: string[]) => (
        <div className="flex flex-wrap gap-1 max-w-md">
          {value && value.length > 0 ? (
            value.slice(0, 3).map((option, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {option}
              </Badge>
            ))
          ) : (
            <Badge variant="secondary" className="text-xs">No options</Badge>
          )}
          {value && value.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{value.length - 3}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "explanation",
      header: "Explanation",
      render: (value: string) => (
        <div className="max-w-md">
          <p className="text-sm text-slate-600 line-clamp-2">
            {value || "No explanation"}
          </p>
        </div>
      ),
    },
    {
      key: "boundVocabularyCard",
      header: "Bound Word",
      render: (value: any, row: any) => (
        <div className="flex items-center space-x-2">
          {row.boundVocabularyCard ? (
            <>
              <BookOpen className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-slate-700">
                {row.boundVocabularyCard.englishWord}
              </span>
            </>
          ) : (
            <Badge variant="secondary" className="text-xs">Not bound</Badge>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (_: any, row: FillInTheBlankCard) => (
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
            <AlertDescription>Failed to load fill-in-the-blank cards. {error?.message}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Fill-in-the-Blank Cards</h2>
          <p className="text-slate-600">Manage cards in "{deck.name}"</p>
        </div>
        {!isReadOnly && (
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={() => setIsImporting(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button onClick={() => setIsAddCardOpen(true)} className="bg-orange-600 hover:bg-orange-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Card
            </Button>
          </div>
        )}
      </div>

      {/* Vocabulary Binding Section */}
      {deck.boundVocabularyDeck && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <BookOpen className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium text-slate-900">Vocabulary Binding</h3>
                  <p className="text-sm text-slate-600">
                    Bound to vocabulary deck: <span className="font-medium">{deck.boundVocabularyDeck.name}</span>
                  </p>
                </div>
              </div>
              {!isReadOnly && (
                <Button 
                  onClick={handleAutoBinding} 
                  disabled={isBinding}
                  variant="outline"
                  className="border-blue-300 text-blue-700 hover:bg-blue-100"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  {isBinding ? "Auto-binding..." : "Auto-bind Vocabulary"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
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

      {/* Cards Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : filteredCards.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-slate-400 mb-4">
                {searchTerm ? "No cards match your search" : "No cards in this deck yet"}
              </div>
              {!isReadOnly && !searchTerm && (
                <Button onClick={() => setIsAddCardOpen(true)} className="bg-orange-600 hover:bg-orange-700">
                  Add Your First Card
                </Button>
              )}
            </div>
          ) : (
            <DataTable data={filteredCards} columns={cardColumns} pageSize={20} />
          )}
        </CardContent>
      </Card>

      {/* Import Dialog */}
      <Dialog open={isImporting} onOpenChange={setIsImporting}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Import Fill-in-the-Blank Cards to "{deck.name}"</DialogTitle>
          </DialogHeader>
          <BulkImportTools
            type="fill-in-the-blank"
            deckId={deckId}
            onComplete={() => {
              mutate()
              setIsImporting(false)
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Auto-Binding Results Dialog */}
      <Dialog open={isBindingOpen} onOpenChange={setIsBindingOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Vocabulary Binding Results</DialogTitle>
            <DialogDescription>
              Review the automatic vocabulary matching results and resolve any ambiguities.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            {bindingResults && (
              <div className="space-y-6">
                {/* Automatic Matches */}
                {bindingResults.automaticMatches.length > 0 && (
                  <div>
                    <div className="flex items-center space-x-2 mb-3">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <h3 className="font-medium text-green-700">
                        Automatic Matches ({bindingResults.automaticMatches.length})
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {bindingResults.automaticMatches.map((match, index) => (
                        <div key={index} className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-900">
                              {match.fillInTheBlankCard.answer}
                            </p>
                            <p className="text-xs text-slate-500 line-clamp-1">
                              {match.fillInTheBlankCard.question}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-green-700">
                              → {match.vocabularyCard.englishWord}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ambiguities */}
                {bindingResults.ambiguities.length > 0 && (
                  <div>
                    <div className="flex items-center space-x-2 mb-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                      <h3 className="font-medium text-amber-700">
                        Ambiguities ({bindingResults.ambiguities.length})
                      </h3>
                    </div>
                    <div className="space-y-3">
                      {bindingResults.ambiguities.map((ambiguity, index) => (
                        <div key={index} className="p-3 bg-amber-50 rounded-lg">
                          <div className="mb-2">
                            <p className="text-sm font-medium text-slate-900">
                              {ambiguity.fillInTheBlankCard.answer}
                            </p>
                            <p className="text-xs text-slate-500 line-clamp-1">
                              {ambiguity.fillInTheBlankCard.question}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs text-slate-600">Choose vocabulary match:</Label>
                            <Select
                              value={ambiguityResolutions[ambiguity.fillInTheBlankCard.id] || ""}
                              onValueChange={(value) => 
                                setAmbiguityResolutions(prev => ({
                                  ...prev,
                                  [ambiguity.fillInTheBlankCard.id]: value
                                }))
                              }
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Select match..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">Do not bind</SelectItem>
                                {ambiguity.possibleMatches.map((match) => (
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
                  </div>
                )}

                {/* No Matches */}
                {bindingResults.noMatches.length > 0 && (
                  <div>
                    <div className="flex items-center space-x-2 mb-3">
                      <XCircle className="h-5 w-5 text-slate-500" />
                      <h3 className="font-medium text-slate-700">
                        No Matches Found ({bindingResults.noMatches.length})
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {bindingResults.noMatches.map((card, index) => (
                        <div key={index} className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-700">
                              {card.answer}
                            </p>
                            <p className="text-xs text-slate-500 line-clamp-1">
                              {card.question}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsBindingOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveResolutions} 
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? "Saving..." : "Save Resolutions"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Card Dialog */}
      <Dialog open={isAddCardOpen} onOpenChange={setIsAddCardOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Add New Fill-in-the-Blank Card</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="question">Question *</Label>
                <Textarea
                  id="question"
                  value={formData.question}
                  onChange={(e) => setFormData(prev => ({ ...prev, question: e.target.value }))}
                  placeholder="Enter the question with blank (e.g., 'The cat ___ on the mat.')"
                  disabled={isSubmitting}
                  rows={3}
                />
                <p className="text-xs text-slate-500">
                  Use underscores (___) or words like "BLANK" to indicate where the answer should go.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="answer">Answer *</Label>
                <Input
                  id="answer"
                  value={formData.answer}
                  onChange={(e) => setFormData(prev => ({ ...prev, answer: e.target.value }))}
                  placeholder="Enter the correct answer"
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="options">Multiple Choice Options (Optional)</Label>
                <Input
                  id="options"
                  value={optionsInput}
                  onChange={(e) => handleOptionsInputChange(e.target.value)}
                  placeholder="Enter options separated by commas (e.g., sits, runs, jumps, sleeps)"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-slate-500">
                  Leave empty for open-ended questions, or provide comma-separated options for multiple choice.
                </p>
                {formData.options.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {formData.options.map((option, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {option}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="explanation">Explanation (Optional)</Label>
                <Textarea
                  id="explanation"
                  value={formData.explanation}
                  onChange={(e) => setFormData(prev => ({ ...prev, explanation: e.target.value }))}
                  placeholder="Explain why this is the correct answer or provide additional context"
                  disabled={isSubmitting}
                  rows={3}
                />
              </div>
            </div>
          </ScrollArea>

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsAddCardOpen(false)
                setFormData(initialFormData)
                setOptionsInput("")
              }} 
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleAddCard} disabled={isSubmitting} className="bg-orange-600 hover:bg-orange-700">
              {isSubmitting ? "Adding..." : "Add Card"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Card Dialog */}
      <Dialog open={isEditCardOpen} onOpenChange={setIsEditCardOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Edit Fill-in-the-Blank Card</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-question">Question *</Label>
                <Textarea
                  id="edit-question"
                  value={formData.question}
                  onChange={(e) => setFormData(prev => ({ ...prev, question: e.target.value }))}
                  placeholder="Enter the question with blank (e.g., 'The cat ___ on the mat.')"
                  disabled={isSubmitting}
                  rows={3}
                />
                <p className="text-xs text-slate-500">
                  Use underscores (___) or words like "BLANK" to indicate where the answer should go.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-answer">Answer *</Label>
                <Input
                  id="edit-answer"
                  value={formData.answer}
                  onChange={(e) => setFormData(prev => ({ ...prev, answer: e.target.value }))}
                  placeholder="Enter the correct answer"
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-options">Multiple Choice Options (Optional)</Label>
                <Input
                  id="edit-options"
                  value={optionsInput}
                  onChange={(e) => handleOptionsInputChange(e.target.value)}
                  placeholder="Enter options separated by commas (e.g., sits, runs, jumps, sleeps)"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-slate-500">
                  Leave empty for open-ended questions, or provide comma-separated options for multiple choice.
                </p>
                {formData.options.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {formData.options.map((option, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {option}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-explanation">Explanation (Optional)</Label>
                <Textarea
                  id="edit-explanation"
                  value={formData.explanation}
                  onChange={(e) => setFormData(prev => ({ ...prev, explanation: e.target.value }))}
                  placeholder="Explain why this is the correct answer or provide additional context"
                  disabled={isSubmitting}
                  rows={3}
                />
              </div>
            </div>
          </ScrollArea>

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsEditCardOpen(false)
                setEditingCard(null)
                setFormData(initialFormData)
                setOptionsInput("")
              }} 
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleEditCard} disabled={isSubmitting} className="bg-orange-600 hover:bg-orange-700">
              {isSubmitting ? "Updating..." : "Update Card"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}