'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { MarkdownRenderer } from '@/lib/markdown/renderer'

export function MarkdownEditDialog({
  open,
  onClose,
  title,
  initialContent,
  onSave,
}: {
  open: boolean
  onClose: () => void
  title: string
  initialContent: string
  onSave: (content: string) => void
}) {
  const [content, setContent] = useState(initialContent)

  const handleSave = () => {
    onSave(content)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title} 편집</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-h-[400px]">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              마크다운
            </label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="h-[240px] md:h-[400px] font-mono text-sm"
            />
          </div>
          <div className="space-y-2 overflow-y-auto">
            <label className="text-sm font-medium text-muted-foreground">
              미리보기
            </label>
            <div className="border rounded-md p-4 h-[240px] md:h-[400px] overflow-y-auto">
              <MarkdownRenderer content={content} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button onClick={handleSave}>저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
