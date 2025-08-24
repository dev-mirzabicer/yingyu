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
import { Layers, Plus, Search, FileText, Globe, Lock, Edit } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { useUnits, createUnit } from "@/hooks/api"
import { format } from "date-fns"
import { createTypedRender, typeGuards } from "@/components/data-table"
import type { UnitWithCount } from "@/lib/types"



export default function UnitsPage() {
  const [isCreateUnitOpen, setIsCreateUnitOpen] = useState(false)
  const [newUnit, setNewUnit] = useState({ name: "", description: "", isPublic: false })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [filterVisibility, setFilterVisibility] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")

  const { toast } = useToast()
  const { units, isLoading, isError, mutate } = useUnits()

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
      mutate()
    } catch (error) {
      console.error("Failed to create unit:", error)
      toast({
        title: "Error",
        description: "Failed to create unit. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Filter units based on visibility and search
  const filteredUnits = units.filter(unit => {
    const matchesVisibility = filterVisibility === "all" || (filterVisibility === "public" ? unit.isPublic : !unit.isPublic)
    const matchesSearch = unit.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (unit.description && unit.description.toLowerCase().includes(searchTerm.toLowerCase()))
    return matchesVisibility && matchesSearch
  })

  const unitColumns = [
    {
      key: "name",
      header: "Unit Name",
      render: createTypedRender<UnitWithCount, "name">((value, row) => {
        if (!typeGuards.isString(value)) return <span>—</span>
        return (
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Layers className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <Link href={`/units/${row.id}`} className="font-medium text-blue-600 hover:text-blue-800">
                {value}
              </Link>
              <div className="text-sm text-slate-500">{row._count?.items || 0} exercises</div>
            </div>
          </div>
        )
      }),
    },
    {
      key: "description",
      header: "Description",
      render: createTypedRender<UnitWithCount, "description">((value) => {
        if (!typeGuards.isStringOrNull(value)) return <span>—</span>
        return <span className="text-slate-600">{value || "No description"}</span>
      }),
    },
    {
      key: "isPublic",
      header: "Visibility",
      render: createTypedRender<UnitWithCount, "isPublic">((value) => {
        if (!typeGuards.isBoolean(value)) return <span>—</span>
        return (
          <div className="flex items-center space-x-2">
            {value ? <Globe className="h-4 w-4 text-green-600" /> : <Lock className="h-4 w-4 text-slate-400" />}
            <Badge variant={value ? "default" : "secondary"}>
              {value ? "Public" : "Private"}
            </Badge>
          </div>
        )
      }),
    },
    {
      key: "createdAt",
      header: "Created",
      render: createTypedRender<UnitWithCount, "createdAt">((value) => {
        if (!typeGuards.isDateString(value)) return <span>—</span>
        return format(new Date(value), "MMM dd, yyyy")
      }),
    },
    {
      key: "actions",
      header: "Actions",
      render: createTypedRender<UnitWithCount, "id">((_, row) => (
        <div className="flex items-center space-x-2">
          <Link href={`/units/${row.id}`}>
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-2" />
              Edit Unit & Exercises
            </Button>
          </Link>
        </div>
      )),
    },
  ]

  // Calculate stats
  const publicUnits = units.filter(u => u.isPublic)
  const totalExercises = units.reduce((sum, unit) => sum + (unit._count?.items || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">Units</h1>
          <p className="text-slate-600">Create and organize lesson units with exercises and activities</p>
        </div>
        <Button onClick={() => setIsCreateUnitOpen(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Create Unit
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Layers className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">Total Units</p>
                <p className="text-2xl font-bold text-slate-900">{units.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">Total Exercises</p>
                <p className="text-2xl font-bold text-slate-900">{totalExercises}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Globe className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">Public Units</p>
                <p className="text-2xl font-bold text-slate-900">{publicUnits.length}</p>
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
                  placeholder="Search units..."
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
                <SelectItem value="all">All Units</SelectItem>
                <SelectItem value="private">Private</SelectItem>
                <SelectItem value="public">Public</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline" className="text-sm">
              {filteredUnits.length} of {units.length} units
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Units Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Units</CardTitle>
        </CardHeader>
        <CardContent>
          {isError ? (
            <div className="text-center py-8">
              <p className="text-slate-600">Failed to load units. Please try again.</p>
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
          ) : filteredUnits.length === 0 ? (
            <div className="text-center py-12">
              <Layers className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-4">
                {searchTerm || filterVisibility !== "all" ? "No units match your filters" : "No units created yet"}
              </p>
              {!searchTerm && filterVisibility === "all" && (
                <Button onClick={() => setIsCreateUnitOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                  Create Your First Unit
                </Button>
              )}
            </div>
          ) : (
            <DataTable<UnitWithCount> data={filteredUnits} columns={unitColumns} pageSize={10} />
          )}
        </CardContent>
      </Card>

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
