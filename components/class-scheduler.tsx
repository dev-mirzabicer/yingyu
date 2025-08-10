"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  CalendarIcon,
  Clock,
  Plus,
  Edit,
  Trash2,
  MoreHorizontal,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RotateCcw,
  Users,
} from "lucide-react"
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from "date-fns"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { useStudentSchedules, createSchedule, updateSchedule, deleteSchedule } from "@/hooks/api"
import type { ClassSchedule, ClassStatus } from "@prisma/client"
import { DataTable } from "@/components/data-table"
import { Skeleton } from "@/components/ui/skeleton"

interface ClassSchedulerProps {
  studentId: string
  studentName: string
  classesRemaining: number
  onScheduleUpdated: () => void
}

interface ScheduleFormData {
  scheduledTime: Date
  duration: number
  notes: string
  recurring: boolean
  recurringPattern: string
  recurringEnd: Date | null
}


const timeSlots = [
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
  "21:00",
  "21:30",
]

const durations = [
  { value: 30, label: "30 minutes" },
  { value: 45, label: "45 minutes" },
  { value: 60, label: "1 hour" },
  { value: 90, label: "1.5 hours" },
  { value: 120, label: "2 hours" },
]

const recurringPatterns = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
]

const statusColors = {
  SCHEDULED: "bg-blue-100 text-blue-700 border-blue-200",
  CONFIRMED: "bg-green-100 text-green-700 border-green-200",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700 border-yellow-200",
  COMPLETED: "bg-slate-100 text-slate-700 border-slate-200",
  CANCELLED: "bg-red-100 text-red-700 border-red-200",
  RESCHEDULED: "bg-orange-100 text-orange-700 border-orange-200",
}

const statusIcons = {
  SCHEDULED: Clock,
  CONFIRMED: CheckCircle,
  IN_PROGRESS: Users,
  COMPLETED: CheckCircle,
  CANCELLED: XCircle,
  RESCHEDULED: RotateCcw,
}

const initialFormData: ScheduleFormData = {
  scheduledTime: new Date(),
  duration: 60,
  notes: "",
  recurring: false,
  recurringPattern: "weekly",
  recurringEnd: null,
}

export function ClassScheduler({ studentId, studentName, classesRemaining, onScheduleUpdated }: ClassSchedulerProps) {
  const { schedules, isLoading, isError, mutate } = useStudentSchedules(studentId)
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<ClassSchedule | null>(null)
  const [formData, setFormData] = useState<ScheduleFormData>(initialFormData)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list")
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)

  const { toast } = useToast()

  // Get current week for calendar view
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  const handleCreateSchedule = async () => {
    if (!formData.scheduledTime) {
      toast({
        title: "Error",
        description: "Please select a date and time.",
        variant: "destructive",
      })
      return
    }

    if (classesRemaining <= 0) {
      toast({
        title: "Cannot schedule class",
        description: "Student has no remaining classes. Please record a payment first.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      await createSchedule(studentId, {
        scheduledTime: formData.scheduledTime.toISOString(),
        duration: formData.duration,
        notes: formData.notes,
      })

      toast({
        title: "Class scheduled successfully",
        description: `Class scheduled for ${format(formData.scheduledTime, "PPP 'at' p")}.`,
      })

      setFormData(initialFormData)
      setIsScheduleDialogOpen(false)
      mutate()
      onScheduleUpdated()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to schedule class. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateSchedule = async () => {
    if (!editingSchedule || !formData.scheduledTime) {
      return
    }

    setIsSubmitting(true)
    try {
      await updateSchedule(editingSchedule.id, {
        scheduledTime: formData.scheduledTime.toISOString(),
        duration: formData.duration,
        notes: formData.notes,
      })

      toast({
        title: "Class updated successfully",
        description: `Class rescheduled to ${format(formData.scheduledTime, "PPP 'at' p")}.`,
      })

      setFormData(initialFormData)
      setIsScheduleDialogOpen(false)
      setIsEditMode(false)
      setEditingSchedule(null)
      mutate()
      onScheduleUpdated()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update class. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteSchedule = async (schedule: ClassSchedule) => {
    if (
      !confirm(
        `Are you sure you want to delete the class scheduled for ${format(new Date(schedule.scheduledTime), "PPP 'at' p")}?`,
      )
    ) {
      return
    }

    try {
      await deleteSchedule(schedule.id)
      toast({
        title: "Class deleted",
        description: "The scheduled class has been removed.",
      })
      mutate()
      onScheduleUpdated()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete class. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleStatusChange = async (schedule: ClassSchedule, newStatus: ClassStatus) => {
    try {
      await updateSchedule(schedule.id, { status: newStatus })
      toast({
        title: "Status updated",
        description: `Class status changed to ${newStatus.toLowerCase()}.`,
      })
      mutate()
      onScheduleUpdated()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update status. Please try again.",
        variant: "destructive",
      })
    }
  }

  const openEditDialog = (schedule: ClassSchedule) => {
    setEditingSchedule(schedule)
    setFormData({
      ...initialFormData,
      scheduledTime: new Date(schedule.scheduledTime),
      duration: schedule.duration ?? 60,
      notes: schedule.notes ?? "",
    })
    setIsEditMode(true)
    setIsScheduleDialogOpen(true)
  }

  const openCreateDialog = () => {
    setEditingSchedule(null)
    setFormData(initialFormData)
    setIsEditMode(false)
    setIsScheduleDialogOpen(true)
  }

  const setDateTime = (date: Date, time: string) => {
    const [hours, minutes] = time.split(":").map(Number)
    const newDateTime = new Date(date)
    newDateTime.setHours(hours, minutes, 0, 0)
    setFormData((prev) => ({ ...prev, scheduledTime: newDateTime }))
  }

  const getSchedulesForDate = (date: Date) => {
    return schedules.filter((schedule) => isSameDay(new Date(schedule.scheduledTime), date))
  }

  const upcomingSchedules = schedules
    .filter((schedule) => new Date(schedule.scheduledTime) > new Date())
    .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime())

  const scheduleColumns = [
    {
      key: "scheduledTime",
      header: "Date & Time",
      render: (value: string) => (
        <div className="space-y-1">
          <div className="font-medium">{format(new Date(value), "MMM dd, yyyy")}</div>
          <div className="text-sm text-slate-500">{format(new Date(value), "h:mm a")}</div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (value: ClassStatus) => {
        const Icon = statusIcons[value]
        return (
          <Badge variant="outline" className={statusColors[value]}>
            <Icon className="h-3 w-3 mr-1" />
            {value.charAt(0) + value.slice(1).toLowerCase()}
          </Badge>
        )
      },
    },
    {
      key: "actions",
      header: "Actions",
      render: (_: any, row: ClassSchedule) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEditDialog(row)}>
              <Edit className="mr-2 h-4 w-4" />
              Reschedule
            </DropdownMenuItem>
            {row.status === "SCHEDULED" && (
              <DropdownMenuItem onClick={() => handleStatusChange(row, "CONFIRMED")}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Confirm
              </DropdownMenuItem>
            )}
            {row.status === "CONFIRMED" && (
              <DropdownMenuItem onClick={() => handleStatusChange(row, "COMPLETED")}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Mark Complete
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => handleStatusChange(row, "CANCELLED")}>
              <XCircle className="mr-2 h-4 w-4" />
              Cancel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDeleteSchedule(row)} className="text-red-600">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  if (isError) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Failed to load class schedules. Please try again.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Class Schedule</h2>
          <p className="text-slate-600">Manage {studentName}'s class schedule</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 bg-slate-100 rounded-lg p-1">
            <Button variant={viewMode === "list" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("list")}>
              List
            </Button>
            <Button
              variant={viewMode === "calendar" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("calendar")}
            >
              Calendar
            </Button>
          </div>
          <Button onClick={openCreateDialog} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Schedule Class
          </Button>
        </div>
      </div>

      {/* Low Balance Warning */}
      {classesRemaining <= 2 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{studentName}</strong> has only {classesRemaining} classes remaining. Consider recording a
            payment before scheduling more classes.
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">Upcoming Classes</p>
                <p className="text-2xl font-bold text-slate-900">{upcomingSchedules.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">Classes Remaining</p>
                <p className="text-2xl font-bold text-slate-900">{classesRemaining}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">Total Scheduled</p>
                <p className="text-2xl font-bold text-slate-900">{schedules.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Schedule View */}
      {viewMode === "list" ? (
        <Card>
          <CardHeader>
            <CardTitle>All Scheduled Classes</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
                    <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
                    <div className="h-4 w-16 bg-slate-200 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : schedules.length === 0 ? (
              <div className="text-center py-8">
                <CalendarIcon className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 mb-4">No classes scheduled yet</p>
                <Button onClick={openCreateDialog} className="bg-blue-600 hover:bg-blue-700">
                  Schedule First Class
                </Button>
              </div>
            ) : (
              <DataTable data={schedules} columns={scheduleColumns} pageSize={10} />
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Weekly Calendar View</CardTitle>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedDate(addDays(selectedDate, -7))}>
                  Previous Week
                </Button>
                <span className="text-sm font-medium">
                  {format(weekStart, "MMM dd")} - {format(weekEnd, "MMM dd, yyyy")}
                </span>
                <Button variant="outline" size="sm" onClick={() => setSelectedDate(addDays(selectedDate, 7))}>
                  Next Week
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((day) => {
                const daySchedules = getSchedulesForDate(day)
                const isToday = isSameDay(day, new Date())

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "p-3 border rounded-lg min-h-32",
                      isToday ? "bg-blue-50 border-blue-200" : "bg-white border-slate-200",
                    )}
                  >
                    <div className={cn("text-sm font-medium mb-2", isToday ? "text-blue-900" : "text-slate-900")}>
                      {format(day, "EEE dd")}
                    </div>
                    <div className="space-y-1">
                      {daySchedules.map((schedule) => {
                        const Icon = statusIcons[schedule.status]
                        return (
                          <div
                            key={schedule.id}
                            className={cn(
                              "p-2 rounded text-xs cursor-pointer hover:opacity-80",
                              statusColors[schedule.status],
                            )}
                            onClick={() => openEditDialog(schedule)}
                          >
                            <div className="flex items-center space-x-1">
                              <Icon className="h-3 w-3" />
                              <span>{format(new Date(schedule.scheduledTime), "HH:mm")}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schedule Dialog */}
      <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditMode ? "Reschedule Class" : "Schedule New Class"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Date</Label>
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.scheduledTime && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.scheduledTime ? format(formData.scheduledTime, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.scheduledTime}
                    onSelect={(date) => {
                      if (date) {
                        const currentTime = formData.scheduledTime || new Date()
                        const newDateTime = new Date(date)
                        newDateTime.setHours(currentTime.getHours(), currentTime.getMinutes(), 0, 0)
                        setFormData((prev) => ({ ...prev, scheduledTime: newDateTime }))
                        setIsCalendarOpen(false)
                      }
                    }}
                    disabled={(date) => date < new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Select Time</Label>
              <Select
                value={formData.scheduledTime ? format(formData.scheduledTime, "HH:mm") : ""}
                onValueChange={(time) => setDateTime(formData.scheduledTime || new Date(), time)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map((time) => (
                    <SelectItem key={time} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Duration</Label>
              <Select
                value={formData.duration.toString()}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, duration: Number.parseInt(value) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {durations.map((duration) => (
                    <SelectItem key={duration.value} value={duration.value.toString()}>
                      {duration.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Any notes for this class..."
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsScheduleDialogOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                onClick={isEditMode ? handleUpdateSchedule : handleCreateSchedule}
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? "Saving..." : isEditMode ? "Update Class" : "Schedule Class"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
