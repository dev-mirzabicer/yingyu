"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Users, BarChart3 } from "lucide-react"
import { FSRSAnalyticsDashboard } from "@/components/fsrs-analytics-dashboard"
import { useStudents } from "@/hooks/use-api-enhanced"

export default function AnalyticsPage() {
  const { students, isLoading, isError } = useStudents()
  const [selectedStudentId, setSelectedStudentId] = useState<string>("")

  const selectedStudent = students.find(s => s.id === selectedStudentId)
  const activeStudents = students.filter(s => s.status === "ACTIVE")

  if (isError) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">FSRS Analytics</h1>
          <p className="text-slate-600">Advanced spaced repetition analytics and optimization tools</p>
        </div>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Failed to load students. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">FSRS Analytics</h1>
        <p className="text-slate-600">Advanced spaced repetition analytics and optimization tools</p>
      </div>

      {/* Student Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Select Student for Analytics</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <div className="h-4 w-48 bg-slate-200 rounded animate-pulse" />
              <div className="h-10 w-full bg-slate-200 rounded animate-pulse" />
            </div>
          ) : activeStudents.length === 0 ? (
            <div className="text-center py-6">
              <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No active students found</p>
              <p className="text-sm text-muted-foreground">Add students to view their FSRS analytics</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a student to analyze" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeStudents.map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          <div className="flex items-center space-x-3">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${student.name}`} />
                              <AvatarFallback>{student.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                            </Avatar>
                            <div className="flex items-center space-x-2">
                              <span>{student.name}</span>
                              <Badge variant={student.classesRemaining > 5 ? "default" : "secondary"}>
                                {student.classesRemaining} classes left
                              </Badge>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-sm text-muted-foreground">
                  {activeStudents.length} active student{activeStudents.length !== 1 ? 's' : ''}
                </div>
              </div>

              {selectedStudent && (
                <div className="p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${selectedStudent.name}`} />
                        <AvatarFallback>{selectedStudent.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{selectedStudent.name}</div>
                        <div className="text-sm text-muted-foreground">{selectedStudent.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">
                        {selectedStudent.studentDecks.length} deck{selectedStudent.studentDecks.length !== 1 ? 's' : ''}
                      </Badge>
                      <Badge variant={selectedStudent.classesRemaining > 5 ? "default" : "secondary"}>
                        {selectedStudent.classesRemaining} classes remaining
                      </Badge>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analytics Dashboard */}
      {selectedStudent ? (
        <FSRSAnalyticsDashboard student={selectedStudent} />
      ) : activeStudents.length > 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <BarChart3 className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-700 mb-2">Select a Student</h3>
            <p className="text-muted-foreground">Choose a student from the dropdown above to view their detailed FSRS analytics</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}