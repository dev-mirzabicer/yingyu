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
  CalendarIcon,
  Clock,
  Target,
  TrendingUp,
  Award,
  Play,
  Star,
  Flame,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Volume2,
  Headphones,
} from "lucide-react"
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, subDays } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import { useStudent, useDueCards, useAvailableUnits, startSession } from "@/hooks/use-api-enhanced"

interface StudentPortalProps {
  studentId: string
}

interface StudySession {
  id: string
  date: Date
  duration: number
  cardsStudied: number
  accuracy: number
  type: "vocabulary" | "listening" | "grammar"
}

interface Achievement {
  id: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  unlockedAt: Date
  rarity: "common" | "rare" | "epic" | "legendary"
}

// Mock data for study sessions and achievements
const mockStudySessions: StudySession[] = [
  {
    id: "session-1",
    date: new Date(),
    duration: 25,
    cardsStudied: 20,
    accuracy: 85,
    type: "vocabulary",
  },
  {
    id: "session-2",
    date: subDays(new Date(), 1),
    duration: 30,
    cardsStudied: 15,
    accuracy: 92,
    type: "listening",
  },
  {
    id: "session-3",
    date: subDays(new Date(), 2),
    duration: 20,
    cardsStudied: 18,
    accuracy: 78,
    type: "vocabulary",
  },
]

const mockAchievements: Achievement[] = [
  {
    id: "achievement-1",
    title: "First Steps",
    description: "Complete your first study session",
    icon: Star,
    unlockedAt: subDays(new Date(), 7),
    rarity: "common",
  },
  {
    id: "achievement-2",
    title: "Week Warrior",
    description: "Study for 7 consecutive days",
    icon: Flame,
    unlockedAt: subDays(new Date(), 1),
    rarity: "rare",
  },
  {
    id: "achievement-3",
    title: "Perfect Score",
    description: "Achieve 100% accuracy in a session",
    icon: Target,
    unlockedAt: subDays(new Date(), 3),
    rarity: "epic",
  },
]

const rarityColors = {
  common: "bg-slate-100 text-slate-700 border-slate-200",
  rare: "bg-blue-100 text-blue-700 border-blue-200",
  epic: "bg-purple-100 text-purple-700 border-purple-200",
  legendary: "bg-yellow-100 text-yellow-700 border-yellow-200",
}

export function StudentPortal({ studentId }: StudentPortalProps) {
  const { student, isLoading: isStudentLoading } = useStudent(studentId)
  const { dueCards, isLoading: isDueCardsLoading } = useDueCards(studentId)
  const { units: availableUnits, isLoading: isUnitsLoading } = useAvailableUnits(studentId)

  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [currentStreak, setCurrentStreak] = useState(7)
  const [isStartingSession, setIsStartingSession] = useState(false)

  const { toast } = useToast()

  // Calculate study statistics
  const todaysSessions = mockStudySessions.filter((session) => isSameDay(session.date, new Date()))

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  const weeklyStats = {
    totalMinutes: mockStudySessions
      .filter((session) => session.date >= weekStart && session.date <= weekEnd)
      .reduce((sum, session) => sum + session.duration, 0),
    totalCards: mockStudySessions
      .filter((session) => session.date >= weekStart && session.date <= weekEnd)
      .reduce((sum, session) => sum + session.cardsStudied, 0),
    averageAccuracy: mockStudySessions
      .filter((session) => session.date >= weekStart && session.date <= weekEnd)
      .reduce((sum, session, _, arr) => sum + session.accuracy / arr.length, 0),
  }

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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Study Progress */}
            <div className="lg:col-span-2 space-y-6">
              {/* Weekly Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <BarChart3 className="h-5 w-5" />
                    <span>This Week's Progress</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{weeklyStats.totalMinutes}</div>
                      <div className="text-sm text-slate-600">Minutes</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{weeklyStats.totalCards}</div>
                      <div className="text-sm text-slate-600">Cards</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {Math.round(weeklyStats.averageAccuracy)}%
                      </div>
                      <div className="text-sm text-slate-600">Accuracy</div>
                    </div>
                  </div>

                  {/* Weekly Calendar */}
                  <div className="grid grid-cols-7 gap-2">
                    {weekDays.map((day) => {
                      const daySession = mockStudySessions.find((session) => isSameDay(session.date, day))
                      const isToday = isSameDay(day, new Date())

                      return (
                        <div
                          key={day.toISOString()}
                          className={`p-2 rounded-lg text-center ${isToday
                              ? "bg-blue-100 border-2 border-blue-300"
                              : daySession
                                ? "bg-green-100 border border-green-200"
                                : "bg-slate-50 border border-slate-200"
                            }`}
                        >
                          <div className="text-xs font-medium text-slate-600">{format(day, "EEE")}</div>
                          <div className="text-sm font-bold text-slate-900">{format(day, "dd")}</div>
                          {daySession && <div className="text-xs text-green-600 mt-1">{daySession.duration}m</div>}
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

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

              {/* Recent Achievements */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Award className="h-5 w-5" />
                    <span>Recent Achievements</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockAchievements.slice(0, 3).map((achievement) => {
                      const Icon = achievement.icon
                      return (
                        <div key={achievement.id} className="flex items-center space-x-3">
                          <div className={`p-2 rounded-lg ${rarityColors[achievement.rarity]}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-sm">{achievement.title}</div>
                            <div className="text-xs text-slate-500">{achievement.description}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
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
                <TrendingUp className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">Detailed Progress Analytics</h3>
                <p className="text-slate-500">Track your learning journey with detailed statistics and insights</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="achievements" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockAchievements.map((achievement) => {
              const Icon = achievement.icon
              return (
                <Card key={achievement.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className={`p-3 rounded-lg ${rarityColors[achievement.rarity]}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-slate-900">{achievement.title}</h3>
                        <Badge variant="outline" className="text-xs mt-1">
                          {achievement.rarity}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 mb-2">{achievement.description}</p>
                    <p className="text-xs text-slate-500">Unlocked {format(achievement.unlockedAt, "MMM dd, yyyy")}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        <TabsContent value="schedule" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CalendarIcon className="h-5 w-5" />
                  <span>Study Calendar</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  className="rounded-md border"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Upcoming Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <CalendarIcon className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No scheduled sessions</p>
                  <p className="text-sm text-slate-400">Your teacher will schedule classes for you</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
