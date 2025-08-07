"use client"

import { UnitItemType } from "@prisma/client"
import { BookOpen, FileText, Mic } from "lucide-react"
import { Card, CardContent } from "../ui/card"

// Exercise type information mapping - modular and extensible
const exerciseTypeInfo = {
  [UnitItemType.VOCABULARY_DECK]: {
    label: "Vocabulary",
    icon: BookOpen,
    color: "bg-blue-100 text-blue-700",
  },
  [UnitItemType.GRAMMAR_EXERCISE]: {
    label: "Grammar",
    icon: FileText,
    color: "bg-green-100 text-green-700",
  },
  [UnitItemType.LISTENING_EXERCISE]: {
    label: "Listening",
    icon: Mic,
    color: "bg-purple-100 text-purple-700",
  },
  [UnitItemType.VOCAB_FILL_IN_BLANK_EXERCISE]: {
    label: "Fill in Blank",
    icon: FileText,
    color: "bg-orange-100 text-orange-700",
  },
}

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
