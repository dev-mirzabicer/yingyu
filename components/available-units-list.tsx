"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Play } from "lucide-react"
import { SessionStartDialog } from "@/components/session-start-dialog"
import type { AvailableUnit } from "@/lib/types"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface AvailableUnitsListProps {
  studentId: string
  studentName: string
  units: AvailableUnit[]
  isLoading: boolean
  isError: boolean
}

export function AvailableUnitsList({
  studentId,
  studentName,
  units,
  isLoading,
  isError,
}: AvailableUnitsListProps) {
  const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false)
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)

  const handleStartSession = (unitId: string) => {
    setSelectedUnitId(unitId)
    setIsSessionDialogOpen(true)
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-8 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2 mb-4" />
              <div className="flex justify-between items-center">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-10 w-32" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-slate-600">
            Failed to load available units. Please try again.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Start a New Session</CardTitle>
          <p className="text-slate-500">
            Choose a unit to begin a new learning session with the student.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {units.length === 0 && (
            <p className="text-slate-500 text-center py-4">No units available.</p>
          )}
          {units.map((unit) => (
            <div
              key={unit.id}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div>
                <h3 className="font-semibold">{unit.name}</h3>
                <p className="text-sm text-slate-500">
                  {unit.exerciseCount} exercises, {unit.cardStats.total} cards
                </p>
                <p
                  className={`text-sm font-medium ${
                    unit.cardStats.ready > 0 ? "text-green-600" : "text-slate-500"
                  }`}
                >
                  {unit.cardStats.ready} cards ready
                </p>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="inline-block">
                      <Button
                        onClick={() => handleStartSession(unit.id)}
                        disabled={!unit.isAvailable}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Start Session
                      </Button>
                    </div>
                  </TooltipTrigger>
                  {!unit.isAvailable && (
                    <TooltipContent>
                      <p>Missing required decks:</p>
                      <ul className="list-disc list-inside">
                        {unit.missingPrerequisites.map((deckName) => (
                          <li key={deckName}>{deckName}</li>
                        ))}
                      </ul>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
          ))}
        </CardContent>
      </Card>
      <SessionStartDialog
        studentId={studentId}
        studentName={studentName}
        open={isSessionDialogOpen}
        onOpenChange={setIsSessionDialogOpen}
        initialUnitId={selectedUnitId}
        // Pass the already fetched units to avoid a refetch
        initialUnits={units}
      />
    </div>
  )
}
