import {
    Unit,
    UnitItem,
    VocabularyDeck,
    GrammarExercise,
    ListeningExercise,
    VocabFillInBlankExercise
  } from '@prisma/client';
  
  // Define the shape of each specific exercise type when it's part of a UnitItem
  export type PopulatedUnitItem = UnitItem & {
    vocabularyDeck: VocabularyDeck | null;
    grammarExercise: GrammarExercise | null;
    listeningExercise: ListeningExercise | null;
    vocabFillInBlankExercise: VocabFillInBlankExercise | null;
  };
  
  // Define the shape of a full Unit, complete with its ordered, populated items
  export type FullUnit = Unit & {
    items: PopulatedUnitItem[];
  };
  
  // Define a type for the data required to create a new exercise and add it to a unit
  // This ensures that when we add an item, we know its type and have the necessary data.
  export type NewUnitItemData =
    | { type: 'VOCABULARY_DECK'; data: Omit<VocabularyDeck, 'id' | 'creatorId' | 'createdAt' | 'updatedAt'> }
    | { type: 'GRAMMAR_EXERCISE'; data: Omit<GrammarExercise, 'id' | 'creatorId' | 'createdAt' | 'updatedAt'> }
    | { type: 'LISTENING_EXERCISE'; data: Omit<ListeningExercise, 'id' | 'creatorId' | 'createdAt' | 'updatedAt'> }
    | { type: 'VOCAB_FILL_IN_BLANK_EXERCISE'; data: Omit<VocabFillInBlankExercise, 'id' | 'creatorId' | 'createdAt' | 'updatedAt'> };
  
  