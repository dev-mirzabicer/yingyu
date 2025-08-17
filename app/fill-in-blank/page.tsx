"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable } from "@/components/data-table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Edit3, Plus, Search, FileText, Users, Globe, Lock, BookOpen, ArrowRight } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useFillInBlankExercises, createFillInBlankExercise, useDecks } from "@/hooks/api"
import { format } from "date-fns"
import Link from "next/link"

export default function FillInBlankPage() {
  const [isCreateExerciseOpen, setIsCreateExerciseOpen] = useState(false)
  const [newExercise, setNewExercise] = useState({ 
    title: "", 
    vocabularyDeckId: "", 
    explanation: "", 
    isPublic: false 
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [filterVisibility, setFilterVisibility] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedDeckFilter, setSelectedDeckFilter] = useState<string>("all")

  const { toast } = useToast()
  const { exercises, isLoading, isError, mutate } = useFillInBlankExercises()
  const { decks } = useDecks()

  const handleCreateExercise = async () => {
    if (!newExercise.title || !newExercise.vocabularyDeckId) {
      toast({
        title: "Error",
        description: "Please enter an exercise title and select a vocabulary deck.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      await createFillInBlankExercise(newExercise)
      toast({
        title: "Exercise created successfully",
        description: `${newExercise.title} has been created.`,
      })
      setNewExercise({ title: "", vocabularyDeckId: "", explanation: "", isPublic: false })
      setIsCreateExerciseOpen(false)
      mutate()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create exercise. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Filter exercises based on visibility, search, and deck
  const filteredExercises = exercises.filter(exercise => {
    const matchesVisibility = filterVisibility === "all" || 
      (filterVisibility === "public" ? exercise.isPublic : !exercise.isPublic)
    const matchesSearch = exercise.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (exercise.explanation && exercise.explanation.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesDeck = selectedDeckFilter === "all" || exercise.vocabularyDeckId === selectedDeckFilter
    return matchesVisibility && matchesSearch && matchesDeck
  })

  const exerciseColumns = [
    {
      key: "title",
      header: "Exercise Title",
      render: (value: string, row: any) => (
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Edit3 className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <div className="font-medium text-slate-900">{value}</div>
            <div className="text-sm text-slate-500">
              Bound to: {row.vocabularyDeck?.name || "Unknown deck"}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "vocabularyDeck",
      header: "Vocabulary Deck",
      render: (value: any) => (
        <div className="flex items-center space-x-2">
          <BookOpen className="h-4 w-4 text-slate-400" />
          <div>
            <div className="font-medium text-slate-700">{value?.name || "Unknown"}</div>
            <div className="text-sm text-slate-500">{value?._count?.cards || 0} cards</div>
          </div>
        </div>
      ),
    },
    {
      key: "isPublic",
      header: "Visibility",
      render: (value: boolean) => (
        <div className="flex items-center space-x-2">
          {value ? <Globe className="h-4 w-4 text-green-600" /> : <Lock className="h-4 w-4 text-slate-400" />}
          <Badge variant={value ? "default" : "secondary"}>
            {value ? "Public" : "Private"}
          </Badge>
        </div>
      ),
    },
    {
      key: "_count",
      header: "Usage",
      render: (value: any, row: any) => (
        <div className="text-center">
          <Badge variant="outline" className="text-sm">
            {row.unitItem ? 1 : 0} units
          </Badge>
        </div>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      render: (value: string) => format(new Date(value), "MMM dd, yyyy"),
    },
    {
      key: "actions",
      header: "Actions",
      render: (_: any, row: any) => (
        <div className="flex items-center space-x-2">
          <Link href={`/fill-in-blank/${row.id}/manage`}>
            <Button variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-2" />
              Manage Cards
            </Button>
          </Link>
          <Button variant="outline" size="sm">
            <ArrowRight className="h-4 w-4 mr-2" />
            Add to Unit
          </Button>
        </div>
      ),
    },
  ]

  // Calculate stats
  const publicExercises = exercises.filter(e => e.isPublic)
  const totalUnits = exercises.reduce((sum, exercise) => sum + (exercise.unitItem ? 1 : 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">Fill-in-Blank Exercises</h1>
          <p className="text-slate-600">Create and manage fill-in-blank exercises bound to your vocabulary decks</p>
        </div>
        <Button onClick={() => setIsCreateExerciseOpen(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Create Exercise
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Edit3 className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">Total Exercises</p>
                <p className="text-2xl font-bold text-slate-900">{exercises.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">Used in Units</p>
                <p className="text-2xl font-bold text-slate-900">{totalUnits}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Globe className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">Public Exercises</p>
                <p className="text-2xl font-bold text-slate-900">{publicExercises.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search exercises..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedDeckFilter} onValueChange={setSelectedDeckFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by deck" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Decks</SelectItem>
                {decks.map(deck => (
                  <SelectItem key={deck.id} value={deck.id}>
                    {deck.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterVisibility} onValueChange={setFilterVisibility}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by visibility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Exercises</SelectItem>
                <SelectItem value="private">Private</SelectItem>
                <SelectItem value="public">Public</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline" className="text-sm">
              {filteredExercises.length} of {exercises.length} exercises
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Exercises Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Exercises</CardTitle>
        </CardHeader>
        <CardContent>
          {isError ? (
            <div className="text-center py-8">
              <p className="text-slate-600">Failed to load exercises. Please try again.</p>
            </div>
          ) : isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="h-12 w-12 bg-slate-200 rounded-lg animate-pulse" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-48 bg-slate-200 rounded animate-pulse" />
                    <div className="h-3 w-32 bg-slate-200 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredExercises.length === 0 ? (
            <div className="text-center py-12">
              <Edit3 className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-4">
                {searchTerm || selectedDeckFilter !== "all" || filterVisibility !== "all" 
                  ? "No exercises match your filters" 
                  : "No exercises created yet"}
              </p>
              {!searchTerm && selectedDeckFilter === "all" && filterVisibility === "all" && (
                <Button onClick={() => setIsCreateExerciseOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                  Create Your First Exercise
                </Button>
              )}
            </div>
          ) : (
            <DataTable data={filteredExercises} columns={exerciseColumns} pageSize={10} />
          )}
        </CardContent>
      </Card>

      {/* Create Exercise Dialog */}
      <Dialog open={isCreateExerciseOpen} onOpenChange={setIsCreateExerciseOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Fill-in-Blank Exercise</DialogTitle>
            <DialogDescription>
              Create a new fill-in-blank exercise bound to one of your vocabulary decks.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="exercise-title">Exercise Title</Label>
              <Input
                id="exercise-title"
                placeholder="Enter exercise title"
                value={newExercise.title}
                onChange={(e) => setNewExercise({ ...newExercise, title: e.target.value })}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vocabulary-deck">Vocabulary Deck</Label>
              <Select 
                value={newExercise.vocabularyDeckId} 
                onValueChange={(value) => setNewExercise({ ...newExercise, vocabularyDeckId: value })}
                disabled={isSubmitting}
              >
                <SelectTrigger id="vocabulary-deck">
                  <SelectValue placeholder="Select a vocabulary deck..." />
                </SelectTrigger>
                <SelectContent>
                  {decks.map(deck => (
                    <SelectItem key={deck.id} value={deck.id}>
                      <div className="flex items-center space-x-2">
                        <BookOpen className="h-4 w-4" />
                        <span>{deck.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {deck._count?.cards || 0} cards
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="exercise-explanation">Explanation (Optional)</Label>
              <Textarea
                id="exercise-explanation"
                placeholder="Describe this exercise or provide instructions..."
                value={newExercise.explanation}
                onChange={(e) => setNewExercise({ ...newExercise, explanation: e.target.value })}
                disabled={isSubmitting}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="exercise-public"
                checked={newExercise.isPublic}
                onCheckedChange={(checked) => setNewExercise({ ...newExercise, isPublic: checked })}
                disabled={isSubmitting}
              />
              <Label htmlFor="exercise-public">Make this exercise public</Label>
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setIsCreateExerciseOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateExercise}
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? "Creating..." : "Create Exercise"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}