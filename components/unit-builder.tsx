"use client"

import React from "react"

import { useState, useCallback, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { DragDropContext, Droppable, Draggable, type DropResult, type DroppableProvided, type DroppableStateSnapshot, type DraggableProvided, type DraggableStateSnapshot } from "@hello-pangea/dnd"
import {
  Plus,
  GripVertical,
  Edit,
  Trash2,
  Copy,
  Eye,
  Save,
  BookOpen,
  Volume2,
  PenTool,
  Brain,
  Target,
  Settings,
  Layers,
  Clock,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  useUnits,
  useDecks,
  createUnit,
  updateUnit,
  addExerciseToUnit,
  reorderUnitItems,
  removeUnitItem,
  updateUnitItemConfig,
} from "@/hooks/api/content"
import type { FullUnit, NewUnitItemData } from "@/lib/types"
import type { Unit, UnitItemType } from "@prisma/client"
import { FillInBlankExerciseEditor } from "./fill-in-blank-exercise-editor"
import { GrammarExerciseEditor } from "./grammar-exercise-editor"
import { AlertTriangle } from "lucide-react"

interface UnitBuilderProps {
  unitId?: string
  onUnitSaved?: (unit: Unit) => void
}

interface UnitItemTemplate {
  id: string
  type: UnitItemType
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  defaultConfig: any
}

interface DraggableUnitItem {
  id: string
  type: UnitItemType
  title: string
  config: any
  order: number
  estimatedDuration: number
}

const unitItemTemplates: UnitItemTemplate[] = [
  {
    id: "vocabulary-deck",
    type: "VOCABULARY_DECK",
    title: "Vocabulary Deck",
    description: "Spaced repetition vocabulary practice",
    icon: BookOpen,
    defaultConfig: {
      deckId: "",
      newCards: 10,        // Fixed field name
      maxDue: 50,          // Fixed field name  
      minDue: 10,          // Added missing field
      enableAudio: true,
      showPinyin: true,
    },
  },
  {
    id: "listening-exercise",
    type: "LISTENING_EXERCISE",
    title: "Listening Exercise",
    description: "Audio comprehension and dictation",
    icon: Volume2,
    defaultConfig: {
      title: "Listening Practice",
      audioUrl: "",
      correctSpelling: "",
      allowMultipleAttempts: true,
      showHints: false,
    },
  },
  {
    id: "grammar-exercise",
    type: "GRAMMAR_EXERCISE",
    title: "Grammar Exercise",
    description: "Grammar rules and sentence construction",
    icon: PenTool,
    defaultConfig: {
      title: "Grammar Practice",
      grammarTopic: "",
      exerciseData: {
        instructions: "Choose the correct option to complete the sentence.",
        questions: [
          {
            text: "He ___ to the store every day.",
            options: ["go", "goes", "is going"],
            answer: "goes"
          }
        ]
      },
      difficulty: "INTERMEDIATE",
    },
  },
  {
    id: "fill-in-blank",
    type: "VOCAB_FILL_IN_BLANK_EXERCISE",
    title: "Fill in the Blank",
    description: "Vocabulary in context exercises",
    icon: Brain,
    defaultConfig: {
      title: "Fill in the Blank",
      sentences: ["The cat is ____ the table."],
      wordBank: ["on", "under", "in"],
      allowWordBank: true,
    },
  },
]

const difficultyLevels = [
  { value: "BEGINNER", label: "Beginner", color: "bg-green-100 text-green-700" },
  { value: "ELEMENTARY", label: "Elementary", color: "bg-blue-100 text-blue-700" },
  { value: "INTERMEDIATE", label: "Intermediate", color: "bg-yellow-100 text-yellow-700" },
  { value: "ADVANCED", label: "Advanced", color: "bg-orange-100 text-orange-700" },
  { value: "EXPERT", label: "Expert", color: "bg-red-100 text-red-700" },
]

export function UnitBuilder({ unitId, onUnitSaved }: UnitBuilderProps) {
  const { units, mutate: mutateUnits } = useUnits()
  const { decks } = useDecks()

  const [unitData, setUnitData] = useState({
    name: "",
    description: "",
    isPublic: false,
  })

  const [unitItems, setUnitItems] = useState<DraggableUnitItem[]>([])
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<DraggableUnitItem | null>(null)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const { toast } = useToast()

  // Load existing unit data if editing
  useEffect(() => {
    if (unitId && units) {
      const existingUnit = units.find((u) => u.id === unitId) as FullUnit
      if (existingUnit) {
        setUnitData({
          name: existingUnit.name,
          description: existingUnit.description || "",
          isPublic: existingUnit.isPublic,
        })

        // Convert unit items to draggable format
        const draggableItems: DraggableUnitItem[] =
          existingUnit.items?.map((item, index) => ({
            id: item.id,
            type: item.type,
            title:
              item.vocabularyDeck?.name ||
              item.listeningExercise?.title ||
              item.grammarExercise?.title ||
              item.vocabFillInBlankExercise?.title ||
              "Untitled",
            config: item.config || {},
            order: item.order,
            estimatedDuration: 15, // This would be calculated based on item type and config
          })) || []

        setUnitItems(draggableItems)
      }
    }
  }, [unitId, units])

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      if (!result.destination || !unitId) return

      const items = Array.from(unitItems)
      const [reorderedItem] = items.splice(result.source.index, 1)
      items.splice(result.destination.index, 0, reorderedItem)

      // Update order values
      const updatedItems = items.map((item, index) => ({
        ...item,
        order: index,
      }))

      setUnitItems(updatedItems)

      try {
        const itemIds = updatedItems.map(item => item.id);
        await reorderUnitItems(unitId, itemIds);
        toast({
          title: "Order saved",
          description: "The new exercise order has been saved.",
        });
        mutateUnits();
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to save the new order. Please try again.",
          variant: "destructive",
        });
        // Revert to original order on failure
        setUnitItems(unitItems);
      }
    },
    [unitItems, unitId, toast, mutateUnits],
  )

  const handleAddItem = (template: UnitItemTemplate) => {
    const newItem: DraggableUnitItem = {
      id: `temp-${Date.now()}`,
      type: template.type,
      title: template.title,
      config: { ...template.defaultConfig },
      order: unitItems.length,
      estimatedDuration: 15,
    }

    setUnitItems([...unitItems, newItem])
    setEditingItem(newItem)
    setIsConfigDialogOpen(true)
  }

  const handleEditItem = (item: DraggableUnitItem) => {
    setEditingItem(item)
    setIsConfigDialogOpen(true)
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!unitId) return;

    // Optimistically remove the item from the UI
    const originalItems = unitItems;
    setUnitItems(unitItems.filter((item) => item.id !== itemId));

    try {
      await removeUnitItem(unitId, itemId);
      toast({
        title: "Item removed",
        description: "The exercise has been removed from the unit.",
      });
      mutateUnits();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove item. Please try again.",
        variant: "destructive",
      });
      // Revert if the API call fails
      setUnitItems(originalItems);
    }
  }

  const handleDuplicateItem = (item: DraggableUnitItem) => {
    const duplicatedItem: DraggableUnitItem = {
      ...item,
      id: `temp-${Date.now()}`,
      title: `${item.title} (Copy)`,
      order: unitItems.length,
    }

    setUnitItems([...unitItems, duplicatedItem])
    toast({
      title: "Item duplicated",
      description: "The exercise has been duplicated.",
    })
  }

  const handleSaveItemConfig = async (updatedItem: DraggableUnitItem) => {
    if (updatedItem.id.startsWith("temp-")) {
      // This is a new item, just update local state
      setUnitItems(unitItems.map((item) => (item.id === updatedItem.id ? updatedItem : item)))
      setIsConfigDialogOpen(false)
      setEditingItem(null)
      return;
    }

    try {
      await updateUnitItemConfig(updatedItem.id, updatedItem.config);
      toast({
        title: "Configuration Saved",
        description: "The exercise configuration has been updated.",
      });
      mutateUnits();
      setUnitItems(unitItems.map((item) => (item.id === updatedItem.id ? updatedItem : item)))
      setIsConfigDialogOpen(false)
      setEditingItem(null)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save configuration. Please try again.",
        variant: "destructive",
      });
    }
  }

  const handleSaveUnit = async () => {
    if (!unitData.name.trim()) {
      toast({
        title: "Error",
        description: "Please enter a unit name.",
        variant: "destructive",
      })
      return
    }

    if (unitItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one exercise to the unit.",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)
    try {
      let savedUnit: Unit

      if (unitId) {
        // Update existing unit
        const response = await updateUnit(unitId, {
          name: unitData.name,
          description: unitData.description,
          isPublic: unitData.isPublic,
        })
        savedUnit = response.data
      } else {
        // Create new unit
        const response = await createUnit({
          name: unitData.name,
          description: unitData.description,
          isPublic: unitData.isPublic,
        })
        savedUnit = response.data
      }

      // Add/update unit items
      for (const item of unitItems) {
        if (item.id.startsWith("temp-")) {
          // Add new item
          const itemData: NewUnitItemData = {
            type: item.type,
            order: item.order,
            config: item.config,
            data: {
              name: item.title || "Untitled",
              description: "",
              isPublic: false,
            },
          } as NewUnitItemData

          await addExerciseToUnit(savedUnit.id, itemData)
        }
      }

      toast({
        title: "Unit saved successfully",
        description: `"${unitData.name}" has been saved.`,
      })

      mutateUnits()
      onUnitSaved?.(savedUnit)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save unit. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const calculateTotalDuration = () => {
    return unitItems.reduce((total, item) => total + item.estimatedDuration, 0)
  }

  const renderItemConfigDialog = () => {
    if (!editingItem) return null

    const renderVocabularyDeckConfig = () => (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="deckId">Vocabulary Deck *</Label>
          <Select
            value={editingItem.config.deckId || ""}
            onValueChange={(value) =>
              setEditingItem({
                ...editingItem,
                config: { ...editingItem.config, deckId: value },
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a deck" />
            </SelectTrigger>
            <SelectContent>
              {decks.map((deck) => (
                <SelectItem key={deck.id} value={deck.id}>
                  {deck.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="newCards">New Cards</Label>
            <Input
              id="newCards"
              type="number"
              min="0"
              max="50"
              value={editingItem.config.newCards || 10}
              onChange={(e) =>
                setEditingItem({
                  ...editingItem,
                  config: { ...editingItem.config, newCards: Number.parseInt(e.target.value) },
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxDue">Max Due Cards</Label>
            <Input
              id="maxDue"
              type="number"
              min="0"
              max="200"
              value={editingItem.config.maxDue || 50}
              onChange={(e) =>
                setEditingItem({
                  ...editingItem,
                  config: { ...editingItem.config, maxDue: Number.parseInt(e.target.value) },
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="minDue">Min Due Cards</Label>
            <Input
              id="minDue"
              type="number"
              min="0"
              max="50"
              value={editingItem.config.minDue || 10}
              onChange={(e) =>
                setEditingItem({
                  ...editingItem,
                  config: { ...editingItem.config, minDue: Number.parseInt(e.target.value) },
                })
              }
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Enable Audio</Label>
              <p className="text-sm text-slate-500">Play pronunciation audio for cards</p>
            </div>
            <Switch
              checked={editingItem.config.enableAudio ?? true}
              onCheckedChange={(checked) =>
                setEditingItem({
                  ...editingItem,
                  config: { ...editingItem.config, enableAudio: checked },
                })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Show Pinyin</Label>
              <p className="text-sm text-slate-500">Display pinyin pronunciation</p>
            </div>
            <Switch
              checked={editingItem.config.showPinyin ?? true}
              onCheckedChange={(checked) =>
                setEditingItem({
                  ...editingItem,
                  config: { ...editingItem.config, showPinyin: checked },
                })
              }
            />
          </div>
        </div>
      </div>
    )

    const renderListeningExerciseConfig = () => (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="exerciseTitle">Exercise Title *</Label>
          <Input
            id="exerciseTitle"
            value={editingItem.config.title || ""}
            onChange={(e) =>
              setEditingItem({
                ...editingItem,
                title: e.target.value,
                config: { ...editingItem.config, title: e.target.value },
              })
            }
            placeholder="Enter exercise title"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="audioUrl">Audio URL *</Label>
          <Input
            id="audioUrl"
            value={editingItem.config.audioUrl || ""}
            onChange={(e) =>
              setEditingItem({
                ...editingItem,
                config: { ...editingItem.config, audioUrl: e.target.value },
              })
            }
            placeholder="https://example.com/audio.mp3"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="correctSpelling">Correct Spelling *</Label>
          <Textarea
            id="correctSpelling"
            value={editingItem.config.correctSpelling || ""}
            onChange={(e) =>
              setEditingItem({
                ...editingItem,
                config: { ...editingItem.config, correctSpelling: e.target.value },
              })
            }
            placeholder="Enter the correct text that students should hear"
            rows={3}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Allow Multiple Attempts</Label>
              <p className="text-sm text-slate-500">Let students try again if they get it wrong</p>
            </div>
            <Switch
              checked={editingItem.config.allowMultipleAttempts ?? true}
              onCheckedChange={(checked) =>
                setEditingItem({
                  ...editingItem,
                  config: { ...editingItem.config, allowMultipleAttempts: checked },
                })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Show Hints</Label>
              <p className="text-sm text-slate-500">Provide hints after incorrect attempts</p>
            </div>
            <Switch
              checked={editingItem.config.showHints ?? false}
              onCheckedChange={(checked) =>
                setEditingItem({
                  ...editingItem,
                  config: { ...editingItem.config, showHints: checked },
                })
              }
            />
          </div>
        </div>
      </div>
    )

    const renderGrammarExerciseConfig = () => (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="grammarTitle">Exercise Title *</Label>
          <Input
            id="grammarTitle"
            value={editingItem.config.title || ""}
            onChange={(e) =>
              setEditingItem({
                ...editingItem,
                title: e.target.value,
                config: { ...editingItem.config, title: e.target.value },
              })
            }
            placeholder="Enter exercise title"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="grammarTopic">Grammar Topic</Label>
          <Input
            id="grammarTopic"
            value={editingItem.config.grammarTopic || ""}
            onChange={(e) =>
              setEditingItem({
                ...editingItem,
                config: { ...editingItem.config, grammarTopic: e.target.value },
              })
            }
            placeholder="e.g., Present Perfect, Conditionals"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="difficulty">Difficulty Level</Label>
          <Select
            value={editingItem.config.difficulty || "INTERMEDIATE"}
            onValueChange={(value) =>
              setEditingItem({
                ...editingItem,
                config: { ...editingItem.config, difficulty: value },
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {difficultyLevels.map((level) => (
                <SelectItem key={level.value} value={level.value}>
                  {level.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <GrammarExerciseEditor
          value={editingItem.config.exerciseData || {}}
          onChange={(data) => {
            setEditingItem({
              ...editingItem,
              config: { ...editingItem.config, exerciseData: data },
            })
          }}
        />
      </div>
    )

    const renderFillInBlankConfig = () => (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="blankTitle">Exercise Title *</Label>
          <Input
            id="blankTitle"
            value={editingItem.config.title || ""}
            onChange={(e) =>
              setEditingItem({
                ...editingItem,
                title: e.target.value,
                config: { ...editingItem.config, title: e.target.value },
              })
            }
            placeholder="Enter exercise title"
          />
        </div>

        <FillInBlankExerciseEditor
          sentences={editingItem.config.sentences || []}
          wordBank={editingItem.config.wordBank || []}
          onSentencesChange={(sentences) => {
            setEditingItem({
              ...editingItem,
              config: { ...editingItem.config, sentences },
            })
          }}
          onWordBankChange={(wordBank) => {
            setEditingItem({
              ...editingItem,
              config: { ...editingItem.config, wordBank },
            })
          }}
        />

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="space-y-1">
            <Label>Allow Word Bank</Label>
            <p className="text-sm text-slate-500">Show word bank to help students</p>
          </div>
          <Switch
            checked={editingItem.config.allowWordBank ?? true}
            onCheckedChange={(checked) =>
              setEditingItem({
                ...editingItem,
                config: { ...editingItem.config, allowWordBank: checked },
              })
            }
          />
        </div>
      </div>
    )

    return (
      <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Configure {editingItem.title}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6">
              {editingItem.type === "VOCABULARY_DECK" && renderVocabularyDeckConfig()}
              {editingItem.type === "LISTENING_EXERCISE" && renderListeningExerciseConfig()}
              {editingItem.type === "GRAMMAR_EXERCISE" && renderGrammarExerciseConfig()}
              {editingItem.type === "VOCAB_FILL_IN_BLANK_EXERCISE" && renderFillInBlankConfig()}

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="estimatedDuration">Estimated Duration (minutes)</Label>
                <Input
                  id="estimatedDuration"
                  type="number"
                  min="1"
                  max="120"
                  value={editingItem.estimatedDuration}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      estimatedDuration: Number.parseInt(e.target.value) || 15,
                    })
                  }
                />
              </div>
            </div>
          </ScrollArea>

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsConfigDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => handleSaveItemConfig(editingItem)} className="bg-blue-600 hover:bg-blue-700">
              Save Configuration
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Unit Builder</h2>
          <p className="text-slate-600">Create and organize teaching units with drag-and-drop</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => setIsPreviewMode(!isPreviewMode)}>
            <Eye className="h-4 w-4 mr-2" />
            {isPreviewMode ? "Edit Mode" : "Preview"}
          </Button>
          <Button onClick={handleSaveUnit} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save Unit"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Unit Configuration Panel */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>Unit Settings</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="unitName">Unit Name *</Label>
                <Input
                  id="unitName"
                  value={unitData.name}
                  onChange={(e) => setUnitData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter unit name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unitDescription">Description</Label>
                <Textarea
                  id="unitDescription"
                  value={unitData.description}
                  onChange={(e) => setUnitData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what students will learn"
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Public Unit</Label>
                  <p className="text-sm text-slate-500">Share with other teachers</p>
                </div>
                <Switch
                  checked={unitData.isPublic}
                  onCheckedChange={(checked) => setUnitData((prev) => ({ ...prev, isPublic: checked }))}
                />
              </div>

              <Separator />

              {/* Unit Stats */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Layers className="h-4 w-4 text-slate-500" />
                    <span className="text-sm text-slate-600">Exercises</span>
                  </div>
                  <Badge variant="outline">{unitItems.length}</Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-slate-500" />
                    <span className="text-sm text-slate-600">Duration</span>
                  </div>
                  <Badge variant="outline">
                    {unitData.estimatedMinimumDuration} - {unitData.estimatedMaximumDuration} min
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Exercise Templates */}
          {!isPreviewMode && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Plus className="h-5 w-5" />
                  <span>Add Exercises</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {unitItemTemplates.map((template) => {
                  const Icon = template.icon
                  return (
                    <Button
                      key={template.id}
                      variant="outline"
                      className="w-full justify-start h-auto p-3 bg-transparent"
                      onClick={() => handleAddItem(template)}
                    >
                      <div className="flex items-start space-x-3">
                        <Icon className="h-5 w-5 text-slate-600 mt-0.5" />
                        <div className="text-left">
                          <div className="font-medium">{template.title}</div>
                          <div className="text-xs text-slate-500">{template.description}</div>
                        </div>
                      </div>
                    </Button>
                  )
                })}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Unit Content Area */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Layers className="h-5 w-5" />
                <span>Unit Content</span>
                {unitItems.length > 0 && (
                  <Badge variant="outline" className="ml-2">
                    {unitItems.length} exercises
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {unitItems.length === 0 ? (
                <div className="text-center py-12">
                  <Target className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No exercises yet</h3>
                  <p className="text-slate-500 mb-6">Add exercises from the panel on the left to build your unit</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {unitItemTemplates.slice(0, 2).map((template) => {
                      const Icon = template.icon
                      return (
                        <Button
                          key={template.id}
                          variant="outline"
                          onClick={() => handleAddItem(template)}
                          className="flex items-center space-x-2"
                        >
                          <Icon className="h-4 w-4" />
                          <span>{template.title}</span>
                        </Button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="unit-items">
                    {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={`space-y-3 min-h-32 p-2 rounded-lg transition-colors ${snapshot.isDraggingOver ? "bg-blue-50 border-2 border-blue-200 border-dashed" : ""
                          }`}
                      >
                        {unitItems.map((item, index) => (
                          <Draggable key={item.id} draggableId={item.id} index={index} isDragDisabled={isPreviewMode}>
                            {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`bg-white border rounded-lg p-4 transition-shadow ${snapshot.isDragging ? "shadow-lg" : "shadow-sm hover:shadow-md"
                                  }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-3">
                                    {!isPreviewMode && (
                                      <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                        <GripVertical className="h-5 w-5 text-slate-400" />
                                      </div>
                                    )}

                                    <div className="p-2 bg-slate-100 rounded-lg">
                                      {React.createElement(
                                        unitItemTemplates.find((t) => t.type === item.type)?.icon || BookOpen,
                                        { className: "h-5 w-5 text-slate-600" },
                                      )}
                                    </div>

                                    <div>
                                      <h4 className="font-medium text-slate-900">{item.title}</h4>
                                      <div className="flex items-center space-x-4 text-sm text-slate-500">
                                        <span className="flex items-center space-x-1">
                                          <Clock className="h-3 w-3" />
                                          <span>{item.estimatedDuration} min</span>
                                        </span>
                                        <Badge variant="outline" className="text-xs">
                                          {item.type.replace(/_/g, " ").toLowerCase()}
                                        </Badge>
                                      </div>
                                    </div>
                                  </div>

                                  {!isPreviewMode && (
                                    <div className="flex items-center space-x-1">
                                      <Button variant="ghost" size="sm" onClick={() => handleEditItem(item)}>
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button variant="ghost" size="sm" onClick={() => handleDuplicateItem(item)}>
                                        <Copy className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteItem(item.id)}
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  )}
                                </div>

                                {/* Preview Mode: Show Configuration Summary */}
                                {isPreviewMode && (
                                  <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                                    <div className="text-sm text-slate-600">
                                      {item.type === "VOCABULARY_DECK" && (
                                        <div className="space-y-1">
                                          <p>
                                            <strong>Deck:</strong>{" "}
                                            {decks.find((d) => d.id === item.config.deckId)?.name || "Not selected"}
                                          </p>
                                          <p>
                                            <strong>New Cards:</strong> {item.config.newCards || 10}
                                          </p>
                                          <p>
                                            <strong>Max Due:</strong> {item.config.maxDue || 50}
                                          </p>
                                          <p>
                                            <strong>Min Due:</strong> {item.config.minDue || 10}
                                          </p>
                                        </div>
                                      )}
                                      {item.type === "LISTENING_EXERCISE" && (
                                        <div className="space-y-1">
                                          <p>
                                            <strong>Audio:</strong>{" "}
                                            {item.config.audioUrl ? "✓ Configured" : "⚠ Not set"}
                                          </p>
                                          <p>
                                            <strong>Multiple Attempts:</strong>{" "}
                                            {item.config.allowMultipleAttempts ? "Yes" : "No"}
                                          </p>
                                        </div>
                                      )}
                                      {item.type === "GRAMMAR_EXERCISE" && (
                                        <div className="space-y-1">
                                          <p>
                                            <strong>Topic:</strong> {item.config.grammarTopic || "Not specified"}
                                          </p>
                                          <p>
                                            <strong>Difficulty:</strong> {item.config.difficulty || "Intermediate"}
                                          </p>
                                        </div>
                                      )}
                                      {item.type === "VOCAB_FILL_IN_BLANK_EXERCISE" && (
                                        <div className="space-y-1">
                                          <p>
                                            <strong>Sentences:</strong> {item.config.sentences?.length || 0}
                                          </p>
                                          <p>
                                            <strong>Word Bank:</strong>{" "}
                                            {item.config.allowWordBank ? "Enabled" : "Disabled"}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Configuration Dialog */}
      {renderItemConfigDialog()}

      {/* Validation Alerts */}
      {unitItems.some(
        (item) =>
          (item.type === "VOCABULARY_DECK" && !item.config.deckId) ||
          (item.type === "LISTENING_EXERCISE" && !item.config.audioUrl) ||
          !item.config.title,
      ) && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Some exercises are missing required configuration. Please review and complete all exercise settings before
              saving.
            </AlertDescription>
          </Alert>
        )}
    </div>
  )
}
