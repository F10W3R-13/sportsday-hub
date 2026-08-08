'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function AddItemButton({
  onAdd,
  placeholder = '새 항목...',
  label = '추가',
}: {
  onAdd: (content: string) => void
  placeholder?: string
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')

  const handleAdd = () => {
    const trimmed = value.trim()
    if (trimmed) {
      onAdd(trimmed)
      setValue('')
      setOpen(false)
    }
  }

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Plus className="mr-1 h-4 w-4" />
        {label}
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleAdd()
          if (e.key === 'Escape') {
            setValue('')
            setOpen(false)
          }
        }}
        autoFocus
        className="h-8"
      />
      <Button size="sm" onClick={handleAdd}>
        추가
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setValue('')
          setOpen(false)
        }}
      >
        취소
      </Button>
    </div>
  )
}
