'use client'

import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function InlineTextEdit({
  value,
  onSave,
  placeholder = '입력...',
  multiline = false,
}: {
  value: string | null
  onSave: (value: string) => void
  placeholder?: string
  multiline?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const handleSave = () => {
    onSave(draft.trim())
    setEditing(false)
  }

  const handleCancel = () => {
    setDraft(value ?? '')
    setEditing(false)
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-left text-sm hover:bg-muted rounded px-1 -mx-1"
      >
        {value || (
          <span className="text-muted-foreground italic">{placeholder}</span>
        )}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !multiline) handleSave()
          if (e.key === 'Escape') handleCancel()
        }}
        className="h-8"
      />
      <Button size="icon-xs" variant="ghost" onClick={handleSave}>
        <Check className="h-3 w-3" />
      </Button>
      <Button size="icon-xs" variant="ghost" onClick={handleCancel}>
        <X className="h-3 w-3" />
      </Button>
    </div>
  )
}
