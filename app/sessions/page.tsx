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
import { useStudents } from "@/hooks/use-api-enhanced"
import type { FullStudentProfile } from "@/lib/types"
import { SessionStartDialog } from "@/components/session-start-dialog"

// Mock session data - in production this would come from an API
const mockSessions = [
  {
    id: "session-1",
    studentId: "student-1",
    studentName: "John Doe",
    unitName: "Basic Vocabulary",
    status: "COMPLETED",
    startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    endedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
    duration: 30,
    cardsReviewed: 25,
    accuracy: 85,
  },
  {
    id: "session-2", 
    studentId: "student-2",
    studentName: "Jane Smith",
    unitName: "Advanced Grammar",
    status: "IN_PROGRESS",
    startedAt: new Date(Date.now() - 15 * 60 * 1000),
    endedAt: null,
    duration: 15,
    cardsReviewed: 12,
    accuracy: 92,
  },
  {
    id: "session-3",
    studentId: "student-1", 
    studentName: "John Doe",
    unitName: "Conversation Practice",
    status: "CANCELLED",
    startedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    endedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 10 * 60 * 1000),
    duration: 10,
    cardsReviewed: 5,
    accuracy: 60,
  },
]

export default function SessionsPage() {
  const { students, isLoading } = useStudents()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [studentFilter, setStudentFilter] = useState<string>("all")
  const [selectedStudent, setSelectedStudent] = useState<FullStudentProfile | null>(null)
  const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false)

  const { toast } = useToast()

  // Filter sessions based on search, status, and student
  const filteredSessions = mockSessions.filter(session => {
    const matchesSearch = session.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         session.unitName.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || session.status === statusFilter
    const matchesStudent = studentFilter === "all" || session.studentId === studentFilter
    return matchesSearch && matchesStatus && matchesStudent
  })

  // Calculate statistics
  const stats = {
    total: mockSessions.length,
    completed: mockSessions.filter(s => s.status === "COMPLETED").length,
    inProgress: mockSessions.filter(s => s.status === "IN_PROGRESS").length,
    avgDuration: mockSessions.reduce((sum, s) => sum + s.duration, 0) / mockSessions.length,
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
      render: (value: string, row: any) => (
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
      key: "accuracy",
      header: "Accuracy",
      render: (value: number) => (
        <Badge variant={value >= 80 ? "default" : value >= 60 ? "secondary" : "destructive"}>
          {value}%
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (_: any, row: any) => (
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
            {isLoading ? (
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
          <DataTable
            columns={columns}
            data={filteredSessions}
          />
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