"use client"

import { UnitItemType } from "@prisma/client"
import { UnsupportedExercise } from "./UnsupportedExercise"

export function ListeningExercise() {
  return <UnsupportedExercise type={UnitItemType.LISTENING_EXERCISE} />
}
