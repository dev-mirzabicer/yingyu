"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable } from "@/components/data-table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { BookOpen, Plus, Search, FileText, Users, Globe, Lock } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useDecks } from "@/hooks/use-api-enhanced"
import { format } from "date-fns"

export default function DecksPage() {
  const [isCreateDeckOpen, setIsCreateDeckOpen] = useState(false)
  const [newDeck, setNewDeck] = useState({ name: "", description: "", isPublic: false })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [filterVisibility, setFilterVisibility] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")

  const { toast } = useToast()
  const { decks, isLoading, isError, mutate } = useDecks()

  const handleCreateDeck = async () => {
    if (!newDeck.name) {
      toast({
        title: "Error",
        description: "Please enter a deck name.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      // This would use a createDeck function from enhanced API hooks
      // await createDeck(newDeck)
      toast({
        title: "Deck created successfully",
        description: `${newDeck.name} has been created.`,
      })
      setNewDeck({ name: "", description: "", isPublic: false })
      setIsCreateDeckOpen(false)
      mutate()
    } catch (error) {
      toast({
        title: "Error", 
        description: "Failed to create deck. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Filter decks based on visibility and search
  const filteredDecks = decks.filter(deck => {
    const matchesVisibility = filterVisibility === "all" || (filterVisibility === "public" ? deck.isPublic : !deck.isPublic)
    const matchesSearch = deck.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (deck.description && deck.description.toLowerCase().includes(searchTerm.toLowerCase()))
    return matchesVisibility && matchesSearch
  })

  const deckColumns = [
    {
      key: "name",
      header: "Deck Name",
      render: (value: string, row: any) => (
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <BookOpen className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <div className="font-medium text-slate-900">{value}</div>
            <div className="text-sm text-slate-500">0 cards</div>
          </div>
        </div>
      ),
    },
    {
      key: "description",
      header: "Description",
      render: (value: string) => (
        <span className="text-slate-600">{value || "No description"}</span>
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
      key: "createdAt",
      header: "Created",
      render: (value: string) => format(new Date(value), "MMM dd, yyyy"),
    },
    {
      key: "actions",
      header: "Actions",
      render: (_: any, row: any) => (
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <FileText className="h-4 w-4 mr-2" />
            Manage Cards
          </Button>
          <Button variant="outline" size="sm">
            <Users className="h-4 w-4 mr-2" />
            Assign
          </Button>
        </div>
      ),
    },
  ]

  // Calculate stats
  const publicDecks = decks.filter(d => d.isPublic)
  const totalCards = 0 // TODO: Would be calculated from deck card counts when available

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">Vocabulary Decks</h1>
          <p className="text-slate-600">Create and manage vocabulary card decks for your students</p>
        </div>
        <Button onClick={() => setIsCreateDeckOpen(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Create Deck
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">Total Decks</p>
                <p className="text-2xl font-bold text-slate-900">{decks.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">Total Cards</p>
                <p className="text-2xl font-bold text-slate-900">{totalCards}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Globe className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">Public Decks</p>
                <p className="text-2xl font-bold text-slate-900">{publicDecks.length}</p>
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
                  placeholder="Search decks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterVisibility} onValueChange={setFilterVisibility}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by visibility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Decks</SelectItem>
                <SelectItem value="private">Private</SelectItem>
                <SelectItem value="public">Public</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline" className="text-sm">
              {filteredDecks.length} of {decks.length} decks
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Decks Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Decks</CardTitle>
        </CardHeader>
        <CardContent>
          {isError ? (
            <div className="text-center py-8">
              <p className="text-slate-600">Failed to load decks. Please try again.</p>
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
          ) : filteredDecks.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-4">
                {searchTerm || filterVisibility !== "all" ? "No decks match your filters" : "No decks created yet"}
              </p>
              {!searchTerm && filterVisibility === "all" && (
                <Button onClick={() => setIsCreateDeckOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                  Create Your First Deck
                </Button>
              )}
            </div>
          ) : (
            <DataTable data={filteredDecks} columns={deckColumns} pageSize={10} />
          )}
        </CardContent>
      </Card>

      {/* Create Deck Dialog */}
      <Dialog open={isCreateDeckOpen} onOpenChange={setIsCreateDeckOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Deck</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deck-name">Deck Name</Label>
              <Input
                id="deck-name"
                placeholder="Enter deck name"
                value={newDeck.name}
                onChange={(e) => setNewDeck({ ...newDeck, name: e.target.value })}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deck-description">Description (Optional)</Label>
              <Textarea
                id="deck-description"
                placeholder="Describe this deck..."
                value={newDeck.description}
                onChange={(e) => setNewDeck({ ...newDeck, description: e.target.value })}
                disabled={isSubmitting}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="deck-public"
                checked={newDeck.isPublic}
                onCheckedChange={(checked) => setNewDeck({ ...newDeck, isPublic: checked })}
                disabled={isSubmitting}
              />
              <Label htmlFor="deck-public">Make this deck public</Label>
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setIsCreateDeckOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateDeck}
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? "Creating..." : "Create Deck"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}