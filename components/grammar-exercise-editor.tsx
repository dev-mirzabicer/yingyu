"use client"

import React, { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Trash2, PlusCircle } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"

type ExerciseData = Record<string, any>

interface GrammarExerciseEditorProps {
  value: ExerciseData
  onChange: (value: ExerciseData) => void
  disabled?: boolean
}

export function GrammarExerciseEditor({ value, onChange, disabled }: GrammarExerciseEditorProps) {
  const [newKey, setNewKey] = useState("")

  // Convert object to an array of [key, value] pairs for easier mapping
  const entries = Object.entries(value || {})

  const handleAddEntry = () => {
    if (newKey && !(newKey in value)) {
      onChange({ ...value, [newKey]: "" })
      setNewKey("")
    }
  }

  const handleRemoveEntry = (keyToRemove: string) => {
    const { [keyToRemove]: _, ...rest } = value
    onChange(rest)
  }

  const handleKeyChange = (oldKey: string, newKey: string) => {
    if (newKey && !(newKey in value)) {
      const newEntries = entries.map(([key, val]) => {
        if (key === oldKey) {
          return [newKey, val]
        }
        return [key, val]
      })
      onChange(Object.fromEntries(newEntries))
    }
  }

  const handleValueChange = (key: string, newValue: string) => {
    // Attempt to parse as JSON if it looks like an object or array
    try {
        if ((newValue.startsWith('{') && newValue.endsWith('}')) || (newValue.startsWith('[') && newValue.endsWith(']'))) {
            const parsed = JSON.parse(newValue);
            onChange({ ...value, [key]: parsed });
            return;
        }
    } catch (e) {
        // Not valid JSON, treat as string
    }
    onChange({ ...value, [key]: newValue })
  }

  return (
    <div className="space-y-4">
      <Label>Exercise Data</Label>
      <p className="text-sm text-slate-500">
        Define the structure of your grammar exercise, e.g., "instructions", "questions". Values can be text or JSON.
      </p>
      
      {entries.length === 0 && (
        <div className="text-center text-sm text-slate-500 py-4 border-2 border-dashed rounded-lg">
          No exercise data defined.
        </div>
      )}

      <div className="space-y-3">
        {entries.map(([key, val]) => (
          <div key={key} className="grid grid-cols-[1fr_2fr_auto] gap-2 items-start p-3 bg-slate-50 rounded-lg">
            <div className="space-y-1">
              <Label htmlFor={`key-${key}`} className="text-xs">Key</Label>
              <Input
                id={`key-${key}`}
                value={key}
                onChange={(e) => handleKeyChange(key, e.target.value)}
                placeholder="e.g., instructions"
                disabled={disabled}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`value-${key}`} className="text-xs">Value</Label>
              <Textarea
                id={`value-${key}`}
                value={typeof val === 'string' ? val : JSON.stringify(val, null, 2)}
                onChange={(e) => handleValueChange(key, e.target.value)}
                placeholder='e.g., "Complete the sentences." or [{"q": "...", "a": "..."}]'
                disabled={disabled}
                rows={typeof val === 'string' ? 1 : 4}
                className="font-mono text-sm"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => handleRemoveEntry(key)}
              disabled={disabled}
              className="text-red-500 hover:text-red-600 hover:bg-red-50 self-center"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-4 border-t">
        <Input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="Enter new key name"
          onKeyDown={(e) => e.key === 'Enter' && handleAddEntry()}
          disabled={disabled}
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleAddEntry}
          disabled={!newKey || newKey in value}
        >
          <PlusCircle className="h-4 w-4 mr-2" />
          Add Key
        </Button>
      </div>
    </div>
  )
}
