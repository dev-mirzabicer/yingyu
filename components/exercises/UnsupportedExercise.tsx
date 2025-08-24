"use client"

import { UnitItemType } from "@prisma/client"
import { FileText } from "lucide-react"
import { Card, CardContent } from "../ui/card"
import { exerciseTypeInfo } from "./dispatcher"

// Placeholder component for future exercise types - extensible architecture
export function UnsupportedExercise({ type }: { type: UnitItemType }) {
  const typeInfo = exerciseTypeInfo[type] || {
    label: "Unknown",
    icon: FileText,
    color: "bg-gray-100 text-gray-700",
  }
  const Icon = typeInfo.icon

  return (
    <Card className="text-center">
      <CardContent className="p-8">
        <div className={`inline-flex p-4 rounded-lg ${typeInfo.color} mb-4`}>
          <Icon className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-semibold text-slate-900 mb-2">
          {typeInfo.label} Exercise
        </h3>
        <p className="text-slate-600">This exercise type is coming soon!</p>
      </CardContent>
    </Card>
  )
}
