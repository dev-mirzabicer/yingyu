"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  BookOpen,
  FileText,
  Mic,
  Play,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { useAvailableUnits, startSession } from "@/hooks/use-api-enhanced"
import { UnitItemType } from "@prisma/client"

interface SessionStartDialogProps {
  studentId: string
  studentName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Exercise type information mapping
const exerciseTypeInfo = {
  [UnitItemType.VOCABULARY_DECK]: {
    label: "Vocabulary",
    icon: BookOpen,
    color: "bg-blue-100 text-blue-700 border-blue-200",
  },
  [UnitItemType.GRAMMAR_EXERCISE]: {
    label: "Grammar",
    icon: FileText,
    color: "bg-green-100 text-green-700 border-green-200",
  },
  [UnitItemType.LISTENING_EXERCISE]: {
    label: "Listening",
    icon: Mic,
    color: "bg-purple-100 text-purple-700 border-purple-200",
  },
  [UnitItemType.VOCAB_FILL_IN_BLANK_EXERCISE]: {
    label: "Fill in Blank",
    icon: FileText,
    color: "bg-orange-100 text-orange-700 border-orange-200",
  },
}

export function SessionStartDialog({
  studentId,
  studentName,
  open,
  onOpenChange
}: SessionStartDialogProps) {
  const { units, isLoading, isError } = useAvailableUnits(studentId)
  const [selectedUnit, setSelectedUnit] = useState<any>(null)
  const [isStarting, setIsStarting] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleUnitSelect = (unit: any) => {
    setSelectedUnit(selectedUnit?.id === unit.id ? null : unit)
  }

  const handleStartSession = async () => {
    if (!selectedUnit) return

    setIsStarting(true)
    try {
      const result = await startSession(studentId, selectedUnit.id)

      toast({
        title: "Session started successfully",
        description: `${studentName} is now learning: ${selectedUnit.name}`,
      })

      // Navigate to the live session
      router.push(`/session/${result.data.id}`)
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to start session:', error)
      toast({
        title: "Failed to start session",
        description: "Please check the unit prerequisites and try again.",
        variant: "destructive",
      })
    } finally {
      setIsStarting(false)
    }
  }

  const availableUnits = units.filter((unit: any) => unit.isAvailable)
  const unavailableUnits = units.filter((unit: any) => !unit.isAvailable)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Play className="h-5 w-5 text-blue-600" />
            <span>Start Learning Session - {studentName}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[60vh]">
          {/* Unit Selection Panel */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Select Unit</h3>
              <Badge variant="outline" className="text-xs">
                {availableUnits.length} available
              </Badge>
            </div>

            <ScrollArea className="h-[50vh]">
              <div className="space-y-3 pr-4">
                {isError && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Failed to load available units. Please try again.
                    </AlertDescription>
                  </Alert>
                )}

                {isLoading ? (
                  <>
                    {[...Array(3)].map((_, i) => (
                      <Card key={i}>
                        <CardContent className="p-4">
                          <div className="space-y-2">
                            <Skeleton className="h-5 w-3/4" />
                            <Skeleton className="h-4 w-full" />
                            <div className="flex space-x-2">
                              <Skeleton className="h-6 w-16" />
                              <Skeleton className="h-6 w-20" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </>
                ) : (
                  <>
                    {/* Available Units */}
                    {availableUnits.map((unit: any) => (
                      <Card
                        key={unit.id}
                        className={`cursor-pointer transition-all hover:shadow-md ${selectedUnit?.id === unit.id
                            ? 'ring-2 ring-blue-500 shadow-md'
                            : 'hover:ring-1 hover:ring-slate-300'
                          }`}
                        onClick={() => handleUnitSelect(unit)}
                      >
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="font-medium text-slate-900 line-clamp-1">
                                  {unit.name}
                                </h4>
                                {unit.description && (
                                  <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                                    {unit.description}
                                  </p>
                                )}
                              </div>
                              <CheckCircle className="h-5 w-5 text-green-600 ml-2 flex-shrink-0" />
                            </div>

                            <div className="flex items-center space-x-4 text-xs text-slate-500">
                              <div className="flex items-center space-x-1">
                                <Target className="h-3 w-3" />
                                <span>{unit.exerciseCount} exercises</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <BookOpen className="h-3 w-3" />
                                <span>{unit.cardStats.ready}/{unit.cardStats.total} cards ready</span>
                              </div>
                            </div>

                            <div className="flex items-center space-x-2">
                              {unit.isPublic && (
                                <Badge variant="secondary" className="text-xs">
                                  Public
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-xs">
                                Ready to start
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {/* Unavailable Units */}
                    {unavailableUnits.length > 0 && (
                      <>
                        <div className="pt-4 border-t">
                          <h4 className="font-medium text-slate-700 mb-3 flex items-center space-x-2">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            <span>Prerequisites Required</span>
                          </h4>
                        </div>
                        {unavailableUnits.map((unit: any) => (
                          <Card key={unit.id} className="opacity-60 border-amber-200">
                            <CardContent className="p-4">
                              <div className="space-y-3">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <h4 className="font-medium text-slate-900 line-clamp-1">
                                      {unit.name}
                                    </h4>
                                    {unit.description && (
                                      <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                                        {unit.description}
                                      </p>
                                    )}
                                  </div>
                                  <AlertTriangle className="h-5 w-5 text-amber-500 ml-2" />
                                </div>

                                <div className="space-y-1">
                                  {unit.missingPrerequisites.map((req: string, idx: number) => (
                                    <p key={idx} className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
                                      {req}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </>
                    )}

                    {availableUnits.length === 0 && unavailableUnits.length === 0 && !isLoading && (
                      <div className="text-center py-8">
                        <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500 mb-2">No units available</p>
                        <p className="text-sm text-slate-400">Create a unit first to start sessions</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Unit Preview Panel */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900">
              {selectedUnit ? 'Unit Preview' : 'Select a unit to preview'}
            </h3>

            {selectedUnit ? (
              <ScrollArea className="h-[50vh]">
                <div className="space-y-4 pr-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">{selectedUnit.name}</CardTitle>
                      {selectedUnit.description && (
                        <p className="text-sm text-slate-600">{selectedUnit.description}</p>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-slate-50 rounded-lg">
                          <div className="text-2xl font-bold text-slate-900">
                            {selectedUnit.exerciseCount}
                          </div>
                          <div className="text-xs text-slate-600">Exercises</div>
                        </div>
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <div className="text-2xl font-bold text-blue-900">
                            {selectedUnit.cardStats.ready}
                          </div>
                          <div className="text-xs text-blue-600">Cards Ready</div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h4 className="font-medium text-sm text-slate-700">Exercise Breakdown:</h4>
                        {selectedUnit.items.map((item: any, index: number) => {
                          const typeInfo = exerciseTypeInfo[item.type as keyof typeof exerciseTypeInfo] || {
                            label: "Unknown",
                            icon: FileText,
                            color: "bg-gray-100 text-gray-700 border-gray-200"
                          }
                          const Icon = typeInfo.icon

                          return (
                            <div key={item.id} className="flex items-center space-x-3 p-2 rounded-lg bg-slate-50">
                              <div className="text-xs text-slate-500 w-6">
                                #{index + 1}
                              </div>
                              <div className={`p-1.5 rounded ${typeInfo.color}`}>
                                <Icon className="h-3 w-3" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-900 truncate">
                                  {item.vocabularyDeck?.name ||
                                    item.grammarExercise?.title ||
                                    item.listeningExercise?.title ||
                                    item.vocabFillInBlankExercise?.title ||
                                    'Unnamed Exercise'}
                                </p>
                                <p className="text-xs text-slate-500">{typeInfo.label}</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            ) : (
              <div className="h-[50vh] flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <Clock className="h-12 w-12 mx-auto mb-4" />
                  <p>Select a unit to see the preview</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-slate-600">
            {selectedUnit ? (
              <span>Ready to start "{selectedUnit.name}" with {studentName}</span>
            ) : (
              <span>Choose a unit to start the learning session</span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isStarting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleStartSession}
              disabled={!selectedUnit || isStarting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Play className="h-4 w-4 mr-2" />
              {isStarting ? "Starting..." : "Start Session"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
