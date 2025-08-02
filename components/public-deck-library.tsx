"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
  Search,
  Star,
  Download,
  Eye,
  BookOpen,
  Tag,
  Award,
  Globe,
  Copy,
} from "lucide-react"
import { format } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import { forkDeck } from "@/hooks/use-api-enhanced"
import type { VocabularyDeck } from "@prisma/client"

interface PublicDeckLibraryProps {
  onDeckImported?: (deck: VocabularyDeck) => void
}

interface PublicDeck extends VocabularyDeck {
  cards: any[] // Add cards property for compatibility
  author: {
    id: string
    name: string
    avatar?: string
    verified: boolean
  }
  stats: {
    downloads: number
    forks: number
  }
  tags: string[]
  difficulty: "BEGINNER" | "ELEMENTARY" | "INTERMEDIATE" | "ADVANCED" | "EXPERT"
  category: string
  lastUpdated: Date
  featured: boolean
}


// Mock data for public decks
const mockPublicDecks: PublicDeck[] = [
  {
    id: "deck-1",
    name: "Business English Essentials",
    description: "Essential vocabulary for professional communication in business settings",
    isPublic: true,
    createdAt: new Date("2024-01-15"),
    updatedAt: new Date("2024-01-20"),
    creatorId: "author-1",
    isArchived: false,
    originExerciseId: null,
    cards: Array(150).fill(null), // Mock cards array for count
    author: {
      id: "author-1",
      name: "Sarah Chen",
      avatar: "/placeholder.svg?height=40&width=40",
      verified: true,
    },
    stats: {
      downloads: 2847,
      forks: 23,
    },
    tags: ["business", "professional", "workplace", "communication"],
    difficulty: "INTERMEDIATE",
    category: "Business",
    lastUpdated: new Date("2024-01-20"),
    featured: true,
  },
  {
    id: "deck-2",
    name: "HSK Level 4 Vocabulary",
    description: "Complete vocabulary list for HSK Level 4 Chinese proficiency test",
    isPublic: true,
    createdAt: new Date("2024-01-10"),
    updatedAt: new Date("2024-01-18"),
    creatorId: "author-2",
    isArchived: false,
    originExerciseId: null,
    cards: Array(600).fill(null),
    author: {
      id: "author-2",
      name: "Michael Zhang",
      avatar: "/placeholder.svg?height=40&width=40",
      verified: true,
    },
    stats: {
      downloads: 1923,
      forks: 45,
    },
    tags: ["hsk", "chinese", "test-prep", "intermediate"],
    difficulty: "INTERMEDIATE",
    category: "Test Preparation",
    lastUpdated: new Date("2024-01-18"),
    featured: false,
  },
  {
    id: "deck-3",
    name: "Daily Conversation Starters",
    description: "Common phrases and expressions for everyday English conversations",
    isPublic: true,
    createdAt: new Date("2024-01-05"),
    updatedAt: new Date("2024-01-15"),
    creatorId: "author-3",
    isArchived: false,
    originExerciseId: null,
    cards: Array(80).fill(null),
    author: {
      id: "author-3",
      name: "Emma Johnson",
      avatar: "/placeholder.svg?height=40&width=40",
      verified: false,
    },
    stats: {
      downloads: 3421,
      forks: 67,
    },
    tags: ["conversation", "daily", "beginner", "phrases"],
    difficulty: "BEGINNER",
    category: "Conversation",
    lastUpdated: new Date("2024-01-15"),
    featured: true,
  },
]


const categories = [
  "All Categories",
  "Business",
  "Conversation",
  "Test Preparation",
  "Academic",
  "Travel",
  "Technology",
  "Medical",
  "Legal",
  "Arts & Culture",
]

const difficulties = [
  { value: "ALL", label: "All Levels" },
  { value: "BEGINNER", label: "Beginner" },
  { value: "ELEMENTARY", label: "Elementary" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "ADVANCED", label: "Advanced" },
  { value: "EXPERT", label: "Expert" },
]

const sortOptions = [
  { value: "featured", label: "Featured" },
  { value: "popular", label: "Most Popular" },
  { value: "recent", label: "Recently Updated" },
  { value: "downloads", label: "Most Downloaded" },
]

export function PublicDeckLibrary({ onDeckImported }: PublicDeckLibraryProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All Categories")
  const [selectedDifficulty, setSelectedDifficulty] = useState("ALL")
  const [sortBy, setSortBy] = useState("featured")
  const [selectedDeck, setSelectedDeck] = useState<PublicDeck | null>(null)
  const [isDeckDetailOpen, setIsDeckDetailOpen] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  const { toast } = useToast()

  // Filter and sort decks
  const filteredDecks = mockPublicDecks
    .filter((deck) => {
      const matchesSearch =
        deck.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (deck.description?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
        deck.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()))

      const matchesCategory = selectedCategory === "All Categories" || deck.category === selectedCategory
      const matchesDifficulty = selectedDifficulty === "ALL" || deck.difficulty === selectedDifficulty

      return matchesSearch && matchesCategory && matchesDifficulty
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "popular":
          return b.stats.downloads - a.stats.downloads
        case "recent":
          return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
        case "downloads":
          return b.stats.downloads - a.stats.downloads
        case "featured":
        default:
          return (b.featured ? 1 : 0) - (a.featured ? 1 : 0)
      }
    })

  const handleViewDeck = (deck: PublicDeck) => {
    setSelectedDeck(deck)
    setIsDeckDetailOpen(true)
  }

  const handleImportDeck = async (deck: PublicDeck) => {
    setIsImporting(true)
    try {
      const response = await forkDeck(deck.id)

      toast({
        title: "Deck imported successfully",
        description: `"${deck.name}" has been added to your collection.`,
      })

      onDeckImported?.(response.data)
    } catch (error) {
      toast({
        title: "Import failed",
        description: "Failed to import deck. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsImporting(false)
    }
  }


  const DeckCard = ({ deck }: { deck: PublicDeck }) => (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
      <CardContent className="p-0">
        {/* Header */}
        <div className="p-4 pb-2">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                  {deck.name}
                </h3>
                {deck.featured && (
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 border-yellow-200">
                    <Star className="h-3 w-3 mr-1" />
                    Featured
                  </Badge>
                )}
              </div>
              <p className="text-sm text-slate-600 line-clamp-2">{deck.description}</p>
            </div>
          </div>

          {/* Author */}
          <div className="flex items-center space-x-2 mb-3">
            <Avatar className="h-6 w-6">
              <AvatarImage src={deck.author.avatar || "/placeholder.svg"} />
              <AvatarFallback>{deck.author.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="text-sm text-slate-600">{deck.author.name}</span>
            {deck.author.verified && (
              <Badge variant="outline" className="text-xs px-1 py-0">
                <Award className="h-3 w-3" />
              </Badge>
            )}
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1 mb-3">
            {deck.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {deck.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{deck.tags.length - 3}
              </Badge>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between text-sm text-slate-500">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <BookOpen className="h-4 w-4" />
                <span>{deck.cards?.length || 0}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Download className="h-4 w-4" />
                <span>{deck.stats.downloads.toLocaleString()}</span>
              </div>
            </div>
            <Badge variant="outline" className="text-xs">
              {deck.difficulty.charAt(0) + deck.difficulty.slice(1).toLowerCase()}
            </Badge>
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 py-3 bg-slate-50 border-t flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              handleViewDeck(deck)
            }}
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              handleImportDeck(deck)
            }}
            disabled={isImporting}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Copy className="h-4 w-4 mr-2" />
            Import
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Public Deck Library</h2>
          <p className="text-slate-600">Discover and import vocabulary decks created by the community</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-sm">
            <Globe className="h-4 w-4 mr-1" />
            {filteredDecks.length} decks
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search decks, tags, or authors..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Category Filter */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Difficulty Filter */}
            <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {difficulties.map((difficulty) => (
                  <SelectItem key={difficulty.value} value={difficulty.value}>
                    {difficulty.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Featured Section */}
      {sortBy === "featured" && (
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Star className="h-5 w-5 text-yellow-500" />
            <h3 className="text-lg font-semibold text-slate-900">Featured Decks</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDecks
              .filter((deck) => deck.featured)
              .map((deck) => (
                <DeckCard key={deck.id} deck={deck} />
              ))}
          </div>
          {filteredDecks.filter((deck) => !deck.featured).length > 0 && (
            <>
              <Separator className="my-8" />
              <h3 className="text-lg font-semibold text-slate-900">All Decks</h3>
            </>
          )}
        </div>
      )}

      {/* Deck Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(sortBy === "featured" ? filteredDecks.filter((deck) => !deck.featured) : filteredDecks).map((deck) => (
          <DeckCard key={deck.id} deck={deck} />
        ))}
      </div>

      {filteredDecks.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Search className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No decks found</h3>
            <p className="text-slate-500">Try adjusting your search terms or filters to find more decks.</p>
          </CardContent>
        </Card>
      )}

      {/* Deck Detail Dialog */}
      <Dialog open={isDeckDetailOpen} onOpenChange={setIsDeckDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{selectedDeck?.name}</DialogTitle>
          </DialogHeader>

          {selectedDeck && (
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="preview">Preview Cards</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Main Info */}
                  <div className="md:col-span-2 space-y-4">
                    <div>
                      <p className="text-slate-600 mb-4">{selectedDeck.description}</p>

                      {/* Author Info */}
                      <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={selectedDeck.author.avatar || "/placeholder.svg"} />
                          <AvatarFallback>{selectedDeck.author.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{selectedDeck.author.name}</span>
                            {selectedDeck.author.verified && (
                              <Badge variant="outline" className="text-xs px-1 py-0">
                                <Award className="h-3 w-3" />
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-500">Deck Author</p>
                        </div>
                      </div>
                    </div>

                    {/* Tags */}
                    <div>
                      <h4 className="font-medium text-slate-900 mb-2">Tags</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedDeck.tags.map((tag) => (
                          <Badge key={tag} variant="outline">
                            <Tag className="h-3 w-3 mr-1" />
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Stats Sidebar */}
                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Deck Statistics</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <BookOpen className="h-4 w-4 text-slate-500" />
                            <span className="text-sm text-slate-600">Cards</span>
                          </div>
                          <span className="font-medium">{selectedDeck.cards?.length || 0}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Download className="h-4 w-4 text-slate-500" />
                            <span className="text-sm text-slate-600">Downloads</span>
                          </div>
                          <span className="font-medium">{selectedDeck.stats.downloads.toLocaleString()}</span>
                        </div>



                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Copy className="h-4 w-4 text-slate-500" />
                            <span className="text-sm text-slate-600">Forks</span>
                          </div>
                          <span className="font-medium">{selectedDeck.stats.forks}</span>
                        </div>

                        <Separator />

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-600">Difficulty</span>
                            <Badge variant="outline">
                              {selectedDeck.difficulty.charAt(0) + selectedDeck.difficulty.slice(1).toLowerCase()}
                            </Badge>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-600">Category</span>
                            <Badge variant="outline">{selectedDeck.category}</Badge>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-600">Updated</span>
                            <span className="text-sm font-medium">
                              {format(selectedDeck.lastUpdated, "MMM dd, yyyy")}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Action Buttons */}
                    <div className="space-y-2">
                      <Button
                        onClick={() => handleImportDeck(selectedDeck)}
                        disabled={isImporting}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        {isImporting ? "Importing..." : "Import Deck"}
                      </Button>

                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="preview" className="space-y-4">
                <div className="text-center py-8">
                  <BookOpen className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">Card Preview</h3>
                  <p className="text-slate-500 mb-4">Preview functionality would show sample cards from this deck</p>
                  <Button
                    onClick={() => handleImportDeck(selectedDeck)}
                    disabled={isImporting}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Import to View All Cards
                  </Button>
                </div>
              </TabsContent>

            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
