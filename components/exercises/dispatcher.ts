"use client"

import { UnitItemType } from "@prisma/client"
import { ComponentType } from "react"
import { ExerciseProps, VocabularyExercise } from "./VocabularyExercise"
import { GrammarExercise } from "./GrammarExercise"
import { ListeningExercise } from "./ListeningExercise"
import { VocabFillInBlankExercise } from "./VocabFillInBlankExercise"
import { UnsupportedExercise } from "./UnsupportedExercise"

export const exerciseDispatcher: Record<
  UnitItemType,
  ComponentType<ExerciseProps>
> = {
  [UnitItemType.VOCABULARY_DECK]: VocabularyExercise,
  [UnitItemType.GRAMMAR_EXERCISE]: GrammarExercise,
  [UnitItemType.LISTENING_EXERCISE]: ListeningExercise,
  [UnitItemType.VOCAB_FILL_IN_BLANK_EXERCISE]: VocabFillInBlankExercise,
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
