"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Calendar, Clock, User, AlertTriangle, TrendingUp, Play, Plus } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { useStudents, createStudent, useDecks } from "@/hooks/use-api-enhanced"
import { format } from "date-fns"
import { SessionStartDialog } from "@/components/session-start-dialog"

export function TeacherDashboard() {
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false)
  const [newStudent, setNewStudent] = useState({ name: "", email: "", notes: "" })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sessionStudent, setSessionStudent] = useState<{ id: string; name: string } | null>(null)
  const { toast } = useToast()
  const { students, isLoading, isError, mutate } = useStudents()
  const { decks } = useDecks()

  const handleAddStudent = async () => {
    if (!newStudent.name || !newStudent.email) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      })
      return
    }

    const defaultDeck = decks.find(d => d.name === 'Default Seed Deck') || decks[0];
    if (!defaultDeck) {
      toast({
        title: "Cannot Add Student",
        description: "There are no vocabulary decks in the system. Please create a deck first before adding a student.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true)
    try {
      await createStudent(newStudent, defaultDeck.id)
      toast({
        title: "Student added successfully",
        description: `${newStudent.name} has been added to your class.`,
      })
      setNewStudent({ name: "", email: "", notes: "" })
      setIsAddStudentOpen(false)
      // Refresh the students list
      mutate()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add student. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Calculate stats from real data
  const activeStudents = students.filter(s => s.status === 'ACTIVE')
  const lowBalanceStudents = students.filter(s => s.classesRemaining <= 2)
  const totalUpcomingClasses =
    students?.reduce((acc, student) => {
      return (
        acc +
        (student.classSchedules?.filter(
          (s) => new Date(s.scheduledTime) > new Date()
        ).length || 0)
      )
    }, 0) || 0

  const formatNextClass = (student: any) => {
    const upcoming =
      student.classSchedules
        ?.filter((s) => new Date(s.scheduledTime) > new Date())
        .sort(
          (a, b) =>
            new Date(a.scheduledTime).getTime() -
            new Date(b.scheduledTime).getTime()
        ) || []
    if (!upcoming || upcoming.length === 0) return "No upcoming classes"
    return `Next: ${format(new Date(upcoming[0].scheduledTime), "MMM dd, HH:mm")}`
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">Welcome back, Jane!</h1>
          <p className="text-slate-600">Here's what's happening with your students today.</p>
        </div>
        <Button onClick={() => setIsAddStudentOpen(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Add New Student
        </Button>
      </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <User className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-slate-600">Active Students</p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-8" />
                  ) : (
                    <p className="text-2xl font-bold text-slate-900">{activeStudents.length}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-slate-600">Upcoming Classes</p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-8" />
                  ) : (
                    <p className="text-2xl font-bold text-slate-900">{totalUpcomingClasses}</p>
                  )}
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
                  {isLoading ? (
                    <Skeleton className="h-8 w-8" />
                  ) : (
                    <p className="text-2xl font-bold text-slate-900">{lowBalanceStudents.length}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-sm font-medium text-slate-600">Total Students</p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-8" />
                  ) : (
                    <p className="text-2xl font-bold text-slate-900">{students.length}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Student Grid */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-900">Your Students</h2>
          {isError ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-slate-600">Failed to load students. Please try again.</p>
              </CardContent>
            </Card>
          ) : isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center space-x-3">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-10 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : students.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-slate-600 mb-4">You don't have any students yet.</p>
                <Button onClick={() => setIsAddStudentOpen(true)}>
                  Add Your First Student
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {students.map((student) => (
                <Card key={student.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarImage src="/placeholder.svg" alt={student.name} />
                        <AvatarFallback>
                          {student.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <CardTitle className="text-lg">{student.name}</CardTitle>
                        <div className="flex items-center space-x-2">
                          <Badge variant={student.status === "ACTIVE" ? "default" : "secondary"}>
                            {student.status}
                          </Badge>
                          <span className="text-sm text-slate-500">{student.proficiencyLevel || "Beginner"}</span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center space-x-2 text-sm">
                      <Clock className="h-4 w-4 text-slate-400" />
                      <span className="text-slate-600">{formatNextClass(student)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Classes Remaining</span>
                      <span
                        className={`text-lg font-bold ${student.classesRemaining <= 2 ? "text-red-600" : "text-slate-900"
                          }`}
                      >
                        {student.classesRemaining}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Active Decks</span>
                      <span className="text-sm font-medium text-slate-900">
                        {student.studentDecks.length}
                      </span>
                    </div>
                    <div className="flex space-x-2 mt-3">
                      <Link href={`/students/${student.id}`} className="flex-1">
                        <Button className="w-full" variant="outline">
                          View Profile
                        </Button>
                      </Link>
                      <Button
                        className="bg-blue-600 hover:bg-blue-700 px-3"
                        onClick={() => setSessionStudent({ id: student.id, name: student.name })}
                        title="Quick Start Session"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Add Student Dialog */}
        <Dialog open={isAddStudentOpen} onOpenChange={setIsAddStudentOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Student</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="student-name">Full Name</Label>
                <Input
                  id="student-name"
                  placeholder="Enter student's full name"
                  value={newStudent.name}
                  onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="student-email">Email</Label>
                <Input
                  id="student-email"
                  type="email"
                  placeholder="student@example.com"
                  value={newStudent.email}
                  onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="student-notes">Notes (Optional)</Label>
                <Textarea
                  id="student-notes"
                  placeholder="Any initial notes about the student..."
                  value={newStudent.notes}
                  onChange={(e) => setNewStudent({ ...newStudent, notes: e.target.value })}
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

        {/* Quick Start Session Dialog */}
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
