"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { BookOpen, FileText, Mic, GripVertical, MoreHorizontal, Plus, Settings, Trash2, Save, Edit3 } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { useUnit, updateUnit, addExerciseToUnit, useDecks } from "@/hooks/use-api-enhanced"
import { UnitItemType } from "@prisma/client"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface UnitEditorProps {
  unitId: string
}

const exerciseTypes = [
  {
    type: "VOCABULARY_DECK",
    label: "Vocabulary Deck",
    icon: BookOpen,
    color: "bg-blue-100 text-blue-700"
  },
  {
    type: "GRAMMAR_EXERCISE",
    label: "Grammar Exercise",
    icon: FileText,
    color: "bg-green-100 text-green-700"
  },
]

export function UnitEditor({ unitId }: UnitEditorProps) {
  const { unit, isLoading, isError, mutate } = useUnit(unitId)
  const { decks, isLoading: decksLoading } = useDecks()
  const [unitName, setUnitName] = useState("")
  const [isPublic, setIsPublic] = useState(false)
  const [isAddExerciseOpen, setIsAddExerciseOpen] = useState(false)
  const [selectedExerciseType, setSelectedExerciseType] = useState<UnitItemType | "">("")
  const [addMode, setAddMode] = useState<"new" | "existing">("existing")
  const [selectedExistingDeckId, setSelectedExistingDeckId] = useState("")
  const [newExerciseName, setNewExerciseName] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isAddingExercise, setIsAddingExercise] = useState(false)
  const { toast } = useToast()

  // Add handlers for configure and remove actions
  const handleConfigureExercise = (itemId: string) => {
    toast({
      title: "Configure Exercise",
      description: "Exercise configuration coming soon!",
    })
  }

  const handleRemoveExercise = async (itemId: string, exerciseName: string) => {
    if (!confirm(`Are you sure you want to remove "${exerciseName}" from this unit?`)) {
      return
    }
    
    try {
      // Call the API to remove the unit item
      await fetch(`/api/units/${unitId}/items/${itemId}`, {
        method: 'DELETE',
        headers: {
          'X-Teacher-ID': 'teacher-1', // This should come from auth
        },
      })
      
      toast({
        title: "Exercise removed",
        description: `${exerciseName} has been removed from the unit.`,
      })
      
      // Refresh the unit data
      mutate()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove exercise. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Initialize form when unit data loads
  React.useEffect(() => {
    if (unit) {
      setUnitName(unit.name)
      setIsPublic(unit.isPublic)
    }
  }, [unit])

  const handleSave = async () => {
    if (!unit || !unitName) return

    setIsSaving(true)
    try {
      await updateUnit(unit.id, {
        name: unitName,
        isPublic: isPublic,
      })
      toast({
        title: "Unit saved",
        description: "Your changes have been saved successfully.",
      })
      mutate()
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

  const handleAddExercise = async () => {
    if (!selectedExerciseType) {
      toast({
        title: "Error",
        description: "Please select exercise type.",
        variant: "destructive",
      })
      return
    }

    // Validation based on mode and type
    if (selectedExerciseType === "VOCABULARY_DECK") {
      if (addMode === "existing" && !selectedExistingDeckId) {
        toast({
          title: "Error", 
          description: "Please select an existing deck.",
          variant: "destructive",
        })
        return
      }
      if (addMode === "new" && !newExerciseName) {
        toast({
          title: "Error",
          description: "Please enter a name for the new deck.",
          variant: "destructive",
        })
        return
      }
    } else if (selectedExerciseType === "GRAMMAR_EXERCISE" && !newExerciseName) {
      toast({
        title: "Error",
        description: "Please enter a name for the exercise.",
        variant: "destructive",
      })
      return
    }

    setIsAddingExercise(true)
    try {
      let unitItemData;
      
      if (selectedExerciseType === "VOCABULARY_DECK") {
        if (addMode === "existing") {
          unitItemData = {
            type: "VOCABULARY_DECK" as const,
            mode: "existing" as const,
            existingDeckId: selectedExistingDeckId,
          };
        } else {
          unitItemData = {
            type: "VOCABULARY_DECK" as const,
            mode: "new" as const,
            data: {
              name: newExerciseName,
              isPublic: false,
            },
          };
        }
      } else if (selectedExerciseType === "GRAMMAR_EXERCISE") {
        unitItemData = {
          type: "GRAMMAR_EXERCISE" as const,
          data: {
            title: newExerciseName,
            grammarTopic: "General",
            exerciseData: {},
            isPublic: false,
          },
        };
      } else {
        throw new Error("Unsupported exercise type");
      }
      
      await addExerciseToUnit(unitId, unitItemData)
      
      const exerciseName = selectedExerciseType === "VOCABULARY_DECK" && addMode === "existing" 
        ? decks.find(d => d.id === selectedExistingDeckId)?.name || "Selected deck"
        : newExerciseName;
      
      toast({
        title: "Exercise added",
        description: `${exerciseName} has been added to the unit.`,
      })
      setIsAddExerciseOpen(false)
      setSelectedExerciseType("")
      setNewExerciseName("")
      setSelectedExistingDeckId("")
      setAddMode("existing")
      mutate()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add exercise. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsAddingExercise(false)
    }
  }

  const getExerciseTypeInfo = (type: UnitItemType) => {
    const typeMap: Record<UnitItemType, { label: string; icon: any; color: string }> = {
      [UnitItemType.VOCABULARY_DECK]: {
        label: "Vocabulary",
        icon: BookOpen,
        color: "bg-blue-100 text-blue-700"
      },
      [UnitItemType.GRAMMAR_EXERCISE]: {
        label: "Grammar",
        icon: FileText,
        color: "bg-green-100 text-green-700"
      },
      [UnitItemType.LISTENING_EXERCISE]: {
        label: "Listening",
        icon: Mic,
        color: "bg-purple-100 text-purple-700"
      },
      [UnitItemType.VOCAB_FILL_IN_BLANK_EXERCISE]: {
        label: "Fill in Blank",
        icon: FileText,
        color: "bg-orange-100 text-orange-700"
      },
    }
    return typeMap[type] || { label: "Unknown", icon: FileText, color: "bg-gray-100 text-gray-700" }
  }

  if (isError) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-slate-600">Failed to load unit. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading || !unit) {
    return (
      <div className="p-6 space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-64" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-6 w-48" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
    )
  }

  return (
    <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-slate-900">Edit Unit</h1>
            <p className="text-slate-600">Configure unit settings and manage exercises</p>
          </div>
          <Button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save Unit"}
          </Button>
        </div>

        {/* Unit Header */}
        <Card>
          <CardHeader>
            <CardTitle>Unit Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="unit-name">Unit Name</Label>
              <Input
                id="unit-name"
                value={unitName}
                onChange={(e) => setUnitName(e.target.value)}
                placeholder="Enter unit name"
                disabled={isSaving}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="unit-public"
                checked={isPublic}
                onCheckedChange={setIsPublic}
                disabled={isSaving}
              />
              <Label htmlFor="unit-public">Make this unit public</Label>
            </div>
          </CardContent>
        </Card>

        {/* Unit Items */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Exercises ({unit.items.length})</CardTitle>
              <Button onClick={() => setIsAddExerciseOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Add Exercise
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {unit.items.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 mb-4">No exercises added yet</p>
                <Button onClick={() => setIsAddExerciseOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                  Add Your First Exercise
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {unit.items.map((item) => {
                  const typeInfo = getExerciseTypeInfo(item.type)
                  const Icon = typeInfo.icon

                  return (
                    <Card key={item.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                              <GripVertical className="h-4 w-4 text-slate-400 cursor-move" />
                              <span className="text-sm font-medium text-slate-500">#{item.order}</span>
                            </div>
                            <div className={`p-2 rounded-lg ${typeInfo.color}`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div>
                              <h3 className="font-medium text-slate-900">
                                {item.vocabularyDeck?.name ||
                                  item.grammarExercise?.title ||
                                  item.listeningExercise?.title ||
                                  item.vocabFillInBlankExercise?.title ||
                                  'Unnamed Exercise'}
                              </h3>
                              <Badge variant="secondary" className="text-xs">
                                {typeInfo.label}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {item.type === 'VOCABULARY_DECK' && item.vocabularyDeck && (
                              <Link href={`/decks/${item.vocabularyDeck.id}/manage`}>
                                <Button variant="outline" size="sm">
                                  <Edit3 className="h-4 w-4 mr-2" />
                                  Manage Cards
                                </Button>
                              </Link>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleConfigureExercise(item.id)}>
                                  <Settings className="mr-2 h-4 w-4" />
                                  Configure
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className="text-red-600"
                                  onClick={() => handleRemoveExercise(item.id, 
                                    item.vocabularyDeck?.name || 
                                    item.grammarExercise?.title || 
                                    item.listeningExercise?.title || 
                                    "Exercise"
                                  )}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Remove
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Exercise Dialog */}
        <Dialog open={isAddExerciseOpen} onOpenChange={setIsAddExerciseOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Exercise</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="space-y-3">
                <Label>Exercise Type</Label>
                <div className="grid grid-cols-1 gap-2">
                  {exerciseTypes.map((type) => {
                    const Icon = type.icon
                    return (
                      <Button
                        key={type.type}
                        variant={selectedExerciseType === type.type ? "default" : "outline"}
                        className="justify-start h-auto p-4"
                        onClick={() => setSelectedExerciseType(type.type as UnitItemType)}
                        disabled={isAddingExercise}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-lg ${type.color}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="text-left">
                            <div className="font-medium">{type.label}</div>
                          </div>
                        </div>
                      </Button>
                    )
                  })}
                </div>
              </div>

              {selectedExerciseType === "VOCABULARY_DECK" && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <Label>Add Mode</Label>
                    <RadioGroup 
                      value={addMode} 
                      onValueChange={(value) => setAddMode(value as "new" | "existing")}
                      disabled={isAddingExercise}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="existing" id="existing" />
                        <Label htmlFor="existing">Link Existing Deck</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="new" id="new" />
                        <Label htmlFor="new">Create New Deck</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {addMode === "existing" && (
                    <div className="space-y-2">
                      <Label htmlFor="existing-deck">Select Existing Deck</Label>
                      {decksLoading ? (
                        <div className="h-10 bg-gray-100 rounded animate-pulse" />
                      ) : (
                        <Select 
                          value={selectedExistingDeckId} 
                          onValueChange={setSelectedExistingDeckId}
                          disabled={isAddingExercise}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a deck..." />
                          </SelectTrigger>
                          <SelectContent>
                            {decks.map((deck) => (
                              <SelectItem key={deck.id} value={deck.id}>
                                <div className="flex items-center justify-between w-full">
                                  <span>{deck.name}</span>
                                  <span className="text-sm text-gray-500 ml-2">
                                    {(deck as any)._count?.cards || 0} cards
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {decks.length === 0 && !decksLoading && (
                        <p className="text-sm text-gray-500">No decks available. Create a deck first.</p>
                      )}
                    </div>
                  )}

                  {addMode === "new" && (
                    <div className="space-y-2">
                      <Label htmlFor="new-deck-name">New Deck Name</Label>
                      <Input
                        id="new-deck-name"
                        placeholder="Enter deck name"
                        value={newExerciseName}
                        onChange={(e) => setNewExerciseName(e.target.value)}
                        disabled={isAddingExercise}
                      />
                    </div>
                  )}
                </div>
              )}

              {selectedExerciseType === "GRAMMAR_EXERCISE" && (
                <div className="space-y-2">
                  <Label htmlFor="exercise-name">Exercise Name</Label>
                  <Input
                    id="exercise-name"
                    placeholder="Enter exercise name"
                    value={newExerciseName}
                    onChange={(e) => setNewExerciseName(e.target.value)}
                    disabled={isAddingExercise}
                  />
                </div>
              )}

              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setIsAddExerciseOpen(false)}
                  disabled={isAddingExercise}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddExercise}
                  disabled={isAddingExercise || !selectedExerciseType || 
                    (selectedExerciseType === "VOCABULARY_DECK" && 
                      ((addMode === "existing" && !selectedExistingDeckId) || 
                       (addMode === "new" && !newExerciseName))) ||
                    (selectedExerciseType === "GRAMMAR_EXERCISE" && !newExerciseName)
                  }
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isAddingExercise ? "Adding..." : "Add Exercise"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
  )
}
