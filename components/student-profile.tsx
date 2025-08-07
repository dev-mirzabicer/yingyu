"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable } from "@/components/data-table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  MoreHorizontal,
  Play,
  DollarSign,
  Edit,
  Archive,
  BookOpen,
  Calendar,
  TrendingUp,
  Clock,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  useStudent,
  useDecks,
  assignDeck,
  updateStudent,
  archiveStudent,
  updateStudentNotes,
} from "@/hooks/api/students"
import { format } from "date-fns"
import { SessionStartDialog } from "@/components/session-start-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PaymentManager } from "@/components/payment-manager"
import { ClassScheduler } from "@/components/class-scheduler"
import { JobStatusIndicator } from "@/components/ui/job-status-indicator"

interface StudentProfileProps {
  studentId: string
}

export function StudentProfile({ studentId }: StudentProfileProps) {
  const { student, isLoading, isError, mutate } = useStudent(studentId)
  const { decks, isLoading: decksLoading } = useDecks()

  const [notes, setNotes] = useState("")
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false)
  const [isAssignDeckOpen, setIsAssignDeckOpen] = useState(false)
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null)
  const [assignDeckJobId, setAssignDeckJobId] = useState<string | null>(null)
  const [isSavingNotes, setIsSavingNotes] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const [isEditDetailsOpen, setIsEditDetailsOpen] = useState(false)
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false)
  const [editFormData, setEditFormData] = useState({
    name: "",
    email: "",
    phone: "",
    proficiencyLevel: "",
    notes: "",
  })
  const [isUpdating, setIsUpdating] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
  const { toast } = useToast()

  React.useEffect(() => {
    if (student?.notes) {
      setNotes(student.notes)
    }
  }, [student?.notes])

  React.useEffect(() => {
    if (student) {
      setEditFormData({
        name: student.name || "",
        email: student.email || "",
        phone: student.phone || "",
        proficiencyLevel: student.proficiencyLevel || "",
        notes: student.notes || "",
      })
    }
  }, [student])

  const handleSaveNotes = async () => {
    if (!student) return

    setIsSavingNotes(true)
    try {
      await updateStudentNotes(student.id, notes)
      toast({
        title: "Notes updated",
        description: "Student notes have been saved successfully.",
      })
      setIsEditingNotes(false)
      mutate()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update notes. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSavingNotes(false)
    }
  }

  const handleAssignDeck = async () => {
    if (!selectedDeckId || !student) return

    try {
      const result = await assignDeck(student.id, selectedDeckId)
      if (result.job) {
        setAssignDeckJobId(result.job.id)
        toast({
          title: "Deck assignment started",
          description:
            "This is a large deck. Card initialization is running in the background.",
        })
      } else {
        toast({
          title: "Deck assigned",
          description: "The deck has been successfully assigned to the student.",
        })
        mutate()
      }
      setIsAssignDeckOpen(false)
      setSelectedDeckId(null)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to assign deck. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleRecordPaymentClick = () => {
    setActiveTab("payments")
  }

  const handleScheduleClassClick = () => {
    setActiveTab("schedule")
  }

  const handleUpdateStudent = async () => {
    if (!student) return

    if (!editFormData.name.trim()) {
      toast({
        title: "Error",
        description: "Student name is required.",
        variant: "destructive",
      })
      return
    }

    setIsUpdating(true)
    try {
      await updateStudent(student.id, {
        name: editFormData.name,
        email: editFormData.email || undefined,
        phone: editFormData.phone || undefined,
        proficiencyLevel: editFormData.proficiencyLevel || undefined,
        notes: editFormData.notes || undefined,
      })
      toast({
        title: "Student updated",
        description: "Student details have been updated successfully.",
      })
      setIsEditDetailsOpen(false)
      mutate()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update student. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleArchiveStudent = async () => {
    if (!student) return

    setIsArchiving(true)
    try {
      await archiveStudent(student.id)
      toast({
        title: "Student archived",
        description: "Student has been archived successfully.",
      })
      setIsArchiveConfirmOpen(false)
      window.location.href = "/students"
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to archive student. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsArchiving(false)
    }
  }

  const assignedDeckIds = new Set(student?.studentDecks.map((sd) => sd.deckId))
  const availableDecks = decks.filter((deck) => !assignedDeckIds.has(deck.id))

  const deckColumns = [
    {
      key: "deck.name",
      header: "Deck Name",
      render: (value: any, row: any) => row.deck.name,
    },
    {
      key: "assignedAt",
      header: "Date Assigned",
      render: (value: string) => format(new Date(value), "MMM dd, yyyy"),
    },
    {
      key: "isActive",
      header: "Status",
      render: (value: boolean) => (
        <Badge variant={value ? "default" : "secondary"}>
          {value ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ]

  if (isError) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-slate-600">
              Failed to load student profile. Please try again.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading || !student) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-4">
                <Skeleton className="h-20 w-20 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-10" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src="/placeholder.svg" alt={student.name} />
                <AvatarFallback className="text-lg">
                  {student.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  <h1 className="text-2xl font-bold text-slate-900">
                    {student.name}
                  </h1>
                  <Badge
                    variant={student.status === "ACTIVE" ? "default" : "secondary"}
                  >
                    {student.status}
                  </Badge>
                </div>
                <p className="text-slate-600">{student.email}</p>
                <p className="text-sm text-slate-500">
                  Proficiency: {student.proficiencyLevel || "Beginner"}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                onClick={() => setIsSessionDialogOpen(true)}
                className="bg-blue-600 hover:bg-blue-700"
                disabled={student.status !== "ACTIVE"}
              >
                <Play className="h-4 w-4 mr-2" />
                Start Session
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleRecordPaymentClick}>
                    <DollarSign className="mr-2 h-4 w-4" />
                    Record Payment
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleScheduleClassClick}>
                    <Calendar className="mr-2 h-4 w-4" />
                    Schedule Class
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsEditDetailsOpen(true)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Details
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-red-600"
                    onClick={() => setIsArchiveConfirmOpen(true)}
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    Archive Student
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="learning">Learning Plan</TabsTrigger>
          <TabsTrigger value="payments">Payment History</TabsTrigger>
          <TabsTrigger value="schedule">Class Schedule</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">
                  Classes Remaining
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  <span
                    className={`text-2xl font-bold ${
                      student.classesRemaining <= 2
                        ? "text-red-600"
                        : "text-slate-900"
                    }`}
                  >
                    {student.classesRemaining}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">
                  Active Decks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <BookOpen className="h-5 w-5 text-green-600" />
                  <span className="text-2xl font-bold text-slate-900">
                    {student.studentDecks.filter((deck) => deck.isActive).length}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">
                  Upcoming Classes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5 text-purple-600" />
                  <span className="text-2xl font-bold text-slate-900">
                    {
                      student.classSchedules?.filter(
                        (schedule) => new Date(schedule.scheduledTime) > new Date()
                      ).length
                    }
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Teacher's Notes</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingNotes(!isEditingNotes)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  {isEditingNotes ? "Cancel" : "Edit"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isEditingNotes ? (
                <div className="space-y-4">
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    className="resize-none"
                    disabled={isSavingNotes}
                  />
                  <div className="flex space-x-2">
                    <Button
                      onClick={handleSaveNotes}
                      disabled={isSavingNotes}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {isSavingNotes ? "Saving..." : "Save Notes"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsEditingNotes(false)
                        setNotes(student.notes || "")
                      }}
                      disabled={isSavingNotes}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-slate-700 leading-relaxed">
                  {notes || "No notes added yet."}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="learning">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Assigned Decks</CardTitle>
                <Button
                  onClick={() => setIsAssignDeckOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={!!assignDeckJobId}
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  Assign Deck
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {assignDeckJobId && (
                <div className="mb-4">
                  <JobStatusIndicator
                    jobId={assignDeckJobId}
                    title="Assigning Deck"
                    description="Initializing cards for the new deck. This may take a moment."
                    onComplete={() => {
                      setAssignDeckJobId(null)
                      mutate()
                    }}
                  />
                </div>
              )}
              {student.studentDecks.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 mb-4">No decks assigned yet</p>
                  <Button
                    onClick={() => setIsAssignDeckOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Assign First Deck
                  </Button>
                </div>
              ) : (
                <DataTable data={student.studentDecks} columns={deckColumns} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <PaymentManager
            studentId={student.id}
            studentName={student.name}
            classesRemaining={student.classesRemaining}
            onPaymentRecorded={mutate}
          />
        </TabsContent>

        <TabsContent value="schedule">
          <ClassScheduler
            studentId={student.id}
            studentName={student.name}
            classesRemaining={student.classesRemaining}
            onScheduleUpdated={mutate}
          />
        </TabsContent>
      </Tabs>

      <SessionStartDialog
        studentId={student.id}
        studentName={student.name}
        open={isSessionDialogOpen}
        onOpenChange={setIsSessionDialogOpen}
      />

      <Dialog open={isAssignDeckOpen} onOpenChange={setIsAssignDeckOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Deck to {student.name}</DialogTitle>
            <DialogDescription>
              Select a deck to assign to this student. They will begin seeing
              cards from this deck in their sessions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="deck-select">Available Decks</Label>
              <Select
                onValueChange={setSelectedDeckId}
                value={selectedDeckId || undefined}
              >
                <SelectTrigger id="deck-select">
                  <SelectValue placeholder="Select a deck..." />
                </SelectTrigger>
                <SelectContent>
                  {decksLoading ? (
                    <SelectItem value="loading" disabled>
                      Loading...
                    </SelectItem>
                  ) : availableDecks.length > 0 ? (
                    availableDecks.map((deck) => (
                      <SelectItem key={deck.id} value={deck.id}>
                        {deck.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-decks" disabled>
                      No more decks to assign
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => setIsAssignDeckOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignDeck}
              disabled={!selectedDeckId || !!assignDeckJobId}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {assignDeckJobId ? "Assigning..." : "Assign Deck"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDetailsOpen} onOpenChange={setIsEditDetailsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Student Details</DialogTitle>
            <DialogDescription>
              Update the student's information below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={editFormData.name}
                onChange={(e) =>
                  setEditFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                disabled={isUpdating}
                placeholder="Student name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editFormData.email}
                onChange={(e) =>
                  setEditFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                disabled={isUpdating}
                placeholder="student@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={editFormData.phone}
                onChange={(e) =>
                  setEditFormData((prev) => ({ ...prev, phone: e.target.value }))
                }
                disabled={isUpdating}
                placeholder="Phone number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-proficiency">Proficiency Level</Label>
              <Select
                value={editFormData.proficiencyLevel}
                onValueChange={(value) =>
                  setEditFormData((prev) => ({
                    ...prev,
                    proficiencyLevel: value,
                  }))
                }
              >
                <SelectTrigger id="edit-proficiency">
                  <SelectValue placeholder="Select proficiency level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Not specified</SelectItem>
                  <SelectItem value="BEGINNER">Beginner</SelectItem>
                  <SelectItem value="ELEMENTARY">Elementary</SelectItem>
                  <SelectItem value="INTERMEDIATE">Intermediate</SelectItem>
                  <SelectItem value="ADVANCED">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={editFormData.notes}
                onChange={(e) =>
                  setEditFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
                disabled={isUpdating}
                placeholder="Additional notes about the student..."
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => setIsEditDetailsOpen(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateStudent}
              disabled={isUpdating}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isUpdating ? "Updating..." : "Update Student"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isArchiveConfirmOpen}
        onOpenChange={setIsArchiveConfirmOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Archive Student</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive {student?.name}? This will hide
              them from your active students list, but their data will be
              preserved.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsArchiveConfirmOpen(false)}
              disabled={isArchiving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleArchiveStudent}
              disabled={isArchiving}
              variant="destructive"
            >
              {isArchiving ? "Archiving..." : "Archive Student"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}