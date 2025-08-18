"use client"

import React from "react"
import { 
  useFillInBlankQuestions,
  createFillInBlankQuestion,
  updateFillInBlankQuestion,
  deleteFillInBlankQuestion,
  bulkCreateFillInBlankQuestions,
  bulkDeleteFillInBlankQuestions,
  reorderFillInBlankQuestions,
  searchVocabularyCardsForBinding,
} from "@/hooks/api/content"
import { 
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle 
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger 
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit3,
  Trash2,
  Link2,
  Unlink,
  GripVertical,
  FileUp,
  Download,
  Filter,
  ChevronDown,
  BookOpen,
  Target,
  Hash,
  Calendar,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Save,
  X,
} from "lucide-react"
import type { VocabularyDeck, VocabularyCard, FillInBlankQuestion } from "@prisma/client"
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { toast } from "@/hooks/use-toast"

interface FillInBlankCardManagerProps {
  exerciseId: string
  exerciseTitle: string
  vocabularyDeck: VocabularyDeck & { _count: { cards: number } }
  isReadOnly?: boolean
}

interface QuestionFormData {
  sentence: string
  correctAnswer: string
  vocabularyCardId?: string
  distractors: string[]
  difficultyLevel: number
}

export function FillInBlankCardManager({
  exerciseId,
  exerciseTitle,
  vocabularyDeck,
  isReadOnly = false
}: FillInBlankCardManagerProps) {
  // State
  const [page, setPage] = React.useState(1)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [showInactive, setShowInactive] = React.useState(false)
  const [selectedQuestions, setSelectedQuestions] = React.useState<Set<string>>(new Set())
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false)
  const [editingQuestion, setEditingQuestion] = React.useState<string | null>(null)
  const [vocabularySearchQuery, setVocabularySearchQuery] = React.useState("")
  const [vocabularySearchResults, setVocabularySearchResults] = React.useState<(VocabularyCard & { 
    isExactMatch: boolean
    relevanceScore: number 
  })[]>([])
  const [isVocabularySearchLoading, setIsVocabularySearchLoading] = React.useState(false)

  // Form state for create/edit
  const [formData, setFormData] = React.useState<QuestionFormData>({
    sentence: "",
    correctAnswer: "",
    vocabularyCardId: undefined,
    distractors: [],
    difficultyLevel: 1,
  })

  // Load questions
  const {
    questions,
    total,
    totalPages,
    exerciseInfo,
    isLoading,
    isError,
    mutate,
  } = useFillInBlankQuestions(exerciseId, {
    page,
    limit: 20,
    search: searchQuery,
    activeOnly: !showInactive,
  })

  // Handlers
  const handleSearch = React.useCallback((query: string) => {
    setSearchQuery(query)
    setPage(1) // Reset to first page when searching
  }, [])

  const handleVocabularySearch = React.useCallback(async (query: string) => {
    setVocabularySearchQuery(query)
    
    if (!query.trim()) {
      setVocabularySearchResults([])
      return
    }

    setIsVocabularySearchLoading(true)
    try {
      const results = await searchVocabularyCardsForBinding({
        deckId: vocabularyDeck.id,
        query: query.trim(),
        limit: 10,
      })
      setVocabularySearchResults(results.cards)
    } catch (error) {
      console.error("Error searching vocabulary cards:", error)
      toast({
        title: "Search failed",
        description: "Failed to search vocabulary cards. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsVocabularySearchLoading(false)
    }
  }, [vocabularyDeck.id])

  const resetForm = () => {
    setFormData({
      sentence: "",
      correctAnswer: "",
      vocabularyCardId: undefined,
      distractors: [],
      difficultyLevel: 1,
    })
    setVocabularySearchQuery("")
    setVocabularySearchResults([])
  }

  const handleCreateQuestion = async () => {
    if (!formData.sentence.trim() || !formData.correctAnswer.trim()) {
      toast({
        title: "Invalid input",
        description: "Please provide both a sentence and correct answer.",
        variant: "destructive",
      })
      return
    }

    try {
      await createFillInBlankQuestion(exerciseId, {
        sentence: formData.sentence.trim(),
        correctAnswer: formData.correctAnswer.trim(),
        vocabularyCardId: formData.vocabularyCardId,
        distractors: formData.distractors.filter(d => d.trim()),
        difficultyLevel: formData.difficultyLevel,
      })

      toast({
        title: "Question created",
        description: "Fill-in-blank question has been created successfully.",
      })

      resetForm()
      setIsCreateDialogOpen(false)
      mutate()
    } catch (error) {
      console.error("Error creating question:", error)
      toast({
        title: "Creation failed",
        description: "Failed to create question. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleUpdateQuestion = async (questionId: string, updates: Partial<QuestionFormData>) => {
    try {
      await updateFillInBlankQuestion(exerciseId, questionId, {
        ...updates,
        distractors: updates.distractors?.filter(d => d.trim()),
      })

      toast({
        title: "Question updated",
        description: "Fill-in-blank question has been updated successfully.",
      })

      setEditingQuestion(null)
      mutate()
    } catch (error) {
      console.error("Error updating question:", error)
      toast({
        title: "Update failed",
        description: "Failed to update question. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleDeleteQuestion = async (questionId: string) => {
    try {
      await deleteFillInBlankQuestion(exerciseId, questionId)

      toast({
        title: "Question deleted",
        description: "Fill-in-blank question has been deleted successfully.",
      })

      mutate()
    } catch (error) {
      console.error("Error deleting question:", error)
      toast({
        title: "Deletion failed",
        description: "Failed to delete question. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleBulkDelete = async () => {
    if (selectedQuestions.size === 0) return

    try {
      await bulkDeleteFillInBlankQuestions(exerciseId, Array.from(selectedQuestions))

      toast({
        title: "Questions deleted",
        description: `${selectedQuestions.size} questions have been deleted successfully.`,
      })

      setSelectedQuestions(new Set())
      mutate()
    } catch (error) {
      console.error("Error bulk deleting questions:", error)
      toast({
        title: "Bulk deletion failed",
        description: "Failed to delete selected questions. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleToggleActive = async (questionId: string, currentState: boolean) => {
    try {
      await updateFillInBlankQuestion(exerciseId, questionId, {
        isActive: !currentState,
      })

      toast({
        title: currentState ? "Question deactivated" : "Question activated",
        description: `Question has been ${currentState ? 'deactivated' : 'activated'} successfully.`,
      })

      mutate()
    } catch (error) {
      console.error("Error toggling question state:", error)
      toast({
        title: "Update failed",
        description: "Failed to update question state. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return

    const reorderedQuestions = Array.from(questions)
    const [movedQuestion] = reorderedQuestions.splice(result.source.index, 1)
    reorderedQuestions.splice(result.destination.index, 0, movedQuestion)

    try {
      const questionIds = reorderedQuestions.map(q => q.id)
      await reorderFillInBlankQuestions(exerciseId, questionIds)

      toast({
        title: "Questions reordered",
        description: "Questions have been reordered successfully.",
      })

      mutate()
    } catch (error) {
      console.error("Error reordering questions:", error)
      toast({
        title: "Reorder failed",
        description: "Failed to reorder questions. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleSelectQuestion = (questionId: string) => {
    const newSelected = new Set(selectedQuestions)
    if (newSelected.has(questionId)) {
      newSelected.delete(questionId)
    } else {
      newSelected.add(questionId)
    }
    setSelectedQuestions(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedQuestions.size === questions.length) {
      setSelectedQuestions(new Set())
    } else {
      setSelectedQuestions(new Set(questions.map(q => q.id)))
    }
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert>
            <AlertDescription>
              Failed to load fill-in-blank questions. Please try again.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-blue-600" />
              <span>Fill-in-Blank Questions</span>
              <Badge variant="outline">{total} total</Badge>
            </div>
            
            {!isReadOnly && (
              <div className="flex items-center space-x-2">
                {selectedQuestions.size > 0 && (
                  <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Selected ({selectedQuestions.size})
                  </Button>
                )}
                
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Question
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Create Fill-in-Blank Question</DialogTitle>
                      <DialogDescription>
                        Add a new fill-in-blank question to {exerciseTitle}
                      </DialogDescription>
                    </DialogHeader>
                    <CreateQuestionForm
                      formData={formData}
                      setFormData={setFormData}
                      vocabularyDeck={vocabularyDeck}
                      vocabularySearchQuery={vocabularySearchQuery}
                      vocabularySearchResults={vocabularySearchResults}
                      isVocabularySearchLoading={isVocabularySearchLoading}
                      onVocabularySearch={handleVocabularySearch}
                      onSubmit={handleCreateQuestion}
                      onCancel={() => {
                        resetForm()
                        setIsCreateDialogOpen(false)
                      }}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </CardTitle>
          
          <CardDescription>
            Bound to <strong>{vocabularyDeck.name}</strong> ({vocabularyDeck._count.cards} cards available)
            {exerciseInfo && (
              <span className="ml-2">
                • Placeholder: <code>{exerciseInfo.placeholderToken}</code>
              </span>
            )}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Search and Filters */}
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search questions..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-inactive"
                checked={showInactive}
                onCheckedChange={setShowInactive}
              />
              <Label htmlFor="show-inactive">Show inactive</Label>
            </div>

            {questions.length > 0 && !isReadOnly && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={selectedQuestions.size === questions.length}
                  onCheckedChange={handleSelectAll}
                />
                <Label>Select All</Label>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Questions List */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : questions.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <div className="space-y-4">
              <Target className="h-12 w-12 text-muted-foreground mx-auto" />
              <div>
                <h3 className="text-lg font-semibold">No questions yet</h3>
                <p className="text-muted-foreground">
                  {searchQuery 
                    ? `No questions match "${searchQuery}"`
                    : "Start by creating your first fill-in-blank question"
                  }
                </p>
              </div>
              {!isReadOnly && !searchQuery && (
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Question
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="questions">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                {questions.map((question, index) => (
                  <Draggable key={question.id} draggableId={question.id} index={index} isDragDisabled={isReadOnly}>
                    {(provided, snapshot) => (
                      <QuestionCard
                        key={question.id}
                        question={question}
                        isSelected={selectedQuestions.has(question.id)}
                        isEditing={editingQuestion === question.id}
                        isReadOnly={isReadOnly}
                        vocabularyDeck={vocabularyDeck}
                        onSelect={handleSelectQuestion}
                        onEdit={(id) => setEditingQuestion(id)}
                        onUpdate={handleUpdateQuestion}
                        onDelete={handleDeleteQuestion}
                        onToggleActive={handleToggleActive}
                        onVocabularySearch={handleVocabularySearch}
                        vocabularySearchResults={vocabularySearchResults}
                        isVocabularySearchLoading={isVocabularySearchLoading}
                        dragProps={provided}
                        isDragging={snapshot.isDragging}
                      />
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}

// Sub-components
interface CreateQuestionFormProps {
  formData: QuestionFormData
  setFormData: React.Dispatch<React.SetStateAction<QuestionFormData>>
  vocabularyDeck: VocabularyDeck
  vocabularySearchQuery: string
  vocabularySearchResults: (VocabularyCard & { isExactMatch: boolean; relevanceScore: number })[]
  isVocabularySearchLoading: boolean
  onVocabularySearch: (query: string) => void
  onSubmit: () => void
  onCancel: () => void
}

function CreateQuestionForm({
  formData,
  setFormData,
  vocabularyDeck,
  vocabularySearchQuery,
  vocabularySearchResults,
  isVocabularySearchLoading,
  onVocabularySearch,
  onSubmit,
  onCancel,
}: CreateQuestionFormProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="sentence">Sentence *</Label>
        <Textarea
          id="sentence"
          placeholder="Enter the sentence with a blank (e.g., 'I _____ to the store every day.')"
          value={formData.sentence}
          onChange={(e) => setFormData(prev => ({ ...prev, sentence: e.target.value }))}
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="correct-answer">Correct Answer *</Label>
        <Input
          id="correct-answer"
          placeholder="Enter the correct word or phrase"
          value={formData.correctAnswer}
          onChange={(e) => setFormData(prev => ({ ...prev, correctAnswer: e.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label>Vocabulary Card Binding (Optional)</Label>
        <div className="space-y-2">
          <Input
            placeholder="Search vocabulary cards..."
            value={vocabularySearchQuery}
            onChange={(e) => onVocabularySearch(e.target.value)}
          />
          {isVocabularySearchLoading && (
            <div className="text-sm text-muted-foreground">Searching...</div>
          )}
          {vocabularySearchResults.length > 0 && (
            <div className="border rounded-md p-2 space-y-1 max-h-40 overflow-y-auto">
              {vocabularySearchResults.map((card) => (
                <div
                  key={card.id}
                  className={`p-2 rounded cursor-pointer hover:bg-muted ${
                    formData.vocabularyCardId === card.id ? 'bg-primary/10 border border-primary' : ''
                  }`}
                  onClick={() => setFormData(prev => ({ 
                    ...prev, 
                    vocabularyCardId: card.id,
                    correctAnswer: prev.correctAnswer || card.englishWord, // Auto-fill if empty
                  }))}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{card.englishWord}</span>
                      <span className="text-muted-foreground ml-2">{card.chineseTranslation}</span>
                    </div>
                    {card.isExactMatch && (
                      <Badge variant="outline" className="text-xs">Exact</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Difficulty Level</Label>
        <Select
          value={formData.difficultyLevel.toString()}
          onValueChange={(value) => setFormData(prev => ({ ...prev, difficultyLevel: parseInt(value) }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5].map(level => (
              <SelectItem key={level} value={level.toString()}>
                Level {level}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSubmit}>
          Create Question
        </Button>
      </div>
    </div>
  )
}

interface QuestionCardProps {
  question: FillInBlankQuestion & { vocabularyCard: VocabularyCard | null }
  isSelected: boolean
  isEditing: boolean
  isReadOnly: boolean
  vocabularyDeck: VocabularyDeck
  onSelect: (id: string) => void
  onEdit: (id: string) => void
  onUpdate: (id: string, updates: Partial<QuestionFormData>) => void
  onDelete: (id: string) => void
  onToggleActive: (id: string, currentState: boolean) => void
  onVocabularySearch: (query: string) => void
  vocabularySearchResults: (VocabularyCard & { isExactMatch: boolean; relevanceScore: number })[]
  isVocabularySearchLoading: boolean
  dragProps: any
  isDragging: boolean
}

function QuestionCard({
  question,
  isSelected,
  isEditing,
  isReadOnly,
  vocabularyDeck,
  onSelect,
  onEdit,
  onUpdate,
  onDelete,
  onToggleActive,
  dragProps,
  isDragging,
}: QuestionCardProps) {
  const [editData, setEditData] = React.useState<QuestionFormData>({
    sentence: question.sentence,
    correctAnswer: question.correctAnswer,
    vocabularyCardId: question.vocabularyCardId || undefined,
    distractors: [...question.distractors],
    difficultyLevel: question.difficultyLevel,
  })

  React.useEffect(() => {
    if (isEditing) {
      setEditData({
        sentence: question.sentence,
        correctAnswer: question.correctAnswer,
        vocabularyCardId: question.vocabularyCardId || undefined,
        distractors: [...question.distractors],
        difficultyLevel: question.difficultyLevel,
      })
    }
  }, [isEditing, question])

  const handleSave = () => {
    onUpdate(question.id, editData)
  }

  const handleCancel = () => {
    setEditData({
      sentence: question.sentence,
      correctAnswer: question.correctAnswer,
      vocabularyCardId: question.vocabularyCardId || undefined,
      distractors: [...question.distractors],
      difficultyLevel: question.difficultyLevel,
    })
    onEdit("")
  }

  return (
    <div
      ref={dragProps?.innerRef}
      {...dragProps?.draggableProps}
      className={`transition-all ${isDragging ? 'rotate-2 scale-105' : ''}`}
    >
      <Card className={`${isSelected ? 'ring-2 ring-primary' : ''} ${!question.isActive ? 'opacity-60' : ''}`}>
        <CardContent className="p-4">
          {isEditing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Sentence</Label>
                <Textarea
                  value={editData.sentence}
                  onChange={(e) => setEditData(prev => ({ ...prev, sentence: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Correct Answer</Label>
                <Input
                  value={editData.correctAnswer}
                  onChange={(e) => setEditData(prev => ({ ...prev, correctAnswer: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Difficulty Level</Label>
                <Select
                  value={editData.difficultyLevel.toString()}
                  onValueChange={(value) => setEditData(prev => ({ ...prev, difficultyLevel: parseInt(value) }))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map(level => (
                      <SelectItem key={level} value={level.toString()}>
                        Level {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" size="sm" onClick={handleCancel}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave}>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3 flex-1">
                {!isReadOnly && (
                  <div className="flex items-center space-x-2 mt-1">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onSelect(question.id)}
                    />
                    <div {...dragProps?.dragHandleProps} className="cursor-grab">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                )}
                
                <div className="flex-1 space-y-2">
                  <div>
                    <p className="text-sm font-medium">{question.sentence}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs text-muted-foreground">Answer:</span>
                      <Badge variant="outline">{question.correctAnswer}</Badge>
                      {question.vocabularyCard && (
                        <div className="flex items-center space-x-1">
                          <Link2 className="h-3 w-3 text-blue-600" />
                          <span className="text-xs text-blue-600">
                            {question.vocabularyCard.englishWord}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <Hash className="h-3 w-3" />
                      <span>Order: {question.order}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Target className="h-3 w-3" />
                      <span>Level: {question.difficultyLevel}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      {question.isActive ? (
                        <CheckCircle className="h-3 w-3 text-green-600" />
                      ) : (
                        <XCircle className="h-3 w-3 text-red-600" />
                      )}
                      <span>{question.isActive ? 'Active' : 'Inactive'}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {!isReadOnly && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(question.id)}>
                      <Edit3 className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onToggleActive(question.id, question.isActive)}>
                      {question.isActive ? (
                        <>
                          <EyeOff className="h-4 w-4 mr-2" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4 mr-2" />
                          Activate
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => onDelete(question.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}