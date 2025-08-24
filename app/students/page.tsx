"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DataTable } from "@/components/data-table"
import { Plus, Search, Users, AlertTriangle, TrendingUp, Play } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { useStudents, createStudent } from "@/hooks/api/students"
import { useDecks } from "@/hooks/api/content"
import { format } from "date-fns"
import { createTypedRender, typeGuards } from "@/components/data-table"
import type { FullStudentProfile } from "@/lib/types"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { SessionStartDialog } from "@/components/session-start-dialog"
import { JobStatusIndicator } from "@/components/ui/job-status-indicator"



export default function StudentsPage() {
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false)
  const [newStudent, setNewStudent] = useState({
    name: "",
    email: "",
    notes: "",
    proficiencyLevel: "BEGINNER",
  })
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sessionStudent, setSessionStudent] = useState<{
    id: string
    name: string
  } | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [addStudentJobId, setAddStudentJobId] = useState<string | null>(null)

  const { toast } = useToast()
  const { students, isLoading, isError, mutate } = useStudents()
  const { decks, isLoading: isDecksLoading } = useDecks()

  const handleAddStudent = async () => {
    if (!newStudent.name || !newStudent.email || !selectedDeckId) {
      toast({
        title: "Error",
        description: "Please fill in all required fields and select a deck.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const response = await createStudent(newStudent, selectedDeckId);
      if (response.data.initializationJob) {
        setAddStudentJobId(response.data.initializationJob.id);
        toast({
          title: "Student creation in progress",
          description: `${newStudent.name} is being added. Card initialization is running in the background.`,
        });
      } else {
        toast({
          title: "Student added successfully",
          description: `${newStudent.name} has been added to your class.`,
        });
        mutate();
      }
    setNewStudent({
      name: "",
      email: "",
      notes: "",
      proficiencyLevel: "BEGINNER",
    });
    setSelectedDeckId(null);
    setIsAddStudentOpen(false);
    } catch (error) {
      console.error("Failed to add student:", error)
      toast({
        title: "Error",
        description: "Failed to add student. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredStudents = students.filter((student) => {
    const matchesStatus =
      filterStatus === "all" || student.status === filterStatus
    const matchesSearch =
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (student.email &&
        student.email.toLowerCase().includes(searchTerm.toLowerCase()))
    return matchesStatus && matchesSearch
  })

  const studentColumns = [
    {
      key: "name",
      header: "Student",
      render: createTypedRender<FullStudentProfile, "name">((value, row) => {
        if (!typeGuards.isString(value)) return <span>—</span>
        return (
          <div className="flex items-center space-x-3">
            <Avatar>
              <AvatarImage src="/placeholder.svg" alt={value} />
              <AvatarFallback>
                {value
                  .split(" ")
                  .map((n: string) => n[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium text-slate-900">{value}</div>
              <div className="text-sm text-slate-500">{row.email}</div>
            </div>
          </div>
        )
      }),
    },
    {
      key: "status",
      header: "Status",
      render: createTypedRender<FullStudentProfile, "status">((value) => {
        if (!typeGuards.isString(value)) return <span>—</span>
        return (
          <Badge variant={value === "ACTIVE" ? "default" : "secondary"}>
            {value}
          </Badge>
        )
      }),
    },
    {
      key: "classesRemaining",
      header: "Classes Remaining",
      render: createTypedRender<FullStudentProfile, "classesRemaining">((value) => {
        if (!typeGuards.isNumber(value)) return <span>—</span>
        return (
          <span
            className={
              value <= 2 ? "font-bold text-red-600" : "font-medium text-slate-900"
            }
          >
            {value}
          </span>
        )
      }),
    },
    {
      key: "studentDecks",
      header: "Active Decks",
      render: createTypedRender<FullStudentProfile, "studentDecks">((value) => {
        if (!Array.isArray(value)) return <span>—</span>
        return <span className="text-slate-900">{value.length}</span>
      }),
    },
    {
      key: "createdAt",
      header: "Joined",
      render: createTypedRender<FullStudentProfile, "createdAt">((value) => {
        if (!typeGuards.isDateString(value)) return <span>—</span>
        return format(new Date(value), "MMM dd, yyyy")
      }),
    },
    {
      key: "actions",
      header: "Actions",
      render: createTypedRender<FullStudentProfile, "id">((_, row) => (
        <div className="flex items-center space-x-2">
          <Link href={`/students/${row.id}`}>
            <Button variant="outline" size="sm">
              View Profile
            </Button>
          </Link>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => setSessionStudent({ id: row.id, name: row.name })}
            title="Quick Start Session"
          >
            <Play className="h-4 w-4" />
          </Button>
        </div>
      )),
    },
  ]

  const activeStudents = students.filter((s) => s.status === "ACTIVE")
  const lowBalanceStudents = students.filter((s) => s.classesRemaining <= 2)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">Students</h1>
          <p className="text-slate-600">
            Manage your students and track their progress
          </p>
        </div>
        <Button
          onClick={() => setIsAddStudentOpen(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Student
        </Button>
      </div>

      {addStudentJobId && (
        <JobStatusIndicator
          jobId={addStudentJobId}
          title="Creating Student"
          description="Initializing student and their learning materials. This may take a moment."
          onComplete={() => {
            setAddStudentJobId(null)
            mutate()
          }}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">
                  Total Students
                </p>
                <p className="text-2xl font-bold text-slate-900">
                  {students.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">
                  Active Students
                </p>
                <p className="text-2xl font-bold text-slate-900">
                  {activeStudents.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">Low Balance</p>
                <p className="text-2xl font-bold text-slate-900">
                  {lowBalanceStudents.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Students</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline" className="text-sm">
              {filteredStudents.length} of {students.length} students
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Students</CardTitle>
        </CardHeader>
        <CardContent>
          {isError ? (
            <div className="text-center py-8">
              <p className="text-slate-600">
                Failed to load students. Please try again.
              </p>
            </div>
          ) : isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="h-10 w-10 bg-slate-200 rounded-full animate-pulse" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-48 bg-slate-200 rounded animate-pulse" />
                    <div className="h-3 w-32 bg-slate-200 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-4">
                {searchTerm || filterStatus !== "all"
                  ? "No students match your filters"
                  : "No students added yet"}
              </p>
              {!searchTerm && filterStatus === "all" && (
                <Button
                  onClick={() => setIsAddStudentOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Add Your First Student
                </Button>
              )}
            </div>
          ) : (
            <DataTable<FullStudentProfile>
              data={filteredStudents}
              columns={studentColumns}
              pageSize={10}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={isAddStudentOpen} onOpenChange={setIsAddStudentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Student</DialogTitle>
            <DialogDescription>
              Enter the student&apos;s details and assign an initial deck.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="student-name">Full Name *</Label>
              <Input
                id="student-name"
                placeholder="Enter student&apos;s full name"
                value={newStudent.name}
                onChange={(e) =>
                  setNewStudent({ ...newStudent, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-email">Email *</Label>
              <Input
                id="student-email"
                type="email"
                placeholder="student@example.com"
                value={newStudent.email}
                onChange={(e) =>
                  setNewStudent({ ...newStudent, email: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proficiency-level">Proficiency Level *</Label>
              <Select
                onValueChange={(value) =>
                  setNewStudent({ ...newStudent, proficiencyLevel: value })
                }
                value={newStudent.proficiencyLevel}
              >
                <SelectTrigger id="proficiency-level">
                  <SelectValue placeholder="Select a level..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BEGINNER">Beginner</SelectItem>
                  <SelectItem value="ELEMENTARY">Elementary</SelectItem>
                  <SelectItem value="INTERMEDIATE">Intermediate</SelectItem>
                  <SelectItem value="ADVANCED">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="initial-deck">Initial Deck *</Label>
              <Select
                onValueChange={setSelectedDeckId}
                value={selectedDeckId || undefined}
              >
                <SelectTrigger id="initial-deck">
                  <SelectValue placeholder="Select a deck..." />
                </SelectTrigger>
                <SelectContent>
                  {isDecksLoading ? (
                    <SelectItem value="loading" disabled>
                      Loading decks...
                    </SelectItem>
                  ) : decks.length > 0 ? (
                    decks.map((deck) => (
                      <SelectItem key={deck.id} value={deck.id}>
                        {deck.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-decks" disabled>
                      No decks available. Create one first.
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-notes">Notes (Optional)</Label>
              <Textarea
                id="student-notes"
                placeholder="Any initial notes about the student..."
                value={newStudent.notes}
                onChange={(e) =>
                  setNewStudent({ ...newStudent, notes: e.target.value })
                }
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setIsAddStudentOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddStudent}
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? "Adding..." : "Add Student"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {sessionStudent && (
        <SessionStartDialog
          studentId={sessionStudent.id}
          studentName={sessionStudent.name}
          open={!!sessionStudent}
          onOpenChange={(open) => !open && setSessionStudent(null)}
        />
      )}
    </div>
  )
}
