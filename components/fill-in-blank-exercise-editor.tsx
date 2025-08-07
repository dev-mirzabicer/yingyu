"use client"

import React from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Trash2, PlusCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface FillInBlankExerciseEditorProps {
  sentences: string[]
  wordBank: string[]
  onSentencesChange: (sentences: string[]) => void
  onWordBankChange: (wordBank: string[]) => void
  disabled?: boolean
}

export function FillInBlankExerciseEditor({
  sentences,
  wordBank,
  onSentencesChange,
  onWordBankChange,
  disabled,
}: FillInBlankExerciseEditorProps) {
  const handleAddSentence = () => {
    onSentencesChange([...sentences, ""])
  }

  const handleRemoveSentence = (index: number) => {
    onSentencesChange(sentences.filter((_, i) => i !== index))
  }

  const handleSentenceChange = (index: number, value: string) => {
    const newSentences = [...sentences]
    newSentences[index] = value
    onSentencesChange(newSentences)
  }

  const handleAddWordToBank = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      const newWord = e.currentTarget.value.trim()
      if (newWord && !wordBank.includes(newWord)) {
        onWordBankChange([...wordBank, newWord])
        e.currentTarget.value = ""
      }
    }
  }

  const handleRemoveWordFromBank = (wordToRemove: string) => {
    onWordBankChange(wordBank.filter((word) => word !== wordToRemove))
  }

  return (
    <div className="space-y-6">
      {/* Sentences Editor */}
      <div className="space-y-4">
        <Label>Sentences</Label>
        <p className="text-sm text-slate-500">
          Enter sentences with one or more blanks indicated by `____`.
        </p>
        {sentences.length === 0 && (
          <div className="text-center text-sm text-slate-500 py-4 border-2 border-dashed rounded-lg">
            No sentences yet.
          </div>
        )}
        <div className="space-y-3">
          {sentences.map((sentence, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                value={sentence}
                onChange={(e) => handleSentenceChange(index, e.target.value)}
                placeholder="e.g., The cat is ____ the table."
                disabled={disabled}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveSentence(index)}
                disabled={disabled}
                className="text-red-500 hover:text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleAddSentence}
          disabled={disabled}
          className="w-full"
        >
          <PlusCircle className="h-4 w-4 mr-2" />
          Add Sentence
        </Button>
      </div>

      {/* Word Bank Editor */}
      <div className="space-y-4">
        <Label>Word Bank</Label>
        <p className="text-sm text-slate-500">
          Enter words that can be used to fill the blanks. Press Enter to add a word.
        </p>
        <Input
          onKeyDown={handleAddWordToBank}
          placeholder="Type a word and press Enter"
          disabled={disabled}
        />
        <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-lg min-h-16">
          {wordBank.length === 0 ? (
             <span className="text-sm text-slate-400">Word bank is empty</span>
          ) : (
            wordBank.map((word, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="cursor-pointer text-base"
                onClick={() => handleRemoveWordFromBank(word)}
              >
                {word}
                <span className="ml-2 text-red-500 hover:text-red-700">×</span>
              </Badge>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
