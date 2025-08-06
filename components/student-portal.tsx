"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar } from "@/components/ui/calendar"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  BookOpen,
  Brain,
  Clock,
  Target,
  Play,
  CheckCircle,
  AlertCircle,
  BarChart3,
} from "lucide-react"
import { format } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import { useStudent, useDueCards, useAvailableUnits, startSession } from "@/hooks/use-api-enhanced"

interface StudentPortalProps {
  studentId: string
}


export function StudentPortal({ studentId }: StudentPortalProps) {
  const { student, isLoading: isStudentLoading } = useStudent(studentId)
  const { dueCards, isLoading: isDueCardsLoading } = useDueCards(studentId)
  const { units: availableUnits, isLoading: isUnitsLoading } = useAvailableUnits(studentId)

  const [isStartingSession, setIsStartingSession] = useState(false)

  const { toast } = useToast()

  const handleStartQuickReview = async () => {
    if (!availableUnits || availableUnits.length === 0) {
      toast({
        title: "No units available",
        description: "Please contact your teacher to assign study materials.",
        variant: "destructive",
      })
      return
    }

    setIsStartingSession(true)
    try {
      // Start session with the first available unit
      const response = await startSession(studentId, availableUnits[0].id)

      toast({
        title: "Session started",
        description: "Your study session has begun!",
      })

      // In a real app, this would navigate to the session page
      console.log("Session started:", response.data)
    } catch (error) {
      toast({
        title: "Failed to start session",
        description: "Please try again or contact your teacher.",
        variant: "destructive",
      })
    } finally {
      setIsStartingSession(false)
    }
  }

  if (isStudentLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading your study portal...</p>
        </div>
      </div>
    )
  }

  if (!student) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Student not found. Please check the student ID.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src="/placeholder.svg?height=64&width=64" />
            <AvatarFallback className="text-lg">{student.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Welcome back, {student.name}!</h1>
            <p className="text-slate-600">Ready to continue your English learning journey?</p>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center space-x-2 mb-1">
            <Flame className="h-5 w-5 text-orange-500" />
            <span className="text-2xl font-bold text-slate-900">{currentStreak}</span>
          </div>
          <p className="text-sm text-slate-600">day streak</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Brain className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">Due Today</p>
                <p className="text-2xl font-bold text-slate-900">
                  {isDueCardsLoading
                    ? "..."
                    : dueCards.filter((card) => isSameDay(new Date(card.due), new Date())).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">Today's Study</p>
                <p className="text-2xl font-bold text-slate-900">
                  {todaysSessions.reduce((sum, session) => sum + session.duration, 0)} min
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">Accuracy</p>
                <p className="text-2xl font-bold text-slate-900">
                  {todaysSessions.length > 0
                    ? Math.round(
                      todaysSessions.reduce((sum, session) => sum + session.accuracy, 0) / todaysSessions.length,
                    )
                    : 0}
                  %
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">Classes Left</p>
                <p className="text-2xl font-bold text-slate-900">{student.classesRemaining}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Study</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              onClick={handleStartQuickReview}
              disabled={isStartingSession || isDueCardsLoading}
              className="h-20 bg-blue-600 hover:bg-blue-700"
            >
              <div className="text-center">
                <Brain className="h-6 w-6 mx-auto mb-1" />
                <div className="font-medium">Quick Review</div>
                <div className="text-xs opacity-90">
                  {isDueCardsLoading ? "Loading..." : `${dueCards.length} cards due`}
                </div>
              </div>
            </Button>

            <Button variant="outline" className="h-20 bg-transparent" disabled>
              <div className="text-center">
                <Headphones className="h-6 w-6 mx-auto mb-1" />
                <div className="font-medium">Listening Practice</div>
                <div className="text-xs text-slate-500">Coming soon</div>
              </div>
            </Button>

            <Button variant="outline" className="h-20 bg-transparent" disabled>
              <div className="text-center">
                <Volume2 className="h-6 w-6 mx-auto mb-1" />
                <div className="font-medium">Pronunciation</div>
                <div className="text-xs text-slate-500">Coming soon</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Study Progress */}
            <div className="lg:col-span-2 space-y-6">

              {/* Available Units */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <BookOpen className="h-5 w-5" />
                    <span>Available Study Units</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isUnitsLoading ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />
                      ))}
                    </div>
                  ) : availableUnits && availableUnits.length > 0 ? (
                    <div className="space-y-3">
                      {availableUnits.map((unit) => (
                        <div
                          key={unit.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                              <BookOpen className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                              <h4 className="font-medium text-slate-900">{unit.name}</h4>
                              <p className="text-sm text-slate-500">{unit.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className="text-xs">
                              {unit.items?.length || 0} exercises
                            </Badge>
                            <Button size="sm" onClick={() => startSession(studentId, unit.id)}>
                              <Play className="h-4 w-4 mr-1" />
                              Start
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500">No study units available</p>
                      <p className="text-sm text-slate-400">Contact your teacher to get started</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Due Cards */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Brain className="h-5 w-5" />
                    <span>Due for Review</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isDueCardsLoading ? (
                    <div className="space-y-2">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
                      ))}
                    </div>
                  ) : dueCards.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {dueCards.slice(0, 10).map((cardState) => (
                        <div key={cardState.id} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <div className="font-medium text-sm">{cardState.card.englishWord}</div>
                            <div className="text-xs text-slate-500">{cardState.card.chineseTranslation}</div>
                          </div>
                          <Badge
                            variant={
                              cardState.state === "NEW"
                                ? "default"
                                : cardState.state === "LEARNING"
                                  ? "secondary"
                                  : cardState.state === "REVIEW"
                                    ? "outline"
                                    : cardState.state === "RELEARNING"
                                      ? "destructive"
                                      : "destructive"
                            }
                            className="text-xs"
                          >
                            {cardState.state}
                          </Badge>
                        </div>
                      ))}
                      {dueCards.length > 10 && (
                        <div className="text-center pt-2">
                          <Button variant="ghost" size="sm">
                            View all {dueCards.length} cards
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                      <p className="text-sm text-slate-600">All caught up!</p>
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>
          </div>
        </TabsContent>

        <TabsContent value="progress" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Learning Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <BarChart3 className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">Progress Tracking Coming Soon</h3>
                <p className="text-slate-500">Your learning progress and detailed analytics will appear here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  )
}
