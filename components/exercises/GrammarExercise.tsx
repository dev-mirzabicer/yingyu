"use client"

import { UnitItemType } from "@prisma/client"
import { UnsupportedExercise } from "./UnsupportedExercise"

export function GrammarExercise() {
  return <UnsupportedExercise type={UnitItemType.GRAMMAR_EXERCISE} />
}
