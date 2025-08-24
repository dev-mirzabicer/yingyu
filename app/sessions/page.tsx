"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable } from "@/components/data-table"
import {
  Play,
  Search,
  Clock,
  BookOpen,
  CheckCircle,
  XCircle,
  BarChart3
} from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import { useStudents, useSessions } from "@/hooks/api"
import type { FullStudentProfile } from "@/lib/types"
import { SessionStartDialog } from "@/components/session-start-dialog"

// TypeScript interface for session data
interface Session {
  id: string
  studentId: string
  studentName: string
  unitId: string
  unitName: string
  status: 'COMPLETED' | 'IN_PROGRESS' | 'CANCELLED'
  startedAt: string
  duration: number
  cardsReviewed: number
}

export default function SessionsPage() {
  const { students, isLoading: studentsLoading } = useStudents()
  const { sessions, isLoading: sessionsLoading, isError: sessionsError } = useSessions()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [studentFilter, setStudentFilter] = useState<string>("all")
  const [selectedStudent, setSelectedStudent] = useState<FullStudentProfile | null>(null)
  const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false)

  const { toast } = useToast()

  // Filter sessions based on search, status, and student
  const filteredSessions = sessions.filter(session => {
    const matchesSearch = session.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.unitName.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || session.status === statusFilter
    const matchesStudent = studentFilter === "all" || session.studentId === studentFilter
    return matchesSearch && matchesStatus && matchesStudent
  })

  // Calculate statistics
  const stats = {
    total: sessions.length,
    completed: sessions.filter(s => s.status === "COMPLETED").length,
    inProgress: sessions.filter(s => s.status === "IN_PROGRESS").length,
    avgDuration: sessions.length > 0 ? sessions.reduce((sum, s) => sum + s.duration, 0) / sessions.length : 0,
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <Badge variant="default" className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>
      case "IN_PROGRESS":
        return <Badge variant="default" className="bg-blue-600"><Play className="h-3 w-3 mr-1" />In Progress</Badge>
      case "CANCELLED":
        return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const startNewSession = (student: FullStudentProfile) => {
    setSelectedStudent(student)
    setIsSessionDialogOpen(true)
  }

  // Define table columns
  const columns = [
    {
      key: "studentName",
      header: "Student",
      render: (value: string) => (
        <div className="flex items-center space-x-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${value}`} />
            <AvatarFallback>{value.split(" ").map((n: string) => n[0]).join("")}</AvatarFallback>
          </Avatar>
          <span className="font-medium">{value}</span>
        </div>
      ),
    },
    {
      key: "unitName",
      header: "Unit",
      render: (value: string) => (
        <div className="flex items-center space-x-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <span>{value}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (value: string) => getStatusBadge(value),
    },
    {
      key: "startedAt",
      header: "Started",
      render: (value: Date) => format(new Date(value), "MMM dd, HH:mm"),
    },
    {
      key: "duration",
      header: "Duration",
      render: (value: number) => (
        <div className="flex items-center space-x-1">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span>{value}m</span>
        </div>
      ),
    },
    {
      key: "cardsReviewed",
      header: "Cards",
      render: (value: number) => <span>{value}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (_: unknown, row: Session) => (
        <div className="flex items-center space-x-2">
          {row.status === "IN_PROGRESS" && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/session/${row.id}`}>
                <Play className="h-4 w-4" />
              </Link>
            </Button>
          )}
          <Button variant="outline" size="sm">
            <BarChart3 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  // Loading state
  if (sessionsLoading || studentsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-slate-900">Live Sessions</h1>
            <p className="text-slate-600">Track and manage teaching sessions across all students</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-slate-600">Loading sessions...</span>
        </div>
      </div>
    )
  }

  // Error state
  if (sessionsError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-slate-900">Live Sessions</h1>
            <p className="text-slate-600">Track and manage teaching sessions across all students</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-slate-600">Failed to load sessions. Please try again.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">Live Sessions</h1>
          <p className="text-slate-600">Track and manage teaching sessions across all students</p>
        </div>
        <Button
          onClick={() => {
            if (students.length > 0) {
              startNewSession(students[0])
            } else {
              toast({
                title: "No Students",
                description: "Add students before starting a session.",
                variant: "destructive",
              })
            }
          }}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Play className="h-4 w-4 mr-2" />
          Start New Session
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Play className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(stats.avgDuration)}m</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sessions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={studentFilter} onValueChange={setStudentFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Student" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Students</SelectItem>
            {studentsLoading ? (
              <SelectItem value="loading" disabled>Loading...</SelectItem>
            ) : (
              students.map((student) => (
                <SelectItem key={student.id} value={student.id}>
                  {student.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Sessions Table */}
      <Card>
        <CardContent className="p-0">
          {filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <BarChart3 className="h-16 w-16 text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No sessions found</h3>
              <p className="text-slate-500 text-center max-w-sm">
                {sessions.length === 0
                  ? "Start your first teaching session to see it appear here."
                  : "No sessions match your current filters. Try adjusting your search criteria."
                }
              </p>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={filteredSessions}
            />
          )}
        </CardContent>
      </Card>

      {/* Start Session Dialog */}
      {selectedStudent && (
        <SessionStartDialog
          studentId={selectedStudent.id}
          studentName={selectedStudent.name}
          open={isSessionDialogOpen}
          onOpenChange={(open) => {
            setIsSessionDialogOpen(open)
            if (!open) {
              setSelectedStudent(null)
            }
          }}
        />
      )}
    </div>
  )
}
