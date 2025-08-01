"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/data-table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Edit, Trash2, ArrowLeft, FileText } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { useDeck, addCardToDeck, updateCard, deleteCard } from "@/hooks/use-api-enhanced"
import { format } from "date-fns"
import type { VocabularyCard } from "@prisma/client"

interface DeckEditorProps {
  deckId: string
}

interface CardFormData {
  englishWord: string
  chineseTranslation: string
  pinyin: string
  ipaPronunciation: string
  wordType: string
  difficultyLevel: number
  exampleSentences: string
  audioUrl: string
  imageUrl: string
  videoUrl: string
  frequencyRank: number | string
  tags: string
}

const initialCardData: CardFormData = {
  englishWord: "",
  chineseTranslation: "",
  pinyin: "",
  ipaPronunciation: "",
  wordType: "",
  difficultyLevel: 1,
  exampleSentences: "",
  audioUrl: "",
  imageUrl: "",
  videoUrl: "",
  frequencyRank: "",
  tags: "",
}

export function DeckEditor({ deckId }: DeckEditorProps) {
  const [isAddCardOpen, setIsAddCardOpen] = useState(false)
  const [isEditCardOpen, setIsEditCardOpen] = useState(false)
  const [editingCard, setEditingCard] = useState<VocabularyCard | null>(null)
  const [cardData, setCardData] = useState<CardFormData>(initialCardData)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  const { deck, isLoading, isError, mutate } = useDeck(deckId)

  useEffect(() => {
    if (editingCard) {
      setCardData({
        englishWord: editingCard.englishWord,
        chineseTranslation: editingCard.chineseTranslation,
        pinyin: editingCard.pinyin || "",
        ipaPronunciation: editingCard.ipaPronunciation || "",
        wordType: editingCard.wordType || "",
        difficultyLevel: editingCard.difficultyLevel || 1,
        exampleSentences: JSON.stringify(editingCard.exampleSentences || {}),
        audioUrl: editingCard.audioUrl || "",
        imageUrl: editingCard.imageUrl || "",
        videoUrl: editingCard.videoUrl || "",
        frequencyRank: editingCard.frequencyRank || "",
        tags: Array.isArray(editingCard.tags) ? editingCard.tags.join(", ") : "",
      })
    }
  }, [editingCard])

  const resetForm = () => {
    setCardData(initialCardData)
    setEditingCard(null)
  }

  const handleAddCard = async () => {
    if (!cardData.englishWord || !cardData.chineseTranslation) {
      toast({
        title: "Error",
        description: "English word and Chinese translation are required.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const submitData = {
        englishWord: cardData.englishWord,
        chineseTranslation: cardData.chineseTranslation,
        pinyin: cardData.pinyin || undefined,
        ipaPronunciation: cardData.ipaPronunciation || undefined,
        wordType: cardData.wordType || undefined,
        difficultyLevel: cardData.difficultyLevel,
        exampleSentences: cardData.exampleSentences ? JSON.parse(cardData.exampleSentences) : undefined,
        audioUrl: cardData.audioUrl || undefined,
        imageUrl: cardData.imageUrl || undefined,
        videoUrl: cardData.videoUrl || undefined,
        frequencyRank: cardData.frequencyRank ? Number(cardData.frequencyRank) : undefined,
        tags: cardData.tags ? cardData.tags.split(",").map(tag => tag.trim()).filter(Boolean) : undefined,
      }

      await addCardToDeck(deckId, submitData)
      toast({
        title: "Card added successfully",
        description: `"${cardData.englishWord}" has been added to the deck.`,
      })
      resetForm()
      setIsAddCardOpen(false)
      mutate() // Refresh the deck data
    } catch (error) {
      toast({
        title: "Error adding card",
        description: "Failed to add card. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditCard = async () => {
    if (!editingCard || !cardData.englishWord || !cardData.chineseTranslation) {
      toast({
        title: "Error",
        description: "English word and Chinese translation are required.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const submitData = {
        englishWord: cardData.englishWord,
        chineseTranslation: cardData.chineseTranslation,
        pinyin: cardData.pinyin || null,
        ipaPronunciation: cardData.ipaPronunciation || null,
        wordType: cardData.wordType || null,
        difficultyLevel: cardData.difficultyLevel,
        exampleSentences: cardData.exampleSentences ? JSON.parse(cardData.exampleSentences) : null,
        audioUrl: cardData.audioUrl || null,
        imageUrl: cardData.imageUrl || null,
        videoUrl: cardData.videoUrl || null,
        frequencyRank: cardData.frequencyRank ? Number(cardData.frequencyRank) : null,
        tags: cardData.tags ? cardData.tags.split(",").map(tag => tag.trim()).filter(Boolean) : null,
      }

      await updateCard(editingCard.id, submitData)
      toast({
        title: "Card updated successfully",
        description: `"${cardData.englishWord}" has been updated.`,
      })
      resetForm()
      setIsEditCardOpen(false)
      mutate() // Refresh the deck data
    } catch (error) {
      toast({
        title: "Error updating card",
        description: "Failed to update card. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteCard = async (card: VocabularyCard) => {
    if (!confirm(`Are you sure you want to delete "${card.englishWord}"?`)) {
      return
    }

    try {
      await deleteCard(card.id)
      toast({
        title: "Card deleted successfully",
        description: `"${card.englishWord}" has been deleted.`,
      })
      mutate() // Refresh the deck data
    } catch (error) {
      toast({
        title: "Error deleting card",
        description: "Failed to delete card. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleEditCardOpen = (card: VocabularyCard) => {
    setEditingCard(card)
    setIsEditCardOpen(true)
  }

  const cardColumns = [
    {
      key: "englishWord",
      header: "English Word",
      render: (value: string) => <span className="font-medium">{value}</span>,
    },
    {
      key: "chineseTranslation",
      header: "Chinese Translation",
      render: (value: string) => <span className="text-slate-600">{value}</span>,
    },
    {
      key: "pinyin",
      header: "Pinyin",
      render: (value: string) => value || "—",
    },
    {
      key: "wordType",
      header: "Type",
      render: (value: string) => value ? (
        <Badge variant="secondary">{value}</Badge>
      ) : "—",
    },
    {
      key: "difficultyLevel",
      header: "Difficulty",
      render: (value: number) => value ? (
        <Badge variant={value <= 2 ? "default" : value <= 4 ? "secondary" : "destructive"}>
          Level {value}
        </Badge>
      ) : "—",
    },
    {
      key: "createdAt",
      header: "Created",
      render: (value: string) => format(new Date(value), "MMM dd, yyyy"),
    },
    {
      key: "actions",
      header: "Actions",
      render: (_: any, row: VocabularyCard) => (
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleEditCardOpen(row)}
            className="h-8 w-8 p-0"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDeleteCard(row)}
            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  if (isError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Link href="/content" className="flex items-center text-blue-600 hover:text-blue-800">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Content Library
          </Link>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <p className="text-slate-600">Failed to load deck. Please try again.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!deck) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Link href="/content" className="flex items-center text-blue-600 hover:text-blue-800">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Content Library
          </Link>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <p className="text-slate-600">Deck not found.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center space-x-4">
            <Link href="/content" className="flex items-center text-blue-600 hover:text-blue-800">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Content Library
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">{deck.name}</h1>
          <p className="text-slate-600">
            {deck.description || "No description provided"} • {deck.cards?.length || 0} cards
          </p>
        </div>
        <Button onClick={() => setIsAddCardOpen(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Add Card
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Vocabulary Cards</CardTitle>
            <Button onClick={() => setIsAddCardOpen(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Card
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!deck.cards || deck.cards.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-4">No cards in this deck yet</p>
              <Button onClick={() => setIsAddCardOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                Add Your First Card
              </Button>
            </div>
          ) : (
            <DataTable data={deck.cards} columns={cardColumns} />
          )}
        </CardContent>
      </Card>

      {/* Add Card Dialog */}
      <Dialog open={isAddCardOpen} onOpenChange={(open) => {
        setIsAddCardOpen(open)
        if (!open) resetForm()
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Card to {deck.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="englishWord">English Word *</Label>
                <Input
                  id="englishWord"
                  placeholder="Enter English word"
                  value={cardData.englishWord}
                  onChange={(e) => setCardData({ ...cardData, englishWord: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="chineseTranslation">Chinese Translation *</Label>
                <Input
                  id="chineseTranslation"
                  placeholder="Enter Chinese translation"
                  value={cardData.chineseTranslation}
                  onChange={(e) => setCardData({ ...cardData, chineseTranslation: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pinyin">Pinyin</Label>
                <Input
                  id="pinyin"
                  placeholder="Enter pinyin"
                  value={cardData.pinyin}
                  onChange={(e) => setCardData({ ...cardData, pinyin: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ipaPronunciation">IPA Pronunciation</Label>
                <Input
                  id="ipaPronunciation"
                  placeholder="Enter IPA pronunciation"
                  value={cardData.ipaPronunciation}
                  onChange={(e) => setCardData({ ...cardData, ipaPronunciation: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="wordType">Word Type</Label>
                <Input
                  id="wordType"
                  placeholder="noun, verb, adjective..."
                  value={cardData.wordType}
                  onChange={(e) => setCardData({ ...cardData, wordType: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="difficultyLevel">Difficulty Level</Label>
                <Input
                  id="difficultyLevel"
                  type="number"
                  min="1"
                  max="5"
                  placeholder="1-5"
                  value={cardData.difficultyLevel}
                  onChange={(e) => setCardData({ ...cardData, difficultyLevel: parseInt(e.target.value) || 1 })}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="frequencyRank">Frequency Rank</Label>
                <Input
                  id="frequencyRank"
                  type="number"
                  placeholder="1000, 2000..."
                  value={cardData.frequencyRank}
                  onChange={(e) => setCardData({ ...cardData, frequencyRank: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="exampleSentences">Example Sentences (JSON)</Label>
              <Textarea
                id="exampleSentences"
                placeholder='{"examples": ["This is an example.", "Here is another."]}'
                value={cardData.exampleSentences}
                onChange={(e) => setCardData({ ...cardData, exampleSentences: e.target.value })}
                disabled={isSubmitting}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="audioUrl">Audio URL</Label>
                <Input
                  id="audioUrl"
                  type="url"
                  placeholder="https://..."
                  value={cardData.audioUrl}
                  onChange={(e) => setCardData({ ...cardData, audioUrl: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="imageUrl">Image URL</Label>
                <Input
                  id="imageUrl"
                  type="url"
                  placeholder="https://..."
                  value={cardData.imageUrl}
                  onChange={(e) => setCardData({ ...cardData, imageUrl: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="videoUrl">Video URL</Label>
                <Input
                  id="videoUrl"
                  type="url"
                  placeholder="https://..."
                  value={cardData.videoUrl}
                  onChange={(e) => setCardData({ ...cardData, videoUrl: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                placeholder="beginner, common, business"
                value={cardData.tags}
                onChange={(e) => setCardData({ ...cardData, tags: e.target.value })}
                disabled={isSubmitting}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setIsAddCardOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddCard}
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? "Adding..." : "Add Card"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Card Dialog */}
      <Dialog open={isEditCardOpen} onOpenChange={(open) => {
        setIsEditCardOpen(open)
        if (!open) resetForm()
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Card: {editingCard?.englishWord}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-englishWord">English Word *</Label>
                <Input
                  id="edit-englishWord"
                  placeholder="Enter English word"
                  value={cardData.englishWord}
                  onChange={(e) => setCardData({ ...cardData, englishWord: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-chineseTranslation">Chinese Translation *</Label>
                <Input
                  id="edit-chineseTranslation"
                  placeholder="Enter Chinese translation"
                  value={cardData.chineseTranslation}
                  onChange={(e) => setCardData({ ...cardData, chineseTranslation: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-pinyin">Pinyin</Label>
                <Input
                  id="edit-pinyin"
                  placeholder="Enter pinyin"
                  value={cardData.pinyin}
                  onChange={(e) => setCardData({ ...cardData, pinyin: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-ipaPronunciation">IPA Pronunciation</Label>
                <Input
                  id="edit-ipaPronunciation"
                  placeholder="Enter IPA pronunciation"
                  value={cardData.ipaPronunciation}
                  onChange={(e) => setCardData({ ...cardData, ipaPronunciation: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-wordType">Word Type</Label>
                <Input
                  id="edit-wordType"
                  placeholder="noun, verb, adjective..."
                  value={cardData.wordType}
                  onChange={(e) => setCardData({ ...cardData, wordType: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-difficultyLevel">Difficulty Level</Label>
                <Input
                  id="edit-difficultyLevel"
                  type="number"
                  min="1"
                  max="5"
                  placeholder="1-5"
                  value={cardData.difficultyLevel}
                  onChange={(e) => setCardData({ ...cardData, difficultyLevel: parseInt(e.target.value) || 1 })}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-frequencyRank">Frequency Rank</Label>
                <Input
                  id="edit-frequencyRank"
                  type="number"
                  placeholder="1000, 2000..."
                  value={cardData.frequencyRank}
                  onChange={(e) => setCardData({ ...cardData, frequencyRank: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-exampleSentences">Example Sentences (JSON)</Label>
              <Textarea
                id="edit-exampleSentences"
                placeholder='{"examples": ["This is an example.", "Here is another."]}'
                value={cardData.exampleSentences}
                onChange={(e) => setCardData({ ...cardData, exampleSentences: e.target.value })}
                disabled={isSubmitting}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-audioUrl">Audio URL</Label>
                <Input
                  id="edit-audioUrl"
                  type="url"
                  placeholder="https://..."
                  value={cardData.audioUrl}
                  onChange={(e) => setCardData({ ...cardData, audioUrl: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-imageUrl">Image URL</Label>
                <Input
                  id="edit-imageUrl"
                  type="url"
                  placeholder="https://..."
                  value={cardData.imageUrl}
                  onChange={(e) => setCardData({ ...cardData, imageUrl: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-videoUrl">Video URL</Label>
                <Input
                  id="edit-videoUrl"
                  type="url"
                  placeholder="https://..."
                  value={cardData.videoUrl}
                  onChange={(e) => setCardData({ ...cardData, videoUrl: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-tags">Tags (comma-separated)</Label>
              <Input
                id="edit-tags"
                placeholder="beginner, common, business"
                value={cardData.tags}
                onChange={(e) => setCardData({ ...cardData, tags: e.target.value })}
                disabled={isSubmitting}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setIsEditCardOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleEditCard}
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? "Updating..." : "Update Card"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}