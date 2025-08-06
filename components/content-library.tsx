"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataTable } from "@/components/data-table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { BookOpen, Plus, FileText } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { useUnits, useDecks, createUnit } from "@/hooks/use-api-enhanced"
import { format } from "date-fns"

export function ContentLibrary() {
  const [isCreateUnitOpen, setIsCreateUnitOpen] = useState(false)
  const [newUnit, setNewUnit] = useState({ name: "", description: "", isPublic: false })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  const { units, isLoading: unitsLoading, isError: unitsError, mutate: mutateUnits } = useUnits()
  const { decks, isLoading: decksLoading, isError: decksError, mutate: mutateDecks } = useDecks()

  const handleCreateUnit = async () => {
    if (!newUnit.name) {
      toast({
        title: "Error",
        description: "Please enter a unit name.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      await createUnit(newUnit)
      toast({
        title: "Unit created successfully",
        description: `${newUnit.name} has been created.`,
      })
      setNewUnit({ name: "", description: "", isPublic: false })
      setIsCreateUnitOpen(false)
      mutateUnits()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create unit. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const unitColumns = [
    {
      key: "name",
      header: "Unit Name",
      render: (value: string, row: any) => (
        <Link href={`/units/${row.id}`} className="font-medium text-blue-600 hover:text-blue-800">
          {value}
        </Link>
      ),
    },
    {
      key: "description",
      header: "Description",
      render: (value: string) => value || "No description",
    },
    {
      key: "isPublic",
      header: "Visibility",
      render: (value: boolean) => (
        <Badge variant={value ? "default" : "secondary"}>
          {value ? "Public" : "Private"}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      render: (value: string) => format(new Date(value), "MMM dd, yyyy"),
    },
  ]

  const deckColumns = [
    {
      key: "name",
      header: "Deck Name",
    },
    {
      key: "description",
      header: "Description",
      render: (value: string) => value || "No description",
    },
    {
      key: "isPublic",
      header: "Visibility",
      render: (value: boolean) => (
        <Badge variant={value ? "default" : "secondary"}>
          {value ? "Public" : "Private"}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      render: (value: string) => format(new Date(value), "MMM dd, yyyy"),
    },
  ]

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-slate-900">Content Library</h1>
            <p className="text-slate-600">Manage your units, exercises, and learning materials.</p>
          </div>
          <Button onClick={() => setIsCreateUnitOpen(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Create New Unit
          </Button>
        </div>

        <Tabs defaultValue="units" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="units">My Units</TabsTrigger>
            <TabsTrigger value="exercises">My Exercises</TabsTrigger>
            <TabsTrigger value="public">Public Library</TabsTrigger>
          </TabsList>

          <TabsContent value="units">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Units</CardTitle>
                  <Button onClick={() => setIsCreateUnitOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Unit
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {unitsError ? (
                  <div className="text-center py-8">
                    <p className="text-slate-600">Failed to load units. Please try again.</p>
                  </div>
                ) : unitsLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex items-center space-x-4">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    ))}
                  </div>
                ) : units.length === 0 ? (
                  <div className="text-center py-12">
                    <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 mb-4">No units created yet</p>
                    <Button onClick={() => setIsCreateUnitOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                      Create Your First Unit
                    </Button>
                  </div>
                ) : (
                  <DataTable data={units} columns={unitColumns} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="exercises">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Vocabulary Decks</CardTitle>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Deck
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {decksError ? (
                  <div className="text-center py-8">
                    <p className="text-slate-600">Failed to load decks. Please try again.</p>
                  </div>
                ) : decksLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex items-center space-x-4">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    ))}
                  </div>
                ) : decks.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 mb-4">No vocabulary decks created yet</p>
                    <Button className="bg-blue-600 hover:bg-blue-700">
                      Create Your First Deck
                    </Button>
                  </div>
                ) : (
                  <DataTable data={decks} columns={deckColumns} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="public">
            <Card>
              <CardHeader>
                <CardTitle>Public Library</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <p className="text-slate-500">Public library coming soon!</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create Unit Dialog */}
        <Dialog open={isCreateUnitOpen} onOpenChange={setIsCreateUnitOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Unit</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="unit-name">Unit Name</Label>
                <Input
                  id="unit-name"
                  placeholder="Enter unit name"
                  value={newUnit.name}
                  onChange={(e) => setNewUnit({ ...newUnit, name: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit-description">Description (Optional)</Label>
                <Textarea
                  id="unit-description"
                  placeholder="Describe what this unit covers..."
                  value={newUnit.description}
                  onChange={(e) => setNewUnit({ ...newUnit, description: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="unit-public"
                  checked={newUnit.isPublic}
                  onCheckedChange={(checked) => setNewUnit({ ...newUnit, isPublic: checked })}
                  disabled={isSubmitting}
                />
                <Label htmlFor="unit-public">Make this unit public</Label>
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateUnitOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateUnit}
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isSubmitting ? "Creating..." : "Create Unit"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
  )
}
