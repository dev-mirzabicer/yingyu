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
  PencilLine,
  Target,
  Settings,
  Layers,
  Clock,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  useUnits,
  useUnit,
  useDecks,
  useFillInTheBlankDecks,
  useGenericDecks,
  createUnit,
  updateUnit,
  addExerciseToUnit,
  reorderUnitItems,
  removeUnitItem,
  updateUnitItemConfig,
} from "@/hooks/api/content"
import type { NewUnitItemData } from "@/lib/types"
import type { Unit, UnitItemType } from "@prisma/client"
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
  defaultConfig: unknown
}

interface DraggableUnitItem {
  id: string
  type: UnitItemType
  title: string
  config: unknown
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
    id: "fill-in-the-blank",
    type: "FILL_IN_THE_BLANK_EXERCISE",
    title: "Fill in the Blank",
    description: "Sentence completion practice",
    icon: PencilLine,
    defaultConfig: {
      deckId: "",
      vocabularyConfidenceThreshold: 0.8,
    },
  },
  {
    id: "generic-deck",
    type: "GENERIC_DECK",
    title: "Generic Deck",
    description: "Spaced repetition practice with custom front/back cards",
    icon: Layers,
    defaultConfig: {
      deckId: "",
      newCards: 10,
      maxDue: 50,
      minDue: 10,
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
  const { mutate: mutateUnits } = useUnits() // Keep for mutation
  const { unit: fullUnitData } = useUnit(unitId || ""); // Use the specific hook
  const { decks } = useDecks()
  const { decks: fillInTheBlankDecks } = useFillInTheBlankDecks()
  const { decks: genericDecks } = useGenericDecks()

  const [unitData, setUnitData] = useState({
    name: "",
    description: "",
    isPublic: false,
    estimatedMinimumDuration: 0, // Add missing property
    estimatedMaximumDuration: 0, // Add missing property
  })

  const [unitItems, setUnitItems] = useState<DraggableUnitItem[]>([])
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<DraggableUnitItem | null>(null)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const { toast } = useToast()

  // Load existing unit data if editing
  useEffect(() => {
    if (unitId && fullUnitData) {
      const existingUnit = fullUnitData
      if (existingUnit) {
        setUnitData({
          name: existingUnit.name,
          description: existingUnit.description || "",
          isPublic: existingUnit.isPublic,
          estimatedMinimumDuration: existingUnit.estimatedMinimumDuration || 0,
          estimatedMaximumDuration: existingUnit.estimatedMaximumDuration || 0,
        })

        // Convert unit items to draggable format
        const draggableItems: DraggableUnitItem[] =
          existingUnit.items?.map((item) => ({
            id: item.id,
            type: item.type,
            title:
              item.vocabularyDeck?.name ||
              item.listeningExercise?.title ||
              item.grammarExercise?.title ||
              item.fillInTheBlankDeck?.name ||
              item.genericDeck?.name ||
              "Untitled",
            config: item.config || {},
            order: item.order,
            estimatedDuration: 15, // This would be calculated based on item type and config
          })) || []

        setUnitItems(draggableItems)
      }
    }
  }, [unitId, fullUnitData])

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
        console.error("Failed to save order:", error)
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
      console.error("Failed to remove item:", error)
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
      console.error("Failed to save configuration:", error)
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
          // Add new item - handle different exercise types
          let itemData: NewUnitItemData

          if (item.type === 'VOCABULARY_DECK') {
            if (item.config.deckId) {
              // Existing deck mode
              itemData = {
                type: 'VOCABULARY_DECK',
                order: item.order,
                config: item.config,
                mode: 'existing',
                existingDeckId: item.config.deckId,
              }
            } else {
              // New deck mode
              itemData = {
                type: 'VOCABULARY_DECK',
                order: item.order,
                config: item.config,
                mode: 'new',
                data: {
                  name: item.title || "Untitled Vocabulary Deck",
                  description: "",
                  isPublic: false,
                },
              }
            }
          } else if (item.type === 'LISTENING_EXERCISE') {
            // Listening exercises always reference existing decks
            if (!item.config.deckId) {
              throw new Error(`Listening exercise "${item.title}" must have a vocabulary deck selected.`)
            }
            itemData = {
              type: 'LISTENING_EXERCISE',
              order: item.order,
              config: item.config,
              mode: 'existing',
              existingDeckId: item.config.deckId,
              data: {
                title: item.title || "Untitled Listening Exercise",
                difficultyLevel: 1,
                explanation: "",
                tags: [],
                isPublic: false,
              },
            }
          } else if (item.type === 'GRAMMAR_EXERCISE') {
            itemData = {
              type: 'GRAMMAR_EXERCISE',
              order: item.order,
              config: item.config,
              data: {
                title: item.title || "Untitled Grammar Exercise",
                grammarTopic: item.config.grammarTopic || "General",
                difficultyLevel: item.config.difficulty || 1,
                exerciseData: item.config.exerciseData || {},
                explanation: "",
                tags: [],
                isPublic: false,
              },
            }
          } else if (item.type === 'FILL_IN_THE_BLANK_EXERCISE') {
            // Fill in the blank exercises always reference existing decks
            if (!item.config.deckId) {
              throw new Error(`Fill-in-the-blank exercise "${item.title}" must have a deck selected.`)
            }
            itemData = {
              type: 'FILL_IN_THE_BLANK_EXERCISE',
              order: item.order,
              config: item.config,
              mode: 'existing',
              existingDeckId: item.config.deckId,
            }
          } else if (item.type === 'GENERIC_DECK') {
            // Generic deck exercises always reference existing decks
            if (!item.config.deckId) {
              throw new Error(`Generic deck exercise "${item.title}" must have a deck selected.`)
            }
            itemData = {
              type: 'GENERIC_DECK',
              order: item.order,
              config: item.config,
              mode: 'existing',
              existingDeckId: item.config.deckId,
            }
          } else {
            // This should not happen with current exercise types
            throw new Error(`Unsupported exercise type: ${item.type}`)
          }

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
      console.error("Failed to save unit:", error)
      toast({
        title: "Error",
        description: "Failed to save unit. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
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
          <Label htmlFor="listeningTitle">Exercise Title *</Label>
          <Input
            id="listeningTitle"
            value={editingItem.title || ""}
            onChange={(e) =>
              setEditingItem({
                ...editingItem,
                title: e.target.value,
              })
            }
            placeholder="Enter listening exercise title"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="listeningDeckId">Vocabulary Deck *</Label>
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
              <SelectValue placeholder="Select a deck for listening practice" />
            </SelectTrigger>
            <SelectContent>
              {decks.map((deck) => (
                <SelectItem key={deck.id} value={deck.id}>
                  {deck.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-slate-500">
            Students will practice listening to audio from this vocabulary deck
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="listeningNewCards">New Cards</Label>
            <Input
              id="listeningNewCards"
              type="number"
              min="0"
              max="50"
              value={editingItem.config.newCards || 5}
              onChange={(e) =>
                setEditingItem({
                  ...editingItem,
                  config: { ...editingItem.config, newCards: Number.parseInt(e.target.value) },
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="listeningMaxDue">Max Due Cards</Label>
            <Input
              id="listeningMaxDue"
              type="number"
              min="0"
              max="200"
              value={editingItem.config.maxDue || 25}
              onChange={(e) =>
                setEditingItem({
                  ...editingItem,
                  config: { ...editingItem.config, maxDue: Number.parseInt(e.target.value) },
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="listeningMinDue">Min Due Cards</Label>
            <Input
              id="listeningMinDue"
              type="number"
              min="0"
              max="50"
              value={editingItem.config.minDue || 0}
              onChange={(e) =>
                setEditingItem({
                  ...editingItem,
                  config: { ...editingItem.config, minDue: Number.parseInt(e.target.value) },
                })
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="vocabConfidenceThreshold">Vocabulary Confidence Threshold</Label>
            <Input
              id="vocabConfidenceThreshold"
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={editingItem.config.vocabularyConfidenceThreshold || 0.8}
              onChange={(e) =>
                setEditingItem({
                  ...editingItem,
                  config: { ...editingItem.config, vocabularyConfidenceThreshold: Number.parseFloat(e.target.value) },
                })
              }
            />
            <p className="text-sm text-slate-500">Minimum vocabulary retrievability (0.0-1.0)</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="listeningCandidateThreshold">Listening Readiness Threshold</Label>
            <Input
              id="listeningCandidateThreshold"
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={editingItem.config.listeningCandidateThreshold || 0.6}
              onChange={(e) =>
                setEditingItem({
                  ...editingItem,
                  config: { ...editingItem.config, listeningCandidateThreshold: Number.parseFloat(e.target.value) },
                })
              }
            />
            <p className="text-sm text-slate-500">Minimum threshold for listening readiness (0.0-1.0)</p>
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

    const renderFillInTheBlankConfig = () => (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fillInTheBlankDeckId">Fill-in-the-Blank Deck *</Label>
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
              <SelectValue placeholder="Select a fill-in-the-blank deck" />
            </SelectTrigger>
            <SelectContent>
              {fillInTheBlankDecks.map((deck) => (
                <SelectItem key={deck.id} value={deck.id}>
                  {deck.name} ({deck._count?.cards || 0} cards)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-slate-500">
            Students will practice with fill-in-the-blank cards from this deck
          </p>
        </div>

        {/* Conditional Vocabulary Confidence Threshold */}
        {(() => {
          const selectedDeck = fillInTheBlankDecks.find(deck => deck.id === editingItem.config.deckId)
          const hasVocabularyBinding = selectedDeck && selectedDeck.boundVocabularyDeckId
          
          if (!hasVocabularyBinding) return null
          
          return (
            <div className="space-y-2">
              <Label htmlFor="vocabularyConfidenceThreshold">
                Vocabulary Confidence Threshold ({editingItem.config.vocabularyConfidenceThreshold || 0.8})
              </Label>
              <div className="px-3">
                <input
                  id="vocabularyConfidenceThreshold"
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={editingItem.config.vocabularyConfidenceThreshold || 0.8}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      config: { ...editingItem.config, vocabularyConfidenceThreshold: parseFloat(e.target.value) },
                    })
                  }
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>0.0 (All words)</span>
                  <span>1.0 (Only confident)</span>
                </div>
              </div>
              <p className="text-sm text-slate-500">
                Only show fill-in-the-blank cards where the student&apos;s vocabulary confidence is above this threshold.
                This deck is bound to a vocabulary deck, enabling smart card filtering.
              </p>
            </div>
          )
        })()}
      </div>
    )

    const renderGenericDeckConfig = () => (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="genericDeckId">Generic Deck *</Label>
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
              <SelectValue placeholder="Select a generic deck" />
            </SelectTrigger>
            <SelectContent>
              {genericDecks.map((deck) => (
                <SelectItem key={deck.id} value={deck.id}>
                  {deck.name} ({deck._count?.cards || 0} cards)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-slate-500">
            Students will practice with generic cards from this deck
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="genericNewCards">New Cards</Label>
            <Input
              id="genericNewCards"
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
            <Label htmlFor="genericMaxDue">Max Due Cards</Label>
            <Input
              id="genericMaxDue"
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
            <Label htmlFor="genericMinDue">Min Due Cards</Label>
            <Input
              id="genericMinDue"
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

        {/* Note about vocabulary binding */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Vocabulary Binding:</strong> To bind this generic deck to a vocabulary deck for enhanced features, 
            use the auto-bind function in the Generic Deck management page.
          </p>
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
              {editingItem.type === "FILL_IN_THE_BLANK_EXERCISE" && renderFillInTheBlankConfig()}
              {editingItem.type === "GENERIC_DECK" && renderGenericDeckConfig()}

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
                                            <strong>Deck:</strong>{" "}
                                            {item.config.deckId 
                                              ? decks.find(d => d.id === item.config.deckId)?.name || "Selected" 
                                              : "⚠ Not selected"}
                                          </p>
                                          <p>
                                            <strong>New Cards:</strong> {item.config.newCards || 5}
                                          </p>
                                          <p>
                                            <strong>Max Due:</strong> {item.config.maxDue || 25}
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
                                      {item.type === "FILL_IN_THE_BLANK_EXERCISE" && (
                                        <div className="space-y-1">
                                          <p>
                                            <strong>Deck:</strong>{" "}
                                            {fillInTheBlankDecks.find((d) => d.id === item.config.deckId)?.name || "Not selected"}
                                          </p>
                                          {(() => {
                                            const selectedDeck = fillInTheBlankDecks.find(deck => deck.id === item.config.deckId)
                                            const hasVocabularyBinding = selectedDeck && selectedDeck.boundVocabularyDeckId
                                            
                                            if (!hasVocabularyBinding) return null
                                            
                                            return (
                                              <p>
                                                <strong>Vocab Threshold:</strong> {item.config.vocabularyConfidenceThreshold || 0.8}
                                              </p>
                                            )
                                          })()}
                                        </div>
                                      )}
                                      {item.type === "GENERIC_DECK" && (
                                        <div className="space-y-1">
                                          <p>
                                            <strong>Deck:</strong>{" "}
                                            {genericDecks.find((d) => d.id === item.config.deckId)?.name || "Not selected"}
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
          (item.type === "LISTENING_EXERCISE" && !item.config.deckId) ||
          (item.type === "FILL_IN_THE_BLANK_EXERCISE" && !item.config.deckId) ||
          (item.type === "GENERIC_DECK" && !item.config.deckId) ||
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
