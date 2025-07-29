"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Brain,
  TrendingUp,
  Clock,
  Target,
  Zap,
  Volume2,
  BarChart3,
  Settings,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  BookOpen,
} from "lucide-react"
import { format, subDays, startOfDay } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import {
  useDueCards,
  useListeningCandidates,
  optimizeFsrsParameters,
  rebuildFsrsCache,
  useJob,
  useAsyncOperation,
} from "@/hooks/use-api-enhanced"
import type { FullStudentProfile } from "@/lib/types"
import type { StudentCardState, VocabularyCard } from "@prisma/client"
import { DataTable } from "@/components/data-table"

interface FSRSAnalyticsDashboardProps {
  student: FullStudentProfile
}

interface DueCardWithCard extends StudentCardState {
  card: VocabularyCard
}

interface AnalyticsData {
  totalCards: number
  dueToday: number
  newCards: number
  reviewCards: number
  averageRetention: number
  studyStreak: number
  totalReviews: number
  averageResponseTime: number
}

const difficultyColors = {
  1: "bg-green-100 text-green-700 border-green-200",
  2: "bg-blue-100 text-blue-700 border-blue-200",
  3: "bg-yellow-100 text-yellow-700 border-yellow-200",
  4: "bg-orange-100 text-orange-700 border-orange-200",
  5: "bg-red-100 text-red-700 border-red-200",
}

const stateColors = {
  NEW: "bg-blue-100 text-blue-700 border-blue-200",
  LEARNING: "bg-yellow-100 text-yellow-700 border-yellow-200",
  REVIEW: "bg-green-100 text-green-700 border-green-200",
  RELEARNING: "bg-orange-100 text-orange-700 border-orange-200",
}

export function FSRSAnalyticsDashboard({ student }: FSRSAnalyticsDashboardProps) {
  const { dueCards, isLoading: isDueCardsLoading, isError: isDueCardsError } = useDueCards(student.id)
  const {
    candidates: listeningCandidates,
    isLoading: isListeningLoading,
    isError: isListeningError,
  } = useListeningCandidates(student.id)

  const [optimizationJobId, setOptimizationJobId] = useState<string | null>(null)
  const [rebuildJobId, setRebuildJobId] = useState<string | null>(null)
  const [isOptimizationDialogOpen, setIsOptimizationDialogOpen] = useState(false)

  const { job: optimizationJob } = useJob(optimizationJobId || "")
  const { job: rebuildJob } = useJob(rebuildJobId || "")
  const { execute, isLoading: isExecuting, error: executionError } = useAsyncOperation()

  const { toast } = useToast()

  // Calculate analytics data
  const analyticsData: AnalyticsData = {
    totalCards: student.studentDecks.reduce((sum, deck) => sum + (deck.deck.cards?.length || 0), 0),
    dueToday: dueCards.filter((card) => startOfDay(card.due) <= startOfDay(new Date())).length,
    newCards: dueCards.filter((card) => card.state === "NEW").length,
    reviewCards: dueCards.filter((card) => card.state === "REVIEW").length,
    averageRetention:
      dueCards.length > 0
        ? (dueCards.reduce((sum, card) => sum + (card.retrievability || 0), 0) / dueCards.length) * 100
        : 0,
    studyStreak: 7, // This would come from review history analysis
    totalReviews: dueCards.reduce((sum, card) => sum + card.reps, 0),
    averageResponseTime:
      dueCards.length > 0 ? dueCards.reduce((sum, card) => sum + card.averageResponseTimeMs, 0) / dueCards.length : 0,
  }

  const handleOptimizeParameters = async () => {
    const result = await execute(async () => {
      const response = await optimizeFsrsParameters(student.id)
      return response.data
    })

    if (result) {
      setOptimizationJobId(result.id)
      setIsOptimizationDialogOpen(true)
      toast({
        title: "Parameter optimization started",
        description: "This may take a few minutes to complete.",
      })
    }
  }

  const handleRebuildCache = async () => {
    const result = await execute(async () => {
      const response = await rebuildFsrsCache(student.id)
      return response.data
    })

    if (result) {
      setRebuildJobId(result.id)
      toast({
        title: "Cache rebuild started",
        description: "FSRS cache is being rebuilt in the background.",
      })
    }
  }

  const dueCardColumns = [
    {
      key: "card",
      header: "Word",
      render: (_: any, row: DueCardWithCard) => (
        <div className="space-y-1">
          <div className="font-medium text-slate-900">{row.card.englishWord}</div>
          <div className="text-sm text-slate-500">{row.card.chineseTranslation}</div>
        </div>
      ),
    },
    {
      key: "state",
      header: "State",
      render: (value: string) => (
        <Badge variant="outline" className={stateColors[value as keyof typeof stateColors]}>
          {value.charAt(0) + value.slice(1).toLowerCase()}
        </Badge>
      ),
    },
    {
      key: "difficulty",
      header: "Difficulty",
      render: (value: number) => (
        <div className="flex items-center space-x-2">
          <div className="w-16 bg-slate-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${(value / 10) * 100}%` }} />
          </div>
          <span className="text-sm text-slate-600">{value.toFixed(1)}</span>
        </div>
      ),
    },
    {
      key: "stability",
      header: "Stability",
      render: (value: number) => <div className="text-sm text-slate-600">{value.toFixed(1)} days</div>,
    },
    {
      key: "retrievability",
      header: "Retention",
      render: (value: number | null) => (
        <div className="text-sm text-slate-600">{value ? `${(value * 100).toFixed(1)}%` : "N/A"}</div>
      ),
    },
    {
      key: "due",
      header: "Due",
      render: (value: string) => {
        const dueDate = new Date(value)
        const isOverdue = dueDate < new Date()
        return (
          <div className={`text-sm ${isOverdue ? "text-red-600 font-medium" : "text-slate-600"}`}>
            {format(dueDate, "MMM dd, HH:mm")}
          </div>
        )
      },
    },
  ]

  const listeningCandidateColumns = [
    {
      key: "englishWord",
      header: "Word",
      render: (value: string, row: VocabularyCard) => (
        <div className="space-y-1">
          <div className="font-medium text-slate-900">{value}</div>
          <div className="text-sm text-slate-500">{row.chineseTranslation}</div>
        </div>
      ),
    },
    {
      key: "difficultyLevel",
      header: "Difficulty",
      render: (value: number) => (
        <Badge variant="outline" className={difficultyColors[value as keyof typeof difficultyColors]}>
          Level {value}
        </Badge>
      ),
    },
    {
      key: "frequencyRank",
      header: "Frequency",
      render: (value: number | null) => <div className="text-sm text-slate-600">{value ? `#${value}` : "N/A"}</div>,
    },
    {
      key: "audioUrl",
      header: "Audio",
      render: (value: string | null) => (
        <div className="flex items-center">
          {value ? (
            <Button variant="ghost" size="sm" onClick={() => new Audio(value).play()}>
              <Volume2 className="h-4 w-4" />
            </Button>
          ) : (
            <span className="text-sm text-slate-400">No audio</span>
          )}
        </div>
      ),
    },
  ]

  if (isDueCardsError || isListeningError) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Failed to load FSRS analytics data. Please try again.</AlertDescription>
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
          <h2 className="text-2xl font-bold text-slate-900">FSRS Analytics</h2>
          <p className="text-slate-600">Advanced spaced repetition analytics for {student.name}</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={handleRebuildCache}
            disabled={isExecuting || rebuildJob?.status === "RUNNING"}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${rebuildJob?.status === "RUNNING" ? "animate-spin" : ""}`} />
            Rebuild Cache
          </Button>
          <Button
            onClick={handleOptimizeParameters}
            disabled={isExecuting || optimizationJob?.status === "RUNNING"}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Settings className={`h-4 w-4 mr-2 ${optimizationJob?.status === "RUNNING" ? "animate-spin" : ""}`} />
            Optimize Parameters
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">Total Cards</p>
                <p className="text-2xl font-bold text-slate-900">{analyticsData.totalCards}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">Due Today</p>
                <p className="text-2xl font-bold text-slate-900">{analyticsData.dueToday}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">Avg Retention</p>
                <p className="text-2xl font-bold text-slate-900">{analyticsData.averageRetention.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Zap className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">Study Streak</p>
                <p className="text-2xl font-bold text-slate-900">{analyticsData.studyStreak} days</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card State Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5" />
              <span>Card State Distribution</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full" />
                  <span className="text-sm text-slate-600">New Cards</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">{analyticsData.newCards}</span>
                  <div className="w-24">
                    <Progress value={(analyticsData.newCards / analyticsData.totalCards) * 100} className="h-2" />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full" />
                  <span className="text-sm text-slate-600">Review Cards</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">{analyticsData.reviewCards}</span>
                  <div className="w-24">
                    <Progress value={(analyticsData.reviewCards / analyticsData.totalCards) * 100} className="h-2" />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                  <span className="text-sm text-slate-600">Learning</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">
                    {dueCards.filter((card) => card.state === "LEARNING").length}
                  </span>
                  <div className="w-24">
                    <Progress
                      value={
                        (dueCards.filter((card) => card.state === "LEARNING").length / analyticsData.totalCards) * 100
                      }
                      className="h-2"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-orange-500 rounded-full" />
                  <span className="text-sm text-slate-600">Relearning</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">
                    {dueCards.filter((card) => card.state === "RELEARNING").length}
                  </span>
                  <div className="w-24">
                    <Progress
                      value={
                        (dueCards.filter((card) => card.state === "RELEARNING").length / analyticsData.totalCards) * 100
                      }
                      className="h-2"
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>Performance Metrics</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Total Reviews</span>
                <span className="text-lg font-semibold text-slate-900">
                  {analyticsData.totalReviews.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Avg Response Time</span>
                <span className="text-lg font-semibold text-slate-900">
                  {(analyticsData.averageResponseTime / 1000).toFixed(1)}s
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Cards Due This Week</span>
                <span className="text-lg font-semibold text-slate-900">
                  {dueCards.filter((card) => new Date(card.due) <= subDays(new Date(), -7)).length}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Overdue Cards</span>
                <span className="text-lg font-semibold text-red-600">
                  {dueCards.filter((card) => new Date(card.due) < new Date()).length}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Detailed Views */}
      <Tabs defaultValue="due-cards" className="space-y-4">
        <TabsList>
          <TabsTrigger value="due-cards">Due Cards</TabsTrigger>
          <TabsTrigger value="listening-candidates">Listening Candidates</TabsTrigger>
          <TabsTrigger value="optimization-history">Optimization History</TabsTrigger>
        </TabsList>

        <TabsContent value="due-cards">
          <Card>
            <CardHeader>
              <CardTitle>Due Cards Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              {isDueCardsLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  ))}
                </div>
              ) : dueCards.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p className="text-slate-500">No cards due for review!</p>
                </div>
              ) : (
                <DataTable data={dueCards} columns={dueCardColumns} pageSize={10} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="listening-candidates">
          <Card>
            <CardHeader>
              <CardTitle>Listening Exercise Candidates</CardTitle>
            </CardHeader>
            <CardContent>
              {isListeningLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  ))}
                </div>
              ) : listeningCandidates.length === 0 ? (
                <div className="text-center py-8">
                  <Volume2 className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No listening candidates available</p>
                </div>
              ) : (
                <DataTable data={listeningCandidates} columns={listeningCandidateColumns} pageSize={10} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="optimization-history">
          <Card>
            <CardHeader>
              <CardTitle>Parameter Optimization History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Brain className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 mb-4">No optimization history available</p>
                <Button onClick={handleOptimizeParameters} className="bg-blue-600 hover:bg-blue-700">
                  Run First Optimization
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Optimization Job Dialog */}
      <Dialog open={isOptimizationDialogOpen} onOpenChange={setIsOptimizationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Parameter Optimization Progress</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {optimizationJob ? (
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-3 h-3 rounded-full ${optimizationJob.status === "COMPLETED"
                        ? "bg-green-500"
                        : optimizationJob.status === "FAILED"
                          ? "bg-red-500"
                          : optimizationJob.status === "RUNNING"
                            ? "bg-blue-500 animate-pulse"
                            : "bg-slate-300"
                      }`}
                  />
                  <span className="font-medium">Status: {optimizationJob.status}</span>
                </div>

                {optimizationJob.status === "RUNNING" && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Optimizing FSRS parameters...</span>
                      <span>This may take several minutes</span>
                    </div>
                    <Progress value={undefined} className="h-2" />
                  </div>
                )}

                {optimizationJob.status === "COMPLETED" && optimizationJob.result && (
                  <div className="space-y-2">
                    <div className="text-sm text-green-600">✓ Optimization completed successfully!</div>
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <pre className="text-xs text-slate-600">{JSON.stringify(optimizationJob.result, null, 2)}</pre>
                    </div>
                  </div>
                )}

                {optimizationJob.status === "FAILED" && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>Optimization failed: {optimizationJob.error || "Unknown error"}</AlertDescription>
                  </Alert>
                )}

                <div className="text-xs text-slate-500">
                  Started: {format(new Date(optimizationJob.createdAt), "PPp")}
                  {optimizationJob.updatedAt !== optimizationJob.createdAt && (
                    <> • Updated: {format(new Date(optimizationJob.updatedAt), "PPp")}</>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
                <p className="text-sm text-slate-600">Loading optimization status...</p>
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setIsOptimizationDialogOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Error Display */}
      {executionError && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Operation failed: {executionError.message}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
