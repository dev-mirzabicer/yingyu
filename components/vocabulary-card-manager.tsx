"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  Volume2,
  ImageIcon,
  Video,
  Tag,
  Search,
  Upload,
  Download,
  Copy,
  Eye,
  EyeOff,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useDeckCards, addCardToDeck, updateCard, deleteCard } from "@/hooks/use-api-enhanced"
import type { VocabularyCard } from "@prisma/client"
import { DataTable } from "@/components/data-table"

interface VocabularyCardManagerProps {
  deckId: string
  deckName: string
  isReadOnly?: boolean
}

interface CardFormData {
  englishWord: string
  chineseTranslation: string
  pinyin: string
  ipaPronunciation: string
  exampleSentences: string
  wordType: string
  difficultyLevel: number
  audioUrl: string
  imageUrl: string
  videoUrl: string
  tags: string[]
}

const initialFormData: CardFormData = {
  englishWord: "",
  chineseTranslation: "",
  pinyin: "",
  ipaPronunciation: "",
  exampleSentences: "",
  wordType: "",
  difficultyLevel: 1,
  audioUrl: "",
  imageUrl: "",
  videoUrl: "",
  tags: [],
}

const wordTypes = [
  "noun",
  "verb",
  "adjective",
  "adverb",
  "preposition",
  "conjunction",
  "interjection",
  "pronoun",
  "article",
]

const difficultyLevels = [
  { value: 1, label: "Beginner" },
  { value: 2, label: "Elementary" },
  { value: 3, label: "Intermediate" },
  { value: 4, label: "Advanced" },
  { value: 5, label: "Expert" },
]

export function VocabularyCardManager({ deckId, deckName, isReadOnly = false }: VocabularyCardManagerProps) {
  const { cards, isLoading, isError, mutate, error } = useDeckCards(deckId)
  const [isAddCardOpen, setIsAddCardOpen] = useState(false)
  const [isEditCardOpen, setIsEditCardOpen] = useState(false)
  const [editingCard, setEditingCard] = useState<VocabularyCard | null>(null)
  const [formData, setFormData] = useState<CardFormData>(initialFormData)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterDifficulty, setFilterDifficulty] = useState<string>("all")
  const [filterWordType, setFilterWordType] = useState<string>("all")
  const [showAdvancedFields, setShowAdvancedFields] = useState(false)
  const [newTag, setNewTag] = useState("")

  const { toast } = useToast()

  // Filter cards based on search and filters
  const filteredCards = cards.filter((card) => {
    const matchesSearch =
      card.englishWord.toLowerCase().includes(searchTerm.toLowerCase()) ||
      card.chineseTranslation.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (card.pinyin && card.pinyin.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesDifficulty = filterDifficulty === "all" || card.difficultyLevel.toString() === filterDifficulty
    const matchesWordType = filterWordType === "all" || card.wordType === filterWordType

    return matchesSearch && matchesDifficulty && matchesWordType
  })

  const handleAddCard = async () => {
    if (!formData.englishWord || !formData.chineseTranslation) {
      toast({
        title: "Error",
        description: "English word and Chinese translation are required.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const cardData = {
        ...formData,
        exampleSentences: formData.exampleSentences ? JSON.parse(formData.exampleSentences) : null,
        audioUrl: formData.audioUrl || undefined,
        imageUrl: formData.imageUrl || undefined,
        videoUrl: formData.videoUrl || undefined,
      }

      await addCardToDeck(deckId, cardData)

      toast({
        title: "Card added successfully",
        description: `"${formData.englishWord}" has been added to the deck.`,
      })

      setFormData(initialFormData)
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
    if (!editingCard || !formData.englishWord || !formData.chineseTranslation) {
      toast({
        title: "Error",
        description: "English word and Chinese translation are required.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const cardData = {
        ...formData,
        exampleSentences: formData.exampleSentences ? JSON.parse(formData.exampleSentences) : null,
        audioUrl: formData.audioUrl || undefined,
        imageUrl: formData.imageUrl || undefined,
        videoUrl: formData.videoUrl || undefined,
      }

      await updateCard(editingCard.id, cardData)

      toast({
        title: "Card updated successfully",
        description: `"${formData.englishWord}" has been updated.`,
      })

      setFormData(initialFormData)
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

  const handleDeleteCard = async (card: VocabularyCard) => {
    if (!confirm(`Are you sure you want to delete "${card.englishWord}"?`)) {
      return
    }

    try {
      await deleteCard(card.id)
      toast({
        title: "Card deleted",
        description: `"${card.englishWord}" has been removed from the deck.`,
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

  const openEditDialog = (card: VocabularyCard) => {
    setEditingCard(card)
    setFormData({
      englishWord: card.englishWord,
      chineseTranslation: card.chineseTranslation,
      pinyin: card.pinyin || "",
      ipaPronunciation: card.ipaPronunciation || "",
      exampleSentences: card.exampleSentences ? JSON.stringify(card.exampleSentences, null, 2) : "",
      wordType: card.wordType || "",
      difficultyLevel: card.difficultyLevel,
      audioUrl: card.audioUrl || "",
      imageUrl: card.imageUrl || "",
      videoUrl: card.videoUrl || "",
      tags: card.tags || [],
    })
    setIsEditCardOpen(true)
  }

  const addTag = () => {
    if (newTag && !formData.tags.includes(newTag)) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, newTag],
      }))
      setNewTag("")
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }))
  }

  const cardColumns = [
    {
      key: "englishWord",
      header: "English Word",
      render: (value: string, row: VocabularyCard) => (
        <div className="space-y-1">
          <div className="font-medium text-slate-900">{value}</div>
          {row.wordType && (
            <Badge variant="outline" className="text-xs">
              {row.wordType}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "chineseTranslation",
      header: "Chinese Translation",
      render: (value: string, row: VocabularyCard) => (
        <div className="space-y-1">
          <div className="text-slate-900">{value}</div>
          {row.pinyin && <div className="text-sm text-slate-500">{row.pinyin}</div>}
        </div>
      ),
    },
    {
      key: "difficultyLevel",
      header: "Difficulty",
      render: (value: number) => {
        const level = difficultyLevels.find((l) => l.value === value)
        return (
          <Badge variant={value <= 2 ? "secondary" : value <= 4 ? "default" : "destructive"}>
            {level?.label || `Level ${value}`}
          </Badge>
        )
      },
    },
    {
      key: "tags",
      header: "Tags",
      render: (value: string[]) => (
        <div className="flex flex-wrap gap-1">
          {value?.slice(0, 3).map((tag, index) => (
            <Badge key={index} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
          {value?.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{value.length - 3}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (_: any, row: VocabularyCard) => (
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
            <AlertDescription>Failed to load vocabulary cards. {error?.message}</AlertDescription>
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
          <h2 className="text-2xl font-bold text-slate-900">Vocabulary Cards</h2>
          <p className="text-slate-600">Manage cards in "{deckName}"</p>
        </div>
        {!isReadOnly && (
          <div className="flex items-center space-x-2">
            <Button variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button onClick={() => setIsAddCardOpen(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Card
            </Button>
          </div>
        )}
      </div>

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
            <Select value={filterDifficulty} onValueChange={setFilterDifficulty}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                {difficultyLevels.map((level) => (
                  <SelectItem key={level.value} value={level.value.toString()}>
                    {level.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterWordType} onValueChange={setFilterWordType}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Word Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {wordTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : filteredCards.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-slate-400 mb-4">
                {searchTerm || filterDifficulty !== "all" || filterWordType !== "all"
                  ? "No cards match your filters"
                  : "No cards in this deck yet"}
              </div>
              {!isReadOnly && !searchTerm && filterDifficulty === "all" && filterWordType === "all" && (
                <Button onClick={() => setIsAddCardOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                  Add Your First Card
                </Button>
              )}
            </div>
          ) : (
            <DataTable data={filteredCards} columns={cardColumns} pageSize={20} />
          )}
        </CardContent>
      </Card>

      {/* Add Card Dialog */}
      <Dialog open={isAddCardOpen} onOpenChange={setIsAddCardOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Add New Vocabulary Card</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-4">
              {/* Basic Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="englishWord">English Word *</Label>
                  <Input
                    id="englishWord"
                    value={formData.englishWord}
                    onChange={(e) => setFormData((prev) => ({ ...prev, englishWord: e.target.value }))}
                    placeholder="Enter English word"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chineseTranslation">Chinese Translation *</Label>
                  <Input
                    id="chineseTranslation"
                    value={formData.chineseTranslation}
                    onChange={(e) => setFormData((prev) => ({ ...prev, chineseTranslation: e.target.value }))}
                    placeholder="输入中文翻译"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pinyin">Pinyin</Label>
                  <Input
                    id="pinyin"
                    value={formData.pinyin}
                    onChange={(e) => setFormData((prev) => ({ ...prev, pinyin: e.target.value }))}
                    placeholder="pīn yīn"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ipaPronunciation">IPA Pronunciation</Label>
                  <Input
                    id="ipaPronunciation"
                    value={formData.ipaPronunciation}
                    onChange={(e) => setFormData((prev) => ({ ...prev, ipaPronunciation: e.target.value }))}
                    placeholder="/prəˌnʌnsiˈeɪʃən/"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="wordType">Word Type</Label>
                  <Select
                    value={formData.wordType}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, wordType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select word type" />
                    </SelectTrigger>
                    <SelectContent>
                      {wordTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="difficultyLevel">Difficulty Level</Label>
                  <Select
                    value={formData.difficultyLevel.toString()}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, difficultyLevel: Number.parseInt(value) }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {difficultyLevels.map((level) => (
                        <SelectItem key={level.value} value={level.value.toString()}>
                          {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
                      {tag} ×
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Add a tag"
                    onKeyDown={(e) => e.key === "Enter" && addTag()}
                    disabled={isSubmitting}
                  />
                  <Button type="button" onClick={addTag} variant="outline" disabled={!newTag}>
                    <Tag className="h-4 w-4" />
                  </Button>
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
                    <Label htmlFor="exampleSentences">Example Sentences (JSON)</Label>
                    <Textarea
                      id="exampleSentences"
                      value={formData.exampleSentences}
                      onChange={(e) => setFormData((prev) => ({ ...prev, exampleSentences: e.target.value }))}
                      placeholder='{"english": "This is an example.", "chinese": "这是一个例子。"}'
                      rows={3}
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="audioUrl">Audio URL</Label>
                      <div className="flex gap-2">
                        <Input
                          id="audioUrl"
                          value={formData.audioUrl}
                          onChange={(e) => setFormData((prev) => ({ ...prev, audioUrl: e.target.value }))}
                          placeholder="https://example.com/audio.mp3"
                          disabled={isSubmitting}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => formData.audioUrl && new Audio(formData.audioUrl).play()}
                          disabled={!formData.audioUrl}
                        >
                          <Volume2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="imageUrl">Image URL</Label>
                      <div className="flex gap-2">
                        <Input
                          id="imageUrl"
                          value={formData.imageUrl}
                          onChange={(e) => setFormData((prev) => ({ ...prev, imageUrl: e.target.value }))}
                          placeholder="https://example.com/image.jpg"
                          disabled={isSubmitting}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => formData.imageUrl && window.open(formData.imageUrl, "_blank")}
                          disabled={!formData.imageUrl}
                        >
                          <ImageIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="videoUrl">Video URL</Label>
                      <div className="flex gap-2">
                        <Input
                          id="videoUrl"
                          value={formData.videoUrl}
                          onChange={(e) => setFormData((prev) => ({ ...prev, videoUrl: e.target.value }))}
                          placeholder="https://example.com/video.mp4"
                          disabled={isSubmitting}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => formData.videoUrl && window.open(formData.videoUrl, "_blank")}
                          disabled={!formData.videoUrl}
                        >
                          <Video className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsAddCardOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleAddCard} disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
              {isSubmitting ? "Adding..." : "Add Card"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Card Dialog */}
      <Dialog open={isEditCardOpen} onOpenChange={setIsEditCardOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Edit Vocabulary Card</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            {/* Same form fields as Add Card Dialog */}
            <div className="space-y-4">
              {/* Basic Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-englishWord">English Word *</Label>
                  <Input
                    id="edit-englishWord"
                    value={formData.englishWord}
                    onChange={(e) => setFormData((prev) => ({ ...prev, englishWord: e.target.value }))}
                    placeholder="Enter English word"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-chineseTranslation">Chinese Translation *</Label>
                  <Input
                    id="edit-chineseTranslation"
                    value={formData.chineseTranslation}
                    onChange={(e) => setFormData((prev) => ({ ...prev, chineseTranslation: e.target.value }))}
                    placeholder="输入中文翻译"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-pinyin">Pinyin</Label>
                  <Input
                    id="edit-pinyin"
                    value={formData.pinyin}
                    onChange={(e) => setFormData((prev) => ({ ...prev, pinyin: e.target.value }))}
                    placeholder="pīn yīn"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-ipaPronunciation">IPA Pronunciation</Label>
                  <Input
                    id="edit-ipaPronunciation"
                    value={formData.ipaPronunciation}
                    onChange={(e) => setFormData((prev) => ({ ...prev, ipaPronunciation: e.target.value }))}
                    placeholder="/prəˌnʌnsiˈeɪʃən/"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-wordType">Word Type</Label>
                  <Select
                    value={formData.wordType}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, wordType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select word type" />
                    </SelectTrigger>
                    <SelectContent>
                      {wordTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-difficultyLevel">Difficulty Level</Label>
                  <Select
                    value={formData.difficultyLevel.toString()}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, difficultyLevel: Number.parseInt(value) }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {difficultyLevels.map((level) => (
                        <SelectItem key={level.value} value={level.value.toString()}>
                          {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
                      {tag} ×
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Add a tag"
                    onKeyDown={(e) => e.key === "Enter" && addTag()}
                    disabled={isSubmitting}
                  />
                  <Button type="button" onClick={addTag} variant="outline" disabled={!newTag}>
                    <Tag className="h-4 w-4" />
                  </Button>
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
                    <Label htmlFor="edit-exampleSentences">Example Sentences (JSON)</Label>
                    <Textarea
                      id="edit-exampleSentences"
                      value={formData.exampleSentences}
                      onChange={(e) => setFormData((prev) => ({ ...prev, exampleSentences: e.target.value }))}
                      placeholder='{"english": "This is an example.", "chinese": "这是一个例子。"}'
                      rows={3}
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-audioUrl">Audio URL</Label>
                      <div className="flex gap-2">
                        <Input
                          id="edit-audioUrl"
                          value={formData.audioUrl}
                          onChange={(e) => setFormData((prev) => ({ ...prev, audioUrl: e.target.value }))}
                          placeholder="https://example.com/audio.mp3"
                          disabled={isSubmitting}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => formData.audioUrl && new Audio(formData.audioUrl).play()}
                          disabled={!formData.audioUrl}
                        >
                          <Volume2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-imageUrl">Image URL</Label>
                      <div className="flex gap-2">
                        <Input
                          id="edit-imageUrl"
                          value={formData.imageUrl}
                          onChange={(e) => setFormData((prev) => ({ ...prev, imageUrl: e.target.value }))}
                          placeholder="https://example.com/image.jpg"
                          disabled={isSubmitting}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => formData.imageUrl && window.open(formData.imageUrl, "_blank")}
                          disabled={!formData.imageUrl}
                        >
                          <ImageIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-videoUrl">Video URL</Label>
                      <div className="flex gap-2">
                        <Input
                          id="edit-videoUrl"
                          value={formData.videoUrl}
                          onChange={(e) => setFormData((prev) => ({ ...prev, videoUrl: e.target.value }))}
                          placeholder="https://example.com/video.mp4"
                          disabled={isSubmitting}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => formData.videoUrl && window.open(formData.videoUrl, "_blank")}
                          disabled={!formData.videoUrl}
                        >
                          <Video className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsEditCardOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleEditCard} disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
              {isSubmitting ? "Updating..." : "Update Card"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
