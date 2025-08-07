"use client"

import React from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Trash2, PlusCircle } from "lucide-react"

export interface ExampleSentence {
  id?: string // Optional temporary ID for keying
  english: string
  chinese: string
}

interface ExampleSentenceEditorProps {
  value: ExampleSentence[]
  onChange: (value: ExampleSentence[]) => void
  disabled?: boolean
}

export function ExampleSentenceEditor({ value, onChange, disabled }: ExampleSentenceEditorProps) {
  const handleAddSentence = () => {
    onChange([...value, { id: `temp-${Date.now()}`, english: "", chinese: "" }])
  }

  const handleRemoveSentence = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  const handleSentenceChange = (index: number, field: "english" | "chinese", text: string) => {
    const newSentences = [...value]
    newSentences[index][field] = text
    onChange(newSentences)
  }

  return (
    <div className="space-y-4">
      <Label>Example Sentences</Label>
      {value.length === 0 && (
        <div className="text-center text-sm text-slate-500 py-4 border-2 border-dashed rounded-lg">
          No example sentences yet.
        </div>
      )}
      <div className="space-y-3">
        {value.map((sentence, index) => (
          <div key={sentence.id || index} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-end p-3 bg-slate-50 rounded-lg">
            <div className="space-y-1">
              <Label htmlFor={`sentence-en-${index}`} className="text-xs">English</Label>
              <Input
                id={`sentence-en-${index}`}
                value={sentence.english}
                onChange={(e) => handleSentenceChange(index, "english", e.target.value)}
                placeholder="e.g., The quick brown fox..."
                disabled={disabled}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`sentence-zh-${index}`} className="text-xs">Chinese</Label>
              <Input
                id={`sentence-zh-${index}`}
                value={sentence.chinese}
                onChange={(e) => handleSentenceChange(index, "chinese", e.target.value)}
                placeholder="e.g., 敏捷的棕色狐狸..."
                disabled={disabled}
              />
            </div>
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
  )
}
