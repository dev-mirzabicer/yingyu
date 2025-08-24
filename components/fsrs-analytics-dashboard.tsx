"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Brain,
  TrendingUp,
  Clock,
  Target,
  Volume2,
  BarChart3,
  Settings,
  AlertTriangle,
  CheckCircle,
  BookOpen,
} from "lucide-react"
import { format } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import {
  useDueCards,
  useListeningCandidates,
  useFsrsStats,
  optimizeFsrsParameters,
} from "@/hooks/api/students"
import { JobStatusIndicator } from "@/components/ui/job-status-indicator"
import type { FullStudentProfile } from "@/lib/types"
import type { StudentCardState, VocabularyCard } from "@prisma/client"
import { DataTable } from "@/components/data-table"

interface FSRSAnalyticsDashboardProps {
  student: FullStudentProfile
}

interface DueCardWithCard extends StudentCardState {
  card: VocabularyCard
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
  const { stats, isLoading: isStatsLoading, isError: isStatsError } = useFsrsStats(student.id)

  const [optimizationJobId, setOptimizationJobId] = useState<string | null>(null)

  const { toast } = useToast()

  const handleOptimizeParameters = async () => {
    try {
      const response = await optimizeFsrsParameters(student.id)
      const job = response.data;
      setOptimizationJobId(job.id)
      toast({
        title: "Parameter optimization started",
        description: "This may take a few minutes to complete.",
      })
    } catch (error) {
      console.error("Failed to start parameter optimization:", error)
      toast({
        title: "Error",
        description: "Failed to start parameter optimization.",
        variant: "destructive",
      })
    }
  }

  const dueCardColumns = [
    {
      key: "card",
      header: "Word",
      render: (_: unknown, row: DueCardWithCard) => (
        <div className="space-y-1">
          <div className="font-medium text-slate-900">{row.card.englishWord}</div>
          <div className="text-sm text-slate-500">{row.card.chineseTranslation}</div>
        </div>
      ),
    },
    {
      key: "state",
      header: "State",
      render: (value: unknown) => {
        const stateValue = String(value);
        return (
          <Badge variant="outline" className={stateColors[stateValue as keyof typeof stateColors]}>
            {stateValue.charAt(0) + stateValue.slice(1).toLowerCase()}
          </Badge>
        );
      },
    },
    {
      key: "difficulty",
      header: "Difficulty",
      render: (value: unknown) => {
        const numValue = Number(value);
        return (
          <div className="text-sm text-slate-600">{numValue.toFixed(2)}</div>
        );
      },
    },
    {
      key: "stability",
      header: "Stability",
      render: (value: unknown) => {
        const numValue = Number(value);
        return <div className="text-sm text-slate-600">{numValue.toFixed(1)} days</div>;
      },
    },
    {
      key: "retrievability",
      header: "Retention",
      render: (value: unknown) => {
        const numValue = value !== null && value !== undefined ? Number(value) : null;
        return (
          <div className="text-sm text-slate-600">{numValue ? `${(numValue * 100).toFixed(1)}%` : "N/A"}</div>
        );
      },
    },
    {
      key: "due",
      header: "Due",
      render: (value: unknown) => {
        const dateValue = String(value);
        const dueDate = new Date(dateValue);
        const isOverdue = dueDate < new Date();
        return (
          <div className={`text-sm ${isOverdue ? "text-red-600 font-medium" : "text-slate-600"}`}>
            {format(dueDate, "MMM dd, HH:mm")}
          </div>
        );
      },
    },
  ]

  const listeningCandidateColumns = [
    {
      key: "englishWord",
      header: "Word",
      render: (value: unknown, row: VocabularyCard) => {
        const wordValue = String(value);
        return (
          <div className="space-y-1">
            <div className="font-medium text-slate-900">{wordValue}</div>
            <div className="text-sm text-slate-500">{row.chineseTranslation}</div>
          </div>
        );
      },
    },
    {
      key: "difficultyLevel",
      header: "Difficulty",
      render: (value: unknown) => {
        const levelValue = Number(value);
        return (
          <Badge variant="outline" className={difficultyColors[levelValue as keyof typeof difficultyColors]}>
            Level {levelValue}
          </Badge>
        );
      },
    },
    {
      key: "audioUrl",
      header: "Audio",
      render: (value: unknown) => {
        const audioUrl = value && typeof value === 'string' ? value : null;
        return (
          <div className="flex items-center">
            {audioUrl ? (
              <Button variant="ghost" size="sm" onClick={() => new Audio(audioUrl).play()}>
                <Volume2 className="h-4 w-4" />
              </Button>
            ) : (
              <span className="text-sm text-slate-400">No audio</span>
            )}
          </div>
        );
      },
    },
  ]

  if (isDueCardsError || isListeningError || isStatsError) {
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

  const StatCard = ({ title, value, icon: Icon }: { title: string; value: string | number; icon: React.ElementType }) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center space-x-2">
          <Icon className="h-5 w-5 text-blue-600" />
          <div>
            <p className="text-sm font-medium text-slate-600">{title}</p>
            {isStatsLoading ? <Skeleton className="h-8 w-16 mt-1" /> : <p className="text-2xl font-bold text-slate-900">{value}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">FSRS Analytics</h2>
          <p className="text-slate-600">Advanced spaced repetition analytics for {student.name}</p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total Cards" value={stats?.totalCards ?? 0} icon={BookOpen} />
        <StatCard title="Due Today" value={stats?.dueToday ?? 0} icon={Clock} />
        <StatCard title="Avg Retention" value={`${stats?.averageRetention.toFixed(1) ?? 0}%`} icon={Target} />
      </div>

      {/* FSRS Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>FSRS Engine Actions</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h3 className="font-semibold">Optimize Parameters</h3>
              <p className="text-sm text-slate-500">
                Recalculate the optimal FSRS parameters based on the student&apos;s review history. (Weekly automatic job)
              </p>
            </div>
            <Button onClick={handleOptimizeParameters} disabled={!!optimizationJobId}>
              <Brain className="mr-2 h-4 w-4" />
              Optimize Now
            </Button>
          </div>
          {optimizationJobId && (
            <JobStatusIndicator
              jobId={optimizationJobId}
              title="FSRS Parameter Optimization"
              description="The system is analyzing the review history to find the best parameters."
            />
          )}
        </CardContent>
      </Card>

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
            {isStatsLoading ? <Skeleton className="h-40 w-full" /> : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full" />
                    <span className="text-sm text-slate-600">New Cards</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">{stats?.newCards ?? 0}</span>
                    <div className="w-24">
                      <Progress value={stats ? (stats.newCards / stats.totalCards) * 100 : 0} className="h-2" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                    <span className="text-sm text-slate-600">Learning</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">{stats?.learningCards ?? 0}</span>
                    <div className="w-24">
                      <Progress value={stats ? (stats.learningCards / stats.totalCards) * 100 : 0} className="h-2" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full" />
                    <span className="text-sm text-slate-600">Review Cards</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">{stats?.reviewCards ?? 0}</span>
                    <div className="w-24">
                      <Progress value={stats ? (stats.reviewCards / stats.totalCards) * 100 : 0} className="h-2" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-orange-500 rounded-full" />
                    <span className="text-sm text-slate-600">Relearning Cards</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">{stats?.relearningCards ?? 0}</span>
                    <div className="w-24">
                      <Progress value={stats ? (stats.relearningCards / stats.totalCards) * 100 : 0} className="h-2" />
                    </div>
                  </div>
                </div>
              </div>
            )}
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
             {isStatsLoading ? <Skeleton className="h-24 w-full" /> : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Total Reviews</span>
                  <span className="text-lg font-semibold text-slate-900">
                    {stats?.totalReviews.toLocaleString() ?? 0}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Avg Response Time</span>
                  <span className="text-lg font-semibold text-slate-900">
                    {(stats ? stats.averageResponseTime / 1000 : 0).toFixed(1)}s
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Cards Due This Week</span>
                  <span className="text-lg font-semibold text-slate-900">
                    {stats?.dueThisWeek ?? 0}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Overdue Cards</span>
                  <span className="text-lg font-semibold text-red-600">
                    {stats?.overdue ?? 0}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Detailed Views */}
      <Tabs defaultValue="due-cards" className="space-y-4">
        <TabsList>
          <TabsTrigger value="due-cards">Due Cards</TabsTrigger>
          <TabsTrigger value="listening-candidates">Listening Candidates</TabsTrigger>
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

      </Tabs>
    </div>
  )
}