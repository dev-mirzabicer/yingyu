"use client"

import React, { useState } from "react"
import { MainLayout } from "@/components/main-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable } from "@/components/data-table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MoreHorizontal, Play, DollarSign, Edit, Archive, BookOpen, Calendar, TrendingUp, Clock } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useStudent, useDecks, assignDeck } from "@/hooks/use-api"
import { format } from "date-fns"
import { SessionStartDialog } from "@/components/session-start-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface StudentProfileProps {
  studentId: string
}

export function StudentProfile({ studentId }: StudentProfileProps) {
  const { student, isLoading, isError, mutate } = useStudent(studentId)
  const { decks, isLoading: decksLoading } = useDecks()

  const [notes, setNotes] = useState("")
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isAssignDeckOpen, setIsAssignDeckOpen] = useState(false)
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null)
  const [isAssigning, setIsAssigning] = useState(false)
  const [isSavingNotes, setIsSavingNotes] = useState(false)
  const { toast } = useToast()

  React.useEffect(() => {
    if (student?.notes) {
      setNotes(student.notes)
    }
  }, [student?.notes])

  const handleSaveNotes = async () => {
    if (!student) return

    setIsSavingNotes(true)
    try {
      await fetch(`/api/students/${student.id}/notes`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Teacher-ID': 'ef430bd0-5278-4b0d-a0d3-aecf91ba5cd8',
        },
        body: JSON.stringify({ notes }),
      })

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
    if (!selectedDeckId || !student) return;
    setIsAssigning(true);
    try {
      await assignDeck(student.id, selectedDeckId);
      toast({ title: "Deck assigned successfully!" });
      mutate(); // Re-fetch student data
      setIsAssignDeckOpen(false);
      setSelectedDeckId(null);
    } catch (error) {
      toast({ title: "Error assigning deck", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsAssigning(false);
    }
  }

  const assignedDeckIds = new Set(student?.studentDecks.map(sd => sd.deckId))
  const availableDecks = decks.filter(deck => !assignedDeckIds.has(deck.id))

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

  const paymentColumns = [
    {
      key: "paymentDate",
      header: "Payment Date",
      render: (value: string) => format(new Date(value), "MMM dd, yyyy"),
    },
    {
      key: "amount",
      header: "Amount",
      render: (value: number) => `$${value}`,
    },
    { key: "classesPurchased", header: "Classes Purchased" },
  ]

  const scheduleColumns = [
    {
      key: "scheduledTime",
      header: "Date & Time",
      render: (value: string) => format(new Date(value), "MMM dd, yyyy 'at' h:mm a"),
    },
    {
      key: "status",
      header: "Status",
      render: (value: string) => (
        <Badge variant={value === "COMPLETED" ? "secondary" : "default"}>
          {value}
        </Badge>
      ),
    },
  ]

  if (isError) {
    return (
      <MainLayout>
        <div className="p-6">
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-slate-600">Failed to load student profile. Please try again.</p>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    )
  }

  if (isLoading || !student) {
    return (
      <MainLayout>
        <div className="p-6 space-y-6">
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
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Profile Header */}
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
                    <h1 className="text-2xl font-bold text-slate-900">{student.name}</h1>
                    <Badge variant={student.status === "ACTIVE" ? "default" : "secondary"}>
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
                    <DropdownMenuItem onClick={() => setIsPaymentDialogOpen(true)}>
                      <DollarSign className="mr-2 h-4 w-4" />
                      Record Payment
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit Details
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600">
                      <Archive className="mr-2 h-4 w-4" />
                      Archive Student
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabbed Interface */}
        <Tabs defaultValue="overview" className="space-y-4">
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
                  <CardTitle className="text-sm font-medium text-slate-600">Classes Remaining</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2">
                    <Clock className="h-5 w-5 text-blue-600" />
                    <span
                      className={`text-2xl font-bold ${student.classesRemaining <= 2 ? "text-red-600" : "text-slate-900"
                        }`}
                    >
                      {student.classesRemaining}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-slate-600">Active Decks</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2">
                    <BookOpen className="h-5 w-5 text-green-600" />
                    <span className="text-2xl font-bold text-slate-900">
                      {student.studentDecks.filter(deck => deck.isActive).length}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-slate-600">Upcoming Classes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-5 w-5 text-purple-600" />
                    <span className="text-2xl font-bold text-slate-900">
                      {student.upcomingClasses.length}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Teacher's Notes</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setIsEditingNotes(!isEditingNotes)}>
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
                  <Button onClick={() => setIsAssignDeckOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                    <BookOpen className="h-4 w-4 mr-2" />
                    Assign Deck
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {student.studentDecks.length === 0 ? (
                  <div className="text-center py-8">
                    <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 mb-4">No decks assigned yet</p>
                    <Button onClick={() => setIsAssignDeckOpen(true)} className="bg-blue-600 hover:bg-blue-700">
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
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Payment History</CardTitle>
                  <Button onClick={() => setIsPaymentDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                    <DollarSign className="h-4 w-4 mr-2" />
                    Record Payment
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {student.payments.length === 0 ? (
                  <div className="text-center py-8">
                    <DollarSign className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 mb-4">No payments recorded yet</p>
                    <Button
                      onClick={() => setIsPaymentDialogOpen(true)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Record First Payment
                    </Button>
                  </div>
                ) : (
                  <DataTable data={student.payments} columns={paymentColumns} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schedule">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Class Schedule</CardTitle>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Calendar className="h-4 w-4 mr-2" />
                    Schedule Class
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {student.upcomingClasses.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 mb-4">No classes scheduled yet</p>
                    <Button className="bg-blue-600 hover:bg-blue-700">
                      Schedule First Class
                    </Button>
                  </div>
                ) : (
                  <DataTable data={student.upcomingClasses} columns={scheduleColumns} />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Start Session Dialog */}
        <SessionStartDialog
          studentId={student.id}
          studentName={student.name}
          open={isSessionDialogOpen}
          onOpenChange={setIsSessionDialogOpen}
        />

        {/* Assign Deck Dialog */}
        <Dialog open={isAssignDeckOpen} onOpenChange={setIsAssignDeckOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Deck to {student.name}</DialogTitle>
              <DialogDescription>
                Select a deck to assign to this student. They will begin seeing cards from this deck in their sessions.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="deck-select">Available Decks</Label>
                <Select onValueChange={setSelectedDeckId} value={selectedDeckId || undefined}>
                  <SelectTrigger id="deck-select">
                    <SelectValue placeholder="Select a deck..." />
                  </SelectTrigger>
                  <SelectContent>
                    {decksLoading ? (
                      <SelectItem value="loading" disabled>Loading...</SelectItem>
                    ) : availableDecks.length > 0 ? (
                      availableDecks.map(deck => (
                        <SelectItem key={deck.id} value={deck.id}>
                          {deck.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-decks" disabled>No more decks to assign</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsAssignDeckOpen(false)}>Cancel</Button>
              <Button onClick={handleAssignDeck} disabled={!selectedDeckId || isAssigning} className="bg-blue-600 hover:bg-blue-700">
                {isAssigning ? "Assigning..." : "Assign Deck"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Payment Dialog */}
        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input id="amount" type="number" placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="classes">Classes Purchased</Label>
                <Input id="classes" type="number" placeholder="0" />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
                  Cancel
                </Button>
                <Button className="bg-blue-600 hover:bg-blue-700">Record Payment</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  )
}

