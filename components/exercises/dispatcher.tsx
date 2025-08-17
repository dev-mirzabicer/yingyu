"use client"

import { UnitItemType } from "@prisma/client"
import { ComponentType } from "react"
import { ExerciseProps } from "./types"
import { VocabularyExercise } from "./VocabularyExercise"
import { GrammarExercise } from "./GrammarExercise"
import { ListeningExercise } from "./ListeningExercise"
import { FillInBlankExercise } from "./FillInBlankExercise"
import { UnsupportedExercise } from "./UnsupportedExercise"
import { BookOpen, FileText, Mic, Edit3 } from "lucide-react"
import { Card, CardContent } from "../ui/card"

// Exercise type information mapping - modular and extensible
export const exerciseTypeInfo = {
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
  [UnitItemType.FILL_IN_BLANK_EXERCISE]: {
    label: "Fill in Blanks",
    icon: Edit3,
    color: "bg-orange-100 text-orange-700",
  },
}

export const exerciseDispatcher: Record<
  UnitItemType,
  ComponentType<ExerciseProps>
> = {
  [UnitItemType.VOCABULARY_DECK]: VocabularyExercise,
  [UnitItemType.GRAMMAR_EXERCISE]: GrammarExercise,
  [UnitItemType.LISTENING_EXERCISE]: ListeningExercise,
  [UnitItemType.FILL_IN_BLANK_EXERCISE]: FillInBlankExercise,
}

export function getExerciseComponent(
  type?: UnitItemType,
): ComponentType<ExerciseProps> {
  if (!type) {
    return () => (
      <Card>
        <CardContent className="p-8 text-center text-slate-600">
          No exercise loaded.
        </CardContent>
      </Card>
    )
  }
  return exerciseDispatcher[type] || (() => <UnsupportedExercise type={type} />)
}
