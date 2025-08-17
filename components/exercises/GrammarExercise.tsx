"use client"

import { UnitItemType } from "@prisma/client"
import { UnsupportedExercise } from "./UnsupportedExercise"
import { ExerciseProps } from "./types"

export function GrammarExercise(props: ExerciseProps) {
  // For now, this is a placeholder that ignores props and renders an unsupported message
  // In the future, this will implement the full ExerciseProps interface
  return <UnsupportedExercise type={UnitItemType.GRAMMAR_EXERCISE} />
}
