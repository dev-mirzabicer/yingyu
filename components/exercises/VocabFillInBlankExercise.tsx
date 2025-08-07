"use client"

import { UnitItemType } from "@prisma/client"
import { UnsupportedExercise } from "./UnsupportedExercise"

export function VocabFillInBlankExercise() {
  return (
    <UnsupportedExercise type={UnitItemType.VOCAB_FILL_IN_BLANK_EXERCISE} />
  )
}
